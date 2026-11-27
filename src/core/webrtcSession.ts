import { io, Socket } from 'socket.io-client';
import {
  computeNqsBreakdown,
  createInitialEngineState,
  EngineState,
  estimateMos,
  STATE_PROFILES,
} from '../algorithm/nqsEngine';
import {
  AdaptationMode,
  ConnectionType,
  NQSConfig,
  QualityState,
  StateTransitionEvent,
  TelemetrySample,
} from '../types/netadapt';

export interface SignalingPeer {
  socketId: string;
  username: string;
  micOn: boolean;
  camOn: boolean;
}

export interface IncomingChatPayload {
  id: string;
  sender: string;
  senderId: string;
  text: string;
  time: string;
}

export type LiveConnectionPhase =
  | 'disconnected'
  | 'connecting_signaling'
  | 'waiting_for_peer'
  | 'negotiating'
  | 'connected'
  | 'reconnecting'
  | 'room_full';

export interface WebRTCManagerCallbacks {
  onPhaseChange: (phase: LiveConnectionPhase, detail?: string) => void;
  onPeersChange: (selfId: string, peers: SignalingPeer[]) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onChatHistory: (messages: IncomingChatPayload[]) => void;
  onChatMessage: (message: IncomingChatPayload) => void;
  onLiveTelemetry: (sample: TelemetrySample, transition: StateTransitionEvent | null) => void;
  onIceRestart: () => void;
}

interface PrevStatsSnapshot {
  timestampMs: number;
  bytesSent: number;
  packetsSent: number;
  packetsLost: number;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
    ],
  },
];

export class NetAdaptWebRTCManager {
  private socket: Socket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private roomId = 'room-101';
  private username = 'You';
  private selfId = '';
  private micOn = true;
  private camOn = false;
  private mode: AdaptationMode = 'ADAPTIVE';
  private nqsConfig: NQSConfig;
  private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS;

  private statsInterval: number | null = null;
  private iceRestartTimer: number | null = null;
  private prevStats: PrevStatsSnapshot | null = null;
  private fsmState: EngineState = createInitialEngineState();
  private lastAppliedState: QualityState | null = null;
  private callbacks: WebRTCManagerCallbacks;

  constructor(config: NQSConfig, callbacks: WebRTCManagerCallbacks) {
    this.nqsConfig = config;
    this.callbacks = callbacks;
  }

  public updateConfig(config: NQSConfig): void {
    this.nqsConfig = config;
  }

  public async setMode(mode: AdaptationMode): Promise<void> {
    this.mode = mode;
    if (this.pc) {
      await this.applyVideoParameters(this.fsmState.qualityState, true);
    }
  }

