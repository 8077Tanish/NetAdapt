/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Compass,
  Copy,
  Database,
  Home,
  Lightbulb,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Users,
  Video,
} from 'lucide-react';
import {
  createInitialEngineState,
  DEFAULT_NQS_CONFIG,
  EngineState,
  exportTelemetryToCsv,
  stepTelemetryEngine,
} from './algorithm/nqsEngine';
import { AnalyticsView } from './components/AnalyticsView';
import { ArchitectureView } from './components/ArchitectureView';
import { BrainstormView } from './components/BrainstormView';
import { BrandMark } from './components/BrandMark';
import { CommandPalette } from './components/CommandPalette';
import { LandingView } from './components/LandingView';
import { MeetingView } from './components/MeetingView';
import { RoadmapView } from './components/RoadmapView';
import { SettingsView } from './components/SettingsView';
import {
  LiveConnectionPhase,
  NetAdaptWebRTCManager,
  SignalingPeer,
} from './core/webrtcSession';
import { INITIAL_BRAINSTORM_IDEAS, INITIAL_ROADMAP_MONTHS } from './data/projectData';
import {
  AdaptationMode,
  BrainstormIdea,
  ChatMessage,
  FaultScenarioId,
  NQSConfig,
  ParticipantInfo,
  RoadmapMonth,
  StateTransitionEvent,
  TelemetrySample,
  WorkspaceView,
} from './types/netadapt';

const ROADMAP_STORAGE_KEY = 'netadapt_roadmap_v1';
const BRAINSTORM_STORAGE_KEY = 'netadapt_brainstorm_v1';

function loadRoadmap(): RoadmapMonth[] {
  try {
    const raw = localStorage.getItem(ROADMAP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RoadmapMonth[];
      if (Array.isArray(parsed) && parsed.length === 12) return parsed;
    }
  } catch {
    // Fallback to defaults
  }
  return INITIAL_ROADMAP_MONTHS;
}

function loadBrainstorm(): BrainstormIdea[] {
  try {
    const raw = localStorage.getItem(BRAINSTORM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BrainstormIdea[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Fallback to defaults
  }
  return INITIAL_BRAINSTORM_IDEAS;
}

function getInitialRoomFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (r) {
      const clean = r.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);
      if (clean) return clean;
    }
  } catch {
    // ignore
  }
  return 'room-101';
}