  public async connectAndJoin(params: {
    roomId: string;
    username: string;
    localStream: MediaStream | null;
    micOn: boolean;
    camOn: boolean;
  }): Promise<void> {
    this.roomId = params.roomId;
    this.username = params.username || 'You';
    this.localStream = params.localStream;
    this.micOn = params.micOn;
    this.camOn = params.camOn;

    this.callbacks.onPhaseChange('connecting_signaling');

    // Fetch ICE server config from Express backend (falls back cleanly to Google STUN)
    try {
      const res = await fetch('/api/ice-config');
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: RTCIceServer[] };
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          this.iceServers = data.iceServers;
        }
      }
    } catch {
      this.iceServers = DEFAULT_ICE_SERVERS;
    }

    if (!this.socket) {
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
      });
      this.bindSocketEvents(this.socket);
    }

    if (this.socket.connected) {
      this.emitJoin();
    }
  }

  private emitJoin(): void {
    if (!this.socket) return;
    this.socket.emit('join-room', {
      roomId: this.roomId,
      username: this.username,
      micOn: this.micOn,
      camOn: this.camOn,
    });
  }

  private bindSocketEvents(socket: Socket): void {
    socket.on('connect', () => {
      this.selfId = socket.id || '';
      this.emitJoin();
    });

    socket.on('disconnect', () => {
      this.callbacks.onPhaseChange('reconnecting', 'Signaling socket reconnecting...');
    });

    socket.on('room-full', (payload: { message?: string }) => {
      this.closePeerConnection();
      this.callbacks.onPhaseChange(
        'room_full',
        payload?.message || 'Room already has 2 participants.'
      );
    });

    socket.on(
      'room-state',
      (payload: {
        selfId: string;
        peers: SignalingPeer[];
        messages: IncomingChatPayload[];
      }) => {
        this.selfId = payload.selfId;
        this.callbacks.onPeersChange(this.selfId, payload.peers || []);
        this.callbacks.onChatHistory(payload.messages || []);

        const hasRemote = (payload.peers || []).some((p) => p.socketId !== this.selfId);
        if (!hasRemote) {
          this.closePeerConnection();
          this.callbacks.onPhaseChange('waiting_for_peer');
        } else {
          // Second peer joined: wait briefly for offer from existing peer
          this.callbacks.onPhaseChange('negotiating');
        }
      }
    );

    socket.on(
      'peer-joined',
      async (payload: { peers?: SignalingPeer[] }) => {
        if (payload?.peers) {
          this.callbacks.onPeersChange(this.selfId, payload.peers);
        }
        // Existing peer creates the SDP Offer
        await this.initiateOffer(false);
      }
    );

    socket.on('offer', async (payload: { sdp: RTCSessionDescriptionInit }) => {
      if (!payload?.sdp) return;
      try {
        this.callbacks.onPhaseChange('negotiating');
        const pc = this.ensurePeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await this.flushQueuedCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket?.emit('answer', { roomId: this.roomId, sdp: answer });
      } catch (err) {
        console.error('Failed handling incoming offer:', err);
      }
    });

    socket.on('answer', async (payload: { sdp: RTCSessionDescriptionInit }) => {
      if (!payload?.sdp || !this.pc) return;
      try {
        if (this.pc.signalingState !== 'stable') {
          await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await this.flushQueuedCandidates();
        }
      } catch (err) {
        console.error('Failed handling incoming answer:', err);
      }
    });

    socket.on('ice-candidate', async (payload: { candidate: RTCIceCandidateInit }) => {
      if (!payload?.candidate) return;
      if (this.pc && this.pc.remoteDescription) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          // Ignore stale candidates during ICE restart
        }
      } else {
        this.pendingCandidates.push(payload.candidate);
      }
    });

    socket.on('peer-media-state', (payload: { peers?: SignalingPeer[] }) => {
      if (payload?.peers) {
        this.callbacks.onPeersChange(this.selfId, payload.peers);
      }
    });

    socket.on('peer-left', (payload: { peers?: SignalingPeer[] }) => {
      this.closePeerConnection();
      if (payload?.peers) {
        this.callbacks.onPeersChange(this.selfId, payload.peers);
      }
      this.callbacks.onPhaseChange('waiting_for_peer');
    });

    socket.on('chat-message', (payload: IncomingChatPayload) => {
      this.callbacks.onChatMessage(payload);
    });
  }

  private ensurePeerConnection(): RTCPeerConnection {
    if (this.pc) return this.pc;

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 4,
    });
    this.pc = pc;
    this.remoteStream = new MediaStream();
    this.pendingCandidates = [];
    this.prevStats = null;
    this.fsmState = createInitialEngineState();
    this.lastAppliedState = null;

    // Attach current local tracks (or receive-only transceivers if user has no camera/mic)
    const videoTrack = this.localStream?.getVideoTracks()[0] || null;
    const audioTrack = this.localStream?.getAudioTracks()[0] || null;

    if (audioTrack && this.localStream) {
      pc.addTrack(audioTrack, this.localStream);
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    if (videoTrack && this.localStream) {
      pc.addTrack(videoTrack, this.localStream);
    } else {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('ice-candidate', {
          roomId: this.roomId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((tr) => {
          if (!this.remoteStream!.getTracks().some((existing) => existing.id === tr.id)) {
            this.remoteStream!.addTrack(tr);
          }
        });
      } else if (event.track) {
        if (!this.remoteStream.getTracks().some((existing) => existing.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }
      this.callbacks.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
    };

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === 'connected' || st === 'completed') {
        if (this.iceRestartTimer) {
          window.clearTimeout(this.iceRestartTimer);
          this.iceRestartTimer = null;
        }
        this.callbacks.onPhaseChange('connected');
        this.startStatsLoop();
      } else if (st === 'disconnected' || st === 'failed') {
        this.callbacks.onPhaseChange('reconnecting', 'Triggering ICE Restart...');
        if (!this.iceRestartTimer) {
          this.iceRestartTimer = window.setTimeout(() => {
            this.iceRestartTimer = null;
            if (
              this.pc &&
              (this.pc.iceConnectionState === 'disconnected' ||
                this.pc.iceConnectionState === 'failed')
            ) {
              this.callbacks.onIceRestart();
              this.initiateOffer(true);
            }
          }, 2000);
        }
      }
    };

    return pc;
  }

  private async initiateOffer(iceRestart: boolean): Promise<void> {
    try {
      this.callbacks.onPhaseChange(iceRestart ? 'reconnecting' : 'negotiating');
      const pc = this.ensurePeerConnection();
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      this.socket?.emit('offer', { roomId: this.roomId, sdp: offer });
    } catch (err) {
      console.error('Failed creating WebRTC offer:', err);
    }
  }

  private async flushQueuedCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;
    const queued = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const cand of queued) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // Ignore stale candidate
      }
    }
  }

  /**
   * Seamlessly replaces outgoing video/audio tracks mid-call (Camera toggle or Screen Share)
   * without renegotiating or dropping the WebRTC peer connection.
   */
  public async replaceLocalMedia(
    nextStream: MediaStream | null,
    micOn: boolean,
    camOn: boolean
  ): Promise<void> {
    this.localStream = nextStream;
    this.micOn = micOn;
    this.camOn = camOn;

    if (this.pc) {
      const senders = this.pc.getSenders();
      const videoSender = senders.find(
        (s) => s.track?.kind === 'video' || (!s.track && this.getTransceiverKind(s) === 'video')
      );
      const audioSender = senders.find(
        (s) => s.track?.kind === 'audio' || (!s.track && this.getTransceiverKind(s) === 'audio')
      );

      const nextVideo = nextStream?.getVideoTracks()[0] || null;
      const nextAudio = nextStream?.getAudioTracks()[0] || null;

      if (videoSender) {
        try {
          await videoSender.replaceTrack(nextVideo);
        } catch {
          // ignore if sender closed
        }
      }
      if (audioSender) {
        try {
          await audioSender.replaceTrack(nextAudio);
        } catch {
          // ignore if sender closed
        }
      }
    }

    this.socket?.emit('peer-media-state', {
      roomId: this.roomId,
      micOn: this.micOn,
      camOn: this.camOn,
      username: this.username,
    });
  }

  private getTransceiverKind(sender: RTCRtpSender): string | null {
    if (!this.pc) return null;
    const t = this.pc.getTransceivers().find((tr) => tr.sender === sender);
    return t?.receiver?.track?.kind || null;
  }

  public sendChatMessage(id: string, text: string, time: string): void {
    this.socket?.emit('chat-message', {
      id,
      roomId: this.roomId,
      sender: this.username,
      text,
      time,
    });
  }

  private startStatsLoop(): void {
    if (this.statsInterval !== null) return;
    this.statsInterval = window.setInterval(() => {
      this.collectAndAdapt().catch(() => {});
    }, 1000);
  }

  private stopStatsLoop(): void {
    if (this.statsInterval !== null) {
      window.clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private async collectAndAdapt(): Promise<void> {
    if (!this.pc || this.pc.connectionState === 'closed') return;
    const report = await this.pc.getStats();

    let bytesSent = 0;
    let packetsSent = 0;
    let fps = 0;
    let frameWidth = 0;
    let frameHeight = 0;
    let rttMs = 0;
    let jitterMs = 0;
    let packetsLost = 0;
    let connectionType: ConnectionType = 'P2P';

    const localCandidates = new Map<string, string>();
    const remoteCandidates = new Map<string, string>();
    let activePair: {
      localCandidateId?: string;
      remoteCandidateId?: string;
      currentRoundTripTime?: number;
    } | null = null;

    report.forEach((stat) => {
      if (stat.type === 'local-candidate') {
        localCandidates.set(stat.id, stat.candidateType || '');
      } else if (stat.type === 'remote-candidate') {
        remoteCandidates.set(stat.id, stat.candidateType || '');
      } else if (
        stat.type === 'candidate-pair' &&
        (stat.state === 'succeeded' || stat.nominated)
      ) {
        if (!activePair || stat.nominated) {
          activePair = stat;
        }
      } else if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
        bytesSent = stat.bytesSent || 0;
        packetsSent = stat.packetsSent || 0;
        fps = stat.framesPerSecond || 0;
        frameWidth = stat.frameWidth || 0;
        frameHeight = stat.frameHeight || 0;
      } else if (stat.type === 'inbound-rtp' && stat.kind === 'video' && frameWidth === 0) {
        // Fallback when receiving video in send-less tab
        fps = fps || stat.framesPerSecond || 0;
        frameWidth = stat.frameWidth || 0;
        frameHeight = stat.frameHeight || 0;
        if (stat.jitter) jitterMs = stat.jitter * 1000;
      } else if (stat.type === 'remote-inbound-rtp' && stat.kind === 'video') {
        if (typeof stat.roundTripTime === 'number') {
          rttMs = stat.roundTripTime * 1000;
        }
        if (typeof stat.jitter === 'number') {
          jitterMs = stat.jitter * 1000;
        }
        if (typeof stat.packetsLost === 'number') {
          packetsLost = stat.packetsLost;
        }
      }
    });

    if (activePair) {
      const pair = activePair as {
        localCandidateId?: string;
        remoteCandidateId?: string;
        currentRoundTripTime?: number;
      };
      if (rttMs === 0 && typeof pair.currentRoundTripTime === 'number') {
        rttMs = pair.currentRoundTripTime * 1000;
      }
      const lType = pair.localCandidateId ? localCandidates.get(pair.localCandidateId) : '';
      const rType = pair.remoteCandidateId ? remoteCandidates.get(pair.remoteCandidateId) : '';
      connectionType = lType === 'relay' || rType === 'relay' ? 'RELAY' : 'P2P';
    }

    const nowMs = Date.now();
    let bitrateKbps = 0;
    let packetLossPct = 0;

    if (this.prevStats) {
      const dtSec = Math.max(0.25, (nowMs - this.prevStats.timestampMs) / 1000);
      const dBytes = Math.max(0, bytesSent - this.prevStats.bytesSent);
      const dSent = Math.max(0, packetsSent - this.prevStats.packetsSent);
      const dLost = Math.max(0, packetsLost - this.prevStats.packetsLost);

      bitrateKbps = (dBytes * 8) / (dtSec * 1000);
      packetLossPct = dSent > 0 ? Math.min(100, Math.max(0, (dLost / dSent) * 100)) : 0;
    }

    this.prevStats = {
      timestampMs: nowMs,
      bytesSent,
      packetsSent,
      packetsLost,
    };

    const effectiveBitrate = bitrateKbps > 0 ? bitrateKbps : 850;
    const effectiveRtt = Number(Math.max(1, rttMs || 18).toFixed(0));
    const effectiveJitter = Number(Math.max(0.5, jitterMs || 2.5).toFixed(1));
    const effectiveLoss = Number(packetLossPct.toFixed(1));

    const { nqs } = computeNqsBreakdown(
      effectiveRtt,
      effectiveLoss,
      effectiveJitter,
      effectiveBitrate,
      this.nqsConfig
    );

    const prev = this.fsmState;
    const smoothNqs = Number(
      (this.nqsConfig.emaAlpha * nqs + (1 - this.nqsConfig.emaAlpha) * prev.smoothNqs).toFixed(1)
    );

    let nextState: QualityState = prev.qualityState;
    let downgradeCounter = prev.downgradeCounter;
    let upgradeCounter = prev.upgradeCounter;
    let reason: string | null = null;

    if (
      prev.qualityState !== 'POOR' &&
      (effectiveLoss > this.nqsConfig.emergencyLossPct ||
        smoothNqs < this.nqsConfig.emergencyNqsThreshold)
    ) {
      nextState = 'POOR';
      downgradeCounter = 0;
      upgradeCounter = 0;
      reason = `Emergency live drop (PLR ${effectiveLoss}%, NQS ${smoothNqs})`;
    } else if (prev.qualityState === 'GOOD') {
      if (smoothNqs < this.nqsConfig.downgradeToModerateThreshold) {
        downgradeCounter += 1;
        if (downgradeCounter >= this.nqsConfig.downgradeHoldSec) {
          nextState = 'MODERATE';
          downgradeCounter = 0;
          reason = `Live NQS < ${this.nqsConfig.downgradeToModerateThreshold} for ${this.nqsConfig.downgradeHoldSec}s`;
        }
      } else {
        downgradeCounter = 0;
      }
    } else if (prev.qualityState === 'MODERATE') {
      if (smoothNqs < this.nqsConfig.downgradeToPoorThreshold) {
        downgradeCounter += 1;
        if (downgradeCounter >= this.nqsConfig.downgradeHoldSec) {
          nextState = 'POOR';
          downgradeCounter = 0;
          reason = `Live NQS < ${this.nqsConfig.downgradeToPoorThreshold} for ${this.nqsConfig.downgradeHoldSec}s`;
        }
      } else if (smoothNqs > this.nqsConfig.upgradeToGoodThreshold) {
        upgradeCounter += 1;
        if (upgradeCounter >= this.nqsConfig.upgradeHoldSec) {
          nextState = 'GOOD';
          upgradeCounter = 0;
          reason = `Live NQS > ${this.nqsConfig.upgradeToGoodThreshold} for ${this.nqsConfig.upgradeHoldSec}s`;
        }
      } else {
        downgradeCounter = 0;
        upgradeCounter = 0;
      }
    } else if (prev.qualityState === 'POOR') {
      if (smoothNqs > this.nqsConfig.upgradeToModerateThreshold) {
        upgradeCounter += 1;
        if (upgradeCounter >= this.nqsConfig.upgradeHoldSec) {
          nextState = 'MODERATE';
          upgradeCounter = 0;
          reason = `Live NQS > ${this.nqsConfig.upgradeToModerateThreshold} for ${this.nqsConfig.upgradeHoldSec}s`;
        }
      } else {
        upgradeCounter = 0;
      }
    }

    const elapsedSec = prev.elapsedSec + 1;
    this.fsmState = {
      elapsedSec,
      scenarioSec: elapsedSec,
      qualityState: nextState,
      smoothNqs,
      downgradeCounter,
      upgradeCounter,
    };

    if (nextState !== this.lastAppliedState) {
      await this.applyVideoParameters(nextState, false);
    }

    const transition: StateTransitionEvent | null =
      nextState !== prev.qualityState && reason
        ? {
            id: `live-tr-${nowMs}`,
            timestamp: nowMs,
            elapsedSec,
            fromState: prev.qualityState,
            toState: nextState,
            reason,
            smoothNqs,
            mode: this.mode,
          }
        : null;

    const profile = STATE_PROFILES[nextState];
    const resolution =
      frameWidth > 0 && frameHeight > 0 ? `${frameWidth}x${frameHeight}` : profile.resolution;

    const sample: TelemetrySample = {
      timestamp: nowMs,
      elapsedSec,
      connectionType,
      rttMs: effectiveRtt,
      jitterMs: effectiveJitter,
      packetLossPct: effectiveLoss,
      bitrateKbps: Number(bitrateKbps.toFixed(0)),
      fps: Number((fps || (this.camOn ? profile.maxFps : 0)).toFixed(0)),
      resolution,
      scaleFactor: profile.scaleFactor,
      nqs,
      smoothNqs,
      qualityState: nextState,
      mode: this.mode,
      scenario: 'normal',
      mosEstimate: estimateMos(effectiveRtt, effectiveJitter, effectiveLoss),
      isFrozen: frameWidth > 0 && fps > 0 && fps < 5,
      isRecovering: this.pc.iceConnectionState === 'disconnected',
    };

    this.callbacks.onLiveTelemetry(sample, transition);
  }

  private async applyVideoParameters(state: QualityState, force: boolean): Promise<void> {
    if (!this.pc) return;
    if (!force && this.lastAppliedState === state) return;

    const videoSender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (!videoSender) return;

    try {
      const params = videoSender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      if (this.mode === 'ADAPTIVE') {
        const profile = STATE_PROFILES[state];
        params.encodings[0].maxBitrate = profile.maxBitrateKbps * 1000;
        params.encodings[0].maxFramerate = profile.maxFps;
        params.encodings[0].scaleResolutionDownBy = profile.scaleFactor;
      } else {
        // Baseline WebRTC: release adaptive overrides
        delete params.encodings[0].maxBitrate;
        delete params.encodings[0].maxFramerate;
        params.encodings[0].scaleResolutionDownBy = 1.0;
      }

      await videoSender.setParameters(params);
      this.lastAppliedState = state;
    } catch {
      // Some browsers restrict setParameters before track negotiation settles
    }
  }

  private closePeerConnection(): void {
    this.stopStatsLoop();
    if (this.iceRestartTimer) {
      window.clearTimeout(this.iceRestartTimer);
      this.iceRestartTimer = null;
    }
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
    this.pendingCandidates = [];
    this.prevStats = null;
    this.lastAppliedState = null;
    this.callbacks.onRemoteStream(null);
  }

  public leave(): void {
    this.closePeerConnection();
    this.socket?.emit('leave-room', { roomId: this.roomId });
  }

  public destroy(): void {
    this.leave();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