function formatNowTime(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function seedInitialTelemetry(config: NQSConfig): {
  engine: EngineState;
  samples: TelemetrySample[];
} {
  let engine = createInitialEngineState();
  const samples: TelemetrySample[] = [];
  for (let i = 0; i < 12; i++) {
    const step = stepTelemetryEngine(engine, 'normal', 'ADAPTIVE', config);
    engine = step.nextEngine;
    samples.push(step.sample);
  }
  return { engine, samples };
}

export default function App() {
  const [view, setView] = useState<WorkspaceView>('meeting');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [roomId, setRoomId] = useState<string>(getInitialRoomFromUrl);
  const [username, setUsername] = useState<string>(() => {
    const suffix = Math.floor(10 + Math.random() * 89);
    return `Peer-${suffix}`;
  });
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Real local media state (camera, mic, screen share)
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Real 2-User WebRTC + Socket.IO State
  const [livePhase, setLivePhase] = useState<LiveConnectionPhase>('connecting_signaling');
  const [selfSocketId, setSelfSocketId] = useState<string>('');
  const [signalingPeers, setSignalingPeers] = useState<SignalingPeer[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const rtcManagerRef = useRef<NetAdaptWebRTCManager | null>(null);

  // NQS Adaptation Engine State
  const [nqsConfig, setNqsConfig] = useState<NQSConfig>(DEFAULT_NQS_CONFIG);
  const [mode, setMode] = useState<AdaptationMode>('ADAPTIVE');
  const [activeScenario, setActiveScenario] = useState<FaultScenarioId>('normal');
  const [isPaused, setIsPaused] = useState(false);

  const initialSeed = useMemo(() => seedInitialTelemetry(DEFAULT_NQS_CONFIG), []);
  const engineRef = useRef<EngineState>(initialSeed.engine);
  const [samples, setSamples] = useState<TelemetrySample[]>(initialSeed.samples);
  const [transitions, setTransitions] = useState<StateTransitionEvent[]>([]);

  // Real Socket.IO Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Persistent Roadmap & Brainstorm State
  const [roadmapMonths, setRoadmapMonths] = useState<RoadmapMonth[]>(loadRoadmap);
  const [brainstormIdeas, setBrainstormIdeas] = useState<BrainstormIdea[]>(loadBrainstorm);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    try {
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(roadmapMonths));
    } catch {
      // ignore storage quota
    }
  }, [roadmapMonths]);

  useEffect(() => {
    try {
      localStorage.setItem(BRAINSTORM_STORAGE_KEY, JSON.stringify(brainstormIdeas));
    } catch {
      // ignore storage quota
    }
  }, [brainstormIdeas]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Initialize Real 2-User WebRTC + Socket.IO Manager once
  useEffect(() => {
    const manager = new NetAdaptWebRTCManager(DEFAULT_NQS_CONFIG, {
      onPhaseChange: (phase, detail) => {
        setLivePhase(phase);
        if (phase === 'connected') {
          setSamples([]);
          setTransitions([]);
          showToast('2nd user connected — live WebRTC P2P & real getStats() active');
        } else if (phase === 'room_full' && detail) {
          showToast(detail);
        }
      },
      onPeersChange: (selfId, peers) => {
        setSelfSocketId(selfId);
        setSignalingPeers(peers);
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
      },
      onChatHistory: (history) => {
        setMessages((prev) => {
          const merged = [...prev];
          for (const h of history) {
            if (!merged.some((m) => m.id === h.id)) {
              merged.push({
                id: h.id,
                sender: h.sender,
                isSelf: false,
                text: h.text,
                time: h.time,
              });
            }
          }
          return merged;
        });
      },
      onChatMessage: (incoming) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [
            ...prev,
            {
              id: incoming.id,
              sender: incoming.sender,
              isSelf: incoming.senderId === rtcSelfIdRef.current,
              text: incoming.text,
              time: incoming.time,
            },
          ];
        });
      },
      onLiveTelemetry: (sample, transition) => {
        setSamples((prev) => [...prev.slice(-299), sample]);
        if (transition) {
          setTransitions((prev) => [transition, ...prev.slice(0, 49)]);
        }
      },
      onIceRestart: () => {
        showToast('Network interruption detected — triggered ICE Restart');
      },
    });

    rtcManagerRef.current = manager;
    return () => {
      manager.destroy();
      rtcManagerRef.current = null;
      localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [showToast]);

  const rtcSelfIdRef = useRef<string>('');
  useEffect(() => {
    rtcSelfIdRef.current = selfSocketId;
  }, [selfSocketId]);

  // Keep manager config & mode synchronized
  useEffect(() => {
    rtcManagerRef.current?.updateConfig(nqsConfig);
  }, [nqsConfig]);

  useEffect(() => {
    rtcManagerRef.current?.setMode(mode).catch(() => {});
  }, [mode]);

  // Connect & join Socket.IO room whenever active in workspace (not in Landing view)
  useEffect(() => {
    if (view === 'landing') {
      rtcManagerRef.current?.leave();
      setLivePhase('disconnected');
      setSignalingPeers([]);
      setRemoteStream(null);
      return;
    }

    // Keep URL ?room= synced without reloading
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }

    rtcManagerRef.current?.connectAndJoin({
      roomId,
      username,
      localStream: localStreamRef.current,
      micOn,
      camOn: camOn || screenSharing,
    });
  }, [view === 'landing', roomId]);

  // Solo Fault Simulation Loop: runs ONLY when not connected to a real 2nd peer
  useEffect(() => {
    if (isPaused || livePhase === 'connected') return;
    const interval = window.setInterval(() => {
      const result = stepTelemetryEngine(engineRef.current, activeScenario, mode, nqsConfig);
      engineRef.current = result.nextEngine;
      setSamples((prev) => [...prev.slice(-299), result.sample]);
      if (result.transition) {
        setTransitions((prev) => [result.transition!, ...prev.slice(0, 49)]);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeScenario, mode, nqsConfig, isPaused, livePhase]);

  const stopStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const handleToggleCam = useCallback(async () => {
    if (camOn) {
      // Turn camera off while keeping audio track if micOn
      const currentAudio = localStreamRef.current?.getAudioTracks()[0] || null;
      localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());

      let nextStream: MediaStream | null = null;
      if (currentAudio && currentAudio.readyState === 'live') {
        nextStream = new MediaStream([currentAudio]);
      }
      localStreamRef.current = nextStream;
      setLocalStream(nextStream);
      setCamOn(false);
      setCameraError(null);
      await rtcManagerRef.current?.replaceLocalMedia(nextStream, micOn, false);
      return;
    }

    setScreenSharing(false);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Unavailable in this browser');
      setCamOn(false);
      showToast('Camera API unavailable in this browser context');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      stream.getAudioTracks().forEach((tr) => {
        tr.enabled = micOn;
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCamOn(true);
      setCameraError(null);
      await rtcManagerRef.current?.replaceLocalMedia(stream, micOn, true);
      showToast('Camera & mic streaming live');
    } catch {
      // Fallback: try video-only if mic fails
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        localStreamRef.current = videoOnly;
        setLocalStream(videoOnly);
        setCamOn(true);
        setCameraError(null);
        await rtcManagerRef.current?.replaceLocalMedia(videoOnly, micOn, true);
        showToast('Camera streaming live (video-only)');
      } catch {
        setCameraError('Permission denied');
        setCamOn(false);
        showToast('Camera permission denied — remote video still works receive-only');
      }
    }
  }, [camOn, micOn, stopStream, showToast]);

  const handleToggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      stopStream();
      setScreenSharing(false);
      await rtcManagerRef.current?.replaceLocalMedia(null, micOn, false);
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast('Screen sharing is not supported in this browser context');
      return;
    }

    try {
      const currentAudio = localStreamRef.current?.getAudioTracks()[0] || null;
      localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());

      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      const tracks: MediaStreamTrack[] = [];
      if (screenTrack) tracks.push(screenTrack);
      if (currentAudio && currentAudio.readyState === 'live') tracks.push(currentAudio);

      const combined = new MediaStream(tracks);
      if (screenTrack) {
        screenTrack.onended = () => {
          setScreenSharing(false);
          stopStream();
          rtcManagerRef.current?.replaceLocalMedia(null, micOn, false).catch(() => {});
        };
      }

      localStreamRef.current = combined;
      setLocalStream(combined);
      setCamOn(false);
      setScreenSharing(true);
      await rtcManagerRef.current?.replaceLocalMedia(combined, micOn, true);
      showToast('Sharing screen to remote peer');
    } catch {
      showToast('Screen share cancelled');
    }
  }, [screenSharing, micOn, stopStream, showToast]);

  const handleToggleMic = useCallback(async () => {
    const nextMic = !micOn;
    setMicOn(nextMic);

    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach((tr) => {
          tr.enabled = nextMic;
        });
        await rtcManagerRef.current?.replaceLocalMedia(
          localStreamRef.current,
          nextMic,
          camOn || screenSharing
        );
        showToast(nextMic ? 'Microphone unmuted' : 'Microphone muted');
        return;
      }
    }

    // If unmuting without an active audio track yet, acquire microphone track cleanly
    if (nextMic && navigator.mediaDevices?.getUserMedia) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
          const existingVideo = localStreamRef.current?.getVideoTracks()[0] || null;
          const combined = new MediaStream(
            existingVideo ? [existingVideo, audioTrack] : [audioTrack]
          );
          localStreamRef.current = combined;
          setLocalStream(combined);
          await rtcManagerRef.current?.replaceLocalMedia(
            combined,
            true,
            camOn || screenSharing
          );
        }
      } catch {
        // Silent fallback if mic blocked
      }
    } else {
      await rtcManagerRef.current?.replaceLocalMedia(
        localStreamRef.current,
        nextMic,
        camOn || screenSharing
      );
    }

    showToast(nextMic ? 'Microphone unmuted' : 'Microphone muted');
  }, [micOn, camOn, screenSharing, showToast]);

  const handleToggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'ADAPTIVE' ? 'BASELINE' : 'ADAPTIVE';
      showToast(
        next === 'ADAPTIVE'
          ? 'Adaptive NQS controller enabled'
          : 'Baseline WebRTC mode (adaptive controller bypassed)'
      );
      return next;
    });
  }, [showToast]);

  const handleSelectScenario = useCallback(
    (id: FaultScenarioId) => {
      setActiveScenario(id);
      engineRef.current = { ...engineRef.current, scenarioSec: 0 };
      showToast(`Fault profile switched to ${id.replace('_', ' ')}`);
    },
    [showToast]
  );

  const handleExportCsv = useCallback(() => {
    if (samples.length === 0) return;
    exportTelemetryToCsv(samples, roomId);
    showToast(`Exported ${samples.length} telemetry samples to CSV`);
  }, [samples, roomId, showToast]);

  const handleResetSamples = useCallback(() => {
    engineRef.current = createInitialEngineState();
    setSamples([]);
    setTransitions([]);
    showToast('Telemetry buffer cleared');
  }, [showToast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (isTyping || paletteOpen || view === 'landing') return;

      const key = e.key.toLowerCase();
      if (key === 'm' && view === 'meeting') {
        e.preventDefault();
        handleToggleMic();
      } else if (key === 'v' && view === 'meeting') {
        e.preventDefault();
        handleToggleCam();
      } else if (key === 'a') {
        e.preventDefault();
        handleToggleMode();
      } else if (key === 'e') {
        e.preventDefault();
        handleExportCsv();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen, view, handleToggleMic, handleToggleCam, handleToggleMode, handleExportCsv]);

  const latestSample: TelemetrySample = samples[samples.length - 1] || initialSeed.samples[0];

  const remotePeerRecord = useMemo(
    () => signalingPeers.find((p) => p.socketId !== selfSocketId) || null,
    [signalingPeers, selfSocketId]
  );

  const participants: ParticipantInfo[] = useMemo(() => {
    if (signalingPeers.length > 0) {
      return signalingPeers.map((p, index) => ({
        id: p.socketId,
        name: p.username,
        role: index === 0 ? 'Host' : 'Remote Peer',
        isSelf: p.socketId === selfSocketId,
        micOn: p.socketId === selfSocketId ? micOn : p.micOn,
        camOn: p.socketId === selfSocketId ? camOn || screenSharing : p.camOn,
        connectionType: latestSample.connectionType,
        qualityState: latestSample.qualityState,
      }));
    }
    return [
      {
        id: 'peer-self',
        name: username || 'You',
        role: 'Host',
        isSelf: true,
        micOn,
        camOn: camOn || screenSharing,
        connectionType: latestSample.connectionType,
        qualityState: latestSample.qualityState,
      },
    ];
  }, [
    signalingPeers,
    selfSocketId,
    username,
    micOn,
    camOn,
    screenSharing,
    latestSample.connectionType,
    latestSample.qualityState,
  ]);

  const handleCopyRoom = () => {
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopiedRoom(true);
    showToast(`Copied room code ${roomId}`);
    window.setTimeout(() => setCopiedRoom(false), 1600);
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
      roomId
    )}`;
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    showToast(`Copied invite link for ${roomId} — open in another tab or device`);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleSendMessage = (text: string) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const time = formatNowTime();
    setMessages((prev) => [
      ...prev,
      {
        id,
        sender: username || 'You',
        isSelf: true,
        text,
        time,
      },
    ]);
    rtcManagerRef.current?.sendChatMessage(id, text, time);
  };

  const handleToggleRoadmapTask = (monthNum: number, taskId: string) => {
    setRoadmapMonths((prev) =>
      prev.map((m) =>
        m.month !== monthNum
          ? m
          : {
              ...m,
              tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
            }
      )
    );
  };

  const handleTogglePinIdea = (id: string) => {
    setBrainstormIdeas((prev) =>
      prev.map((idea) => (idea.id === id ? { ...idea, pinned: !idea.pinned } : idea))
    );
  };

  const handleAddIdea = (idea: Omit<BrainstormIdea, 'id' | 'pinned'>) => {
    setBrainstormIdeas((prev) => [
      { ...idea, id: `bs-${Date.now()}`, pinned: true },
      ...prev,
    ]);
    showToast('Added idea to Months 6–12 brainstorm backlog');
  };

  const sparklinePath = useMemo(() => {
    const pts = samples.slice(-24).map((s) => s.smoothNqs);
    if (pts.length < 2) return 'M 0 18 L 160 18';
    return pts
      .map((val, idx) => {
        const x = (idx / (pts.length - 1)) * 160;
        const y = 30 - (Math.min(100, Math.max(0, val)) / 100) * 26;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [samples]);

  if (view === 'landing') {
    return (
      <>
        <LandingView
          username={username}
          onChangeUsername={setUsername}
          onCreateMeeting={(code) => {
            setMessages([]);
            setRoomId(code);
            setView('meeting');
            showToast(`Created room ${code}`);
          }}
          onJoinMeeting={(code) => {
            setMessages([]);
            setRoomId(code);
            setView('meeting');
            showToast(`Joined room ${code}`);
          }}
          onNavigateWorkspace={(targetView) => setView(targetView)}
        />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={setView}
          mode={mode}
          onToggleMode={handleToggleMode}
          activeScenario={activeScenario}
          onSelectScenario={handleSelectScenario}
          onExportCsv={handleExportCsv}
          canExportCsv={samples.length > 0}
        />
      </>
    );
  }

  const navItems: { id: WorkspaceView; label: string; icon: React.ReactNode }[] = [
    { id: 'meeting', label: 'Meeting', icon: <Video className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <Activity className="w-4 h-4" /> },
    { id: 'roadmap', label: 'Roadmap', icon: <Compass className="w-4 h-4" /> },
    { id: 'brainstorm', label: 'Brainstorm', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'architecture', label: 'DB & Scale', icon: <Database className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const viewTitles: Record<Exclude<WorkspaceView, 'landing'>, string> = {
    meeting: 'Meeting Studio',
    analytics: 'Analytics & Fault Lab',
    roadmap: '12-Month Roadmap',
    brainstorm: '7-Month Brainstorm',
    architecture: 'Database & Scale Blueprint',
    settings: 'Settings & Calibration',
  };

  const stateColor =
    latestSample.qualityState === 'GOOD'
      ? 'text-emerald-400'
      : latestSample.qualityState === 'MODERATE'
      ? 'text-amber-400'
      : 'text-rose-400';

  const stateLabel =
    latestSample.qualityState === 'GOOD'
      ? '● Good'
      : latestSample.qualityState === 'MODERATE'
      ? '▲ Moderate'
      : '✖ Poor';

  const connectionBanner =
    livePhase === 'connected'
      ? latestSample.connectionType === 'P2P'
        ? { text: '● Live P2P', cls: 'text-emerald-400' }
        : { text: '▲ Live TURN Relay', cls: 'text-amber-400' }
      : livePhase === 'negotiating'
      ? { text: '▲ Connecting Peer...', cls: 'text-blue-400' }
      : livePhase === 'room_full'
      ? { text: '✖ Room Full (2/2)', cls: 'text-rose-400' }
      : { text: '● Signaling Ready (1/2)', cls: 'text-zinc-400' };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex">
      {/* Slim Collapsible Obsidian Navigation Rail */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 bg-[#0D0D10] border-r border-zinc-800/90 transition-all duration-150 ${
          railCollapsed ? 'w-16' : 'w-[228px]'
        }`}
      >
        <div className="p-3 space-y-5">
          <div className="flex items-center justify-between px-1.5 h-9">
            <button
              type="button"
              onClick={() => setView('landing')}
              className="flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity"
              title="Return to NetAdapt Lobby"
            >
              <BrandMark className="w-6 h-6 shrink-0" />
              {!railCollapsed && (
                <span className="font-display text-[15px] font-semibold tracking-tight text-zinc-100 truncate">
                  NetAdapt
                </span>
              )}
            </button>

            {!railCollapsed && (
              <button
                type="button"
                onClick={() => setRailCollapsed(true)}
                aria-label="Collapse sidebar"
                className="p-1 text-zinc-500 hover:text-zinc-200 rounded transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {railCollapsed && (
            <button
              type="button"
              onClick={() => setRailCollapsed(false)}
              aria-label="Expand sidebar"
              className="w-full flex justify-center py-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-800/60 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          <nav className="space-y-1" aria-label="Workspace navigation">
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  title={railCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  } ${railCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!railCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-zinc-800/70">
            <button
              type="button"
              onClick={() => setView('landing')}
              title={railCollapsed ? 'Pre-Call Lobby' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors whitespace-nowrap ${
                railCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <Home className="w-3.5 h-3.5 shrink-0" />
              {!railCollapsed && <span>Pre-Call Lobby</span>}
            </button>
          </div>
        </div>

        {/* Bottom-Left Live Network Quality Sparkline Widget */}
        <div className="p-3">
          {railCollapsed ? (
            <button
              type="button"
              onClick={() => setView('analytics')}
              title={`Network Quality: ${latestSample.qualityState} (NQS ${latestSample.smoothNqs})`}
              className="w-full py-2.5 rounded-lg bg-[#111114] border border-zinc-800 flex flex-col items-center gap-1 hover:border-zinc-700"
            >
              <span className={`font-mono tabular-nums text-xs font-semibold ${stateColor}`}>
                {Math.round(latestSample.smoothNqs)}
              </span>
              <span className="text-[9px] font-mono text-zinc-500">NQS</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setView('analytics')}
              className="w-full text-left p-3.5 rounded-xl bg-[#111114] border border-zinc-800 hover:border-zinc-700 transition-colors space-y-2.5"
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Network Quality</span>
                <span className="font-mono tabular-nums text-zinc-500">
                  {livePhase === 'connected' ? 'LIVE' : 'M5 / 12'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`font-mono text-xs font-semibold ${stateColor}`}>
                  {stateLabel}
                </span>
                <span className="font-mono tabular-nums text-xs text-zinc-300">
                  {Math.round(latestSample.smoothNqs)}
                </span>
              </div>

              <svg viewBox="0 0 160 32" className="w-full h-7 overflow-visible block">
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-zinc-800/90 bg-[#09090B] px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex md:hidden items-center gap-2 shrink-0">
              <BrandMark className="w-5 h-5" />
            </div>

            {view === 'meeting' ? (
              <div className="flex items-center gap-3 min-w-0 text-xs">
                <button
                  type="button"
                  onClick={handleCopyRoom}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111114] border border-zinc-800 hover:border-zinc-700 font-mono text-zinc-200 transition-colors whitespace-nowrap"
                >
                  <span>Room: {roomId}</span>
                  {copiedRoom ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </button>

                <span className="hidden sm:inline text-zinc-600" aria-hidden="true">
                  ·
                </span>

                <span className={`hidden sm:inline font-mono whitespace-nowrap ${connectionBanner.cls}`}>
                  {connectionBanner.text}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-zinc-400 truncate">
                <span className="text-zinc-500 hidden sm:inline">NetAdapt</span>
                <span className="text-zinc-600 hidden sm:inline">/</span>
                <span className="text-zinc-100 font-medium truncate">{viewTitles[view]}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {view === 'meeting' && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 pr-2 border-r border-zinc-800">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-mono tabular-nums">
                  {participants.length} / 2 Participants
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111114] border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap"
              title="Open Command Palette (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quick Jump</span>
              <kbd className="font-mono text-[10px] text-zinc-500 border border-zinc-800 rounded px-1">
                ⌘K
              </kbd>
            </button>

            {view === 'meeting' && (
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </header>

        <nav
          className="flex md:hidden items-center gap-1 overflow-x-auto px-3 py-2 border-b border-zinc-800/80 bg-[#0D0D10]"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                view === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1440px] mx-auto h-full">
            {view === 'meeting' && (
              <MeetingView
                roomId={roomId}
                username={username}
                micOn={micOn}
                camOn={camOn}
                screenSharing={screenSharing}
                localStream={localStream}
                remoteStream={remoteStream}
                remoteName={remotePeerRecord?.username || 'Waiting for Peer 2'}
                remoteCamOn={remotePeerRecord?.camOn ?? false}
                remoteMicOn={remotePeerRecord?.micOn ?? true}
                livePhase={livePhase}
                cameraError={cameraError}
                onToggleMic={handleToggleMic}
                onToggleCam={handleToggleCam}
                onToggleScreenShare={handleToggleScreenShare}
                onCopyInviteLink={handleCopyInviteLink}
                onLeaveCall={() => {
                  rtcManagerRef.current?.leave();
                  stopStream();
                  setCamOn(false);
                  setScreenSharing(false);
                  setView('landing');
                  showToast('Left meeting room');
                }}
                sample={latestSample}
                sampleCount={samples.length}
                mode={mode}
                onToggleMode={handleToggleMode}
                activeScenario={activeScenario}
                onSelectScenario={handleSelectScenario}
                onExportCsv={handleExportCsv}
                messages={messages}
                onSendMessage={handleSendMessage}
                participants={participants}
              />
            )}

            {view === 'analytics' && (
              <AnalyticsView
                samples={samples}
                transitions={transitions}
                mode={mode}
                onToggleMode={handleToggleMode}
                activeScenario={activeScenario}
                onSelectScenario={handleSelectScenario}
                isPaused={isPaused}
                onTogglePause={() => setIsPaused((p) => !p)}
                onResetSamples={handleResetSamples}
                onExportCsv={handleExportCsv}
                config={nqsConfig}
              />
            )}

            {view === 'roadmap' && (
              <RoadmapView
                months={roadmapMonths}
                onToggleTask={handleToggleRoadmapTask}
              />
            )}

            {view === 'brainstorm' && (
              <BrainstormView
                ideas={brainstormIdeas}
                onTogglePin={handleTogglePinIdea}
                onAddIdea={handleAddIdea}
              />
            )}

            {view === 'architecture' && <ArchitectureView />}

            {view === 'settings' && (
              <SettingsView
                config={nqsConfig}
                onChangeConfig={setNqsConfig}
                onResetDefaults={() => {
                  setNqsConfig(DEFAULT_NQS_CONFIG);
                  showToast('Restored default paper NQS weights & thresholds');
                }}
                roomId={roomId}
              />
            )}
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={setView}
        mode={mode}
        onToggleMode={handleToggleMode}
        activeScenario={activeScenario}
        onSelectScenario={handleSelectScenario}
        onExportCsv={handleExportCsv}
        canExportCsv={samples.length > 0}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-lg bg-[#18181B] border border-zinc-700 text-xs text-zinc-100 shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
