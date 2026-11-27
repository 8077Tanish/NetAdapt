import React, { useEffect, useRef, useState } from 'react';
import { MicOff, Monitor, Signal, VideoOff } from 'lucide-react';
import { LiveConnectionPhase } from '../core/webrtcSession';
import { TelemetrySample } from '../types/netadapt';

interface VideoCanvasStageProps {
  username: string;
  remoteName: string;
  micOn: boolean;
  camOn: boolean;
  screenSharing: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteCamOn: boolean;
  remoteMicOn: boolean;
  livePhase: LiveConnectionPhase;
  cameraError: string | null;
  sample: TelemetrySample;
  arPreviewOverlay: boolean;
}

/**
 * Renders the main 16:9 remote stage:
 * - When a real 2nd peer is connected over WebRTC, displays their live <video> MediaStream (audio + video).
 * - When solo / waiting for Peer 2, runs the real-time adaptive canvas responder for solo NQS testing.
 * Top-right PiP always renders the real local webcam or screen-share stream.
 */
export const VideoCanvasStage: React.FC<VideoCanvasStageProps> = ({
  username,
  remoteName,
  micOn,
  camOn,
  screenSharing,
  localStream,
  remoteStream,
  remoteCamOn,
  remoteMicOn,
  livePhase,
  cameraError,
  sample,
  arPreviewOverlay,
}) => {
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const sampleRef = useRef<TelemetrySample>(sample);
  const [pingTooltipPinned, setPingTooltipPinned] = useState(false);

  const isLivePeerConnected = livePhase === 'connected';
  const hasRemoteVideoTrack = Boolean(
    remoteStream && remoteStream.getVideoTracks().some((t) => t.readyState === 'live')
  );
  const showLiveRemoteVideo = isLivePeerConnected && hasRemoteVideoTrack && remoteCamOn;

  useEffect(() => {
    sampleRef.current = sample;
  }, [sample]);

  // Attach real local MediaStream to PiP video element
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (localStream) {
      el.srcObject = localStream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [localStream, camOn, screenSharing]);

  // Attach real remote MediaStream to remote <video> element (plays remote audio + video)
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    if (remoteStream && isLivePeerConnected) {
      el.srcObject = remoteStream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [remoteStream, isLivePeerConnected]);

  // Render adaptive solo/avatar canvas whenever live remote video track isn't being displayed
  useEffect(() => {
    if (showLiveRemoteVideo) return;
    const canvas = remoteCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastDrawTime = 0;
    let phase = 0;

    const render = (now: number) => {
      animId = window.requestAnimationFrame(render);
      const current = sampleRef.current;
      const targetFps = Math.max(1, current.fps || 24);
      const frameInterval = current.isFrozen ? 1400 : 1000 / targetFps;

      if (now - lastDrawTime < frameInterval) return;
      lastDrawTime = now;

      if (!current.isFrozen) {
        phase += 0.045 * (30 / Math.max(10, targetFps));
      }

      const renderScale = current.scaleFactor >= 4 ? 0.34 : current.scaleFactor >= 2 ? 0.56 : 1;
      const w = Math.max(240, Math.round(960 * renderScale));
      const h = Math.max(135, Math.round(540 * renderScale));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#14151A');
      bg.addColorStop(0.55, '#101116');
      bg.addColorStop(1, '#0B0C10');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const step = Math.round(w / 12);
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      const glowX = w * 0.5 + Math.sin(phase * 0.5) * (w * 0.015);
      const glowY = h * 0.44;
      const radial = ctx.createRadialGradient(glowX, glowY, w * 0.03, glowX, glowY, w * 0.38);
      radial.addColorStop(0, 'rgba(59, 130, 246, 0.14)');
      radial.addColorStop(0.55, 'rgba(39, 39, 42, 0.12)');
      radial.addColorStop(1, 'rgba(9, 9, 11, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.46;
      const breath = Math.sin(phase) * (h * 0.008);

      const voiceAmp = current.isRecovering ? 0.3 : 0.65 + Math.abs(Math.sin(phase * 1.9)) * 0.55;
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const radius = h * (0.17 + rIdx * 0.055) + voiceAmp * (h * 0.018);
        ctx.beginPath();
        ctx.arc(cx, cy - h * 0.02 + breath, radius, 0, Math.PI * 2);
        ctx.strokeStyle =
          current.qualityState === 'GOOD'
            ? `rgba(16, 185, 129, ${0.18 - rIdx * 0.05})`
            : current.qualityState === 'MODERATE'
            ? `rgba(245, 158, 11, ${0.18 - rIdx * 0.05})`
            : `rgba(59, 130, 246, ${0.22 - rIdx * 0.05})`;
        ctx.lineWidth = Math.max(1, w * 0.0018);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.ellipse(cx, cy + h * 0.25 + breath, w * 0.14, h * 0.16, 0, Math.PI, Math.PI * 2);
      ctx.fillStyle = '#1E2028';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = Math.max(1, w * 0.0015);
      ctx.stroke();

      const headR = h * 0.115;
      ctx.beginPath();
      ctx.arc(cx, cy - h * 0.02 + breath, headR, 0, Math.PI * 2);
      ctx.fillStyle = '#232630';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      ctx.fillStyle = '#E4E4E7';
      ctx.font = `600 ${Math.round(headR * 0.72)}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(remoteName.slice(0, 1).toUpperCase(), cx, cy - h * 0.015 + breath);

      ctx.beginPath();
      const waveY = h * 0.8;
      const waveW = w * 0.36;
      const startX = cx - waveW / 2;
      for (let i = 0; i <= 48; i++) {
        const px = startX + (waveW * i) / 48;
        const envelope = Math.sin((i / 48) * Math.PI);
        const py = waveY + Math.sin(phase * 2.4 + i * 0.38) * (h * 0.022) * envelope * voiceAmp;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = current.isFrozen ? 'rgba(244, 63, 94, 0.6)' : 'rgba(96, 165, 250, 0.55)';
      ctx.lineWidth = Math.max(1.2, w * 0.002);
      ctx.stroke();

      if (current.isFrozen) {
        ctx.fillStyle = 'rgba(9, 9, 11, 0.45)';
        ctx.fillRect(0, 0, w, h);
      }
    };

    animId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animId);
  }, [remoteName, showLiveRemoteVideo]);

  const adaptationNotice =
    livePhase === 'negotiating'
      ? 'Exchanging SDP & ICE candidates with remote peer...'
      : livePhase === 'reconnecting'
      ? 'ICE Restart active — re-establishing P2P link'
      : livePhase === 'room_full'
      ? 'Room full (2-user P2P limit reached) — switch room ID'
      : sample.isRecovering
      ? 'ICE Restart active — re-establishing media path'
      : sample.isFrozen
      ? 'Frame stall detected — Baseline WebRTC congestion'
      : sample.mode === 'ADAPTIVE' && sample.qualityState !== 'GOOD'
      ? `Adapting video to ${sample.resolution} · ${sample.fps} fps to protect audio`
      : null;

  return (
    <div className="relative w-full aspect-video bg-[#0E0E12] border border-zinc-800 rounded-xl overflow-hidden select-none">
      {/* Real Remote WebRTC Video Element (always mounted when connected so remote audio plays even if camera is off) */}
      <video
        ref={remoteVideoRef}
        playsInline
        autoPlay
        className={`w-full h-full object-cover ${showLiveRemoteVideo ? 'block' : 'hidden'}`}
      />

      {/* Adaptive Canvas Stage (used when solo or when remote peer has camera off) */}
      {!showLiveRemoteVideo && (
        <canvas
          ref={remoteCanvasRef}
          className="w-full h-full object-cover block"
          style={{ imageRendering: sample.scaleFactor >= 4 ? 'pixelated' : 'auto' }}
        />
      )}

      {/* Subtle Measured Contrast Scrim at Bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

      {/* Top-Left Stream Technical Readout */}
      <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-4 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-mono tabular-nums text-zinc-300 bg-black/55 backdrop-blur-sm px-2 sm:px-2.5 py-1 rounded-md border border-white/10 max-w-[calc(100%-8.25rem)] sm:max-w-none truncate">
        <span>{sample.resolution}</span>
        <span className="text-zinc-500">·</span>
        <span>{sample.fps} fps</span>
        <span className="hidden sm:inline text-zinc-500">·</span>
        <span className="hidden sm:inline">
          {sample.bitrateKbps >= 1000
            ? `${(sample.bitrateKbps / 1000).toFixed(2)} Mbps`
            : `${sample.bitrateKbps} kbps`}
        </span>
      </div>

      {/* Calm Inline Status / Adaptation Notice */}
      {adaptationNotice && (
        <div className="hidden md:block absolute top-3.5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-black/75 border border-zinc-700/80 text-xs text-zinc-200 whitespace-nowrap max-w-[60%] truncate">
          {adaptationNotice}
        </div>
      )}

      {/* Top-Right Picture-in-Picture Local Preview Tile */}
      <div className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 w-28 sm:w-44 md:w-48 aspect-video bg-[#131419] border border-zinc-700/80 rounded-lg overflow-hidden shadow-lg">
        {localStream && (camOn || screenSharing) ? (
          <video
            ref={localVideoRef}
            muted
            playsInline
            autoPlay
            className={`w-full h-full object-cover ${screenSharing ? '' : 'scale-x-[-1]'}`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#14151B] text-zinc-500 gap-1">
            {screenSharing ? (
              <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            ) : (
              <VideoOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500" />
            )}
            <span className="text-[10px] sm:text-[11px] text-zinc-400 px-1.5 text-center truncate max-w-full">
              {cameraError ? 'No camera' : 'Camera off'}
            </span>
          </div>
        )}

        {arPreviewOverlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-blue-950/15">
            <div className="w-12 h-16 sm:w-16 sm:h-20 rounded-full border border-dashed border-cyan-400/70 flex items-end justify-center pb-1">
              <span className="text-[9px] font-mono text-cyan-300 bg-black/70 px-1 rounded">
                M7 Hook
              </span>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-200">
          <span className="truncate flex items-center gap-1">
            {!micOn && <MicOff className="w-3 h-3 text-rose-400 shrink-0" />}
            <span>{username || 'You'}</span>
          </span>
          {screenSharing && <span className="font-mono text-[10px] text-blue-400">Screen</span>}
        </div>
      </div>

      {/* Unified Bottom Bar: Remote Participant + Ping Tooltip (Left) & Mode (Right) */}
      <div className="absolute inset-x-3 sm:inset-x-4 bottom-2.5 sm:bottom-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-zinc-100 min-w-0">
          {isLivePeerConnected && !remoteMicOn && (
            <MicOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span className="truncate">{remoteName}</span>
          <span className="text-zinc-500 shrink-0">·</span>

          {/* Interactive Ping/Latency Overlay & Hover/Click Tooltip */}
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={() => setPingTooltipPinned((v) => !v)}
              onBlur={() => setPingTooltipPinned(false)}
              aria-label={`Remote peer ping ${sample.rttMs} milliseconds. Activate for WebRTC getStats details.`}
              aria-expanded={pingTooltipPinned}
              className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded bg-black/60 hover:bg-black/80 border border-white/10 font-mono tabular-nums text-[10px] sm:text-[11px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 whitespace-nowrap"
            >
              <Signal
                className={`w-3 h-3 shrink-0 ${
                  sample.rttMs <= 80
                    ? 'text-emerald-400'
                    : sample.rttMs <= 180
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              />
              <span
                className={
                  sample.rttMs <= 80
                    ? 'text-emerald-300'
                    : sample.rttMs <= 180
                    ? 'text-amber-300'
                    : 'text-rose-300'
                }
              >
                {sample.rttMs} ms
              </span>
            </button>

            {/* Non-intrusive Telemetry Tooltip */}
            <div
              role="tooltip"
              className={`absolute bottom-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mb-2 z-20 w-52 p-2.5 rounded-lg bg-[#111114]/95 backdrop-blur-md border border-zinc-800 shadow-xl transition-opacity duration-150 ${
                pingTooltipPinned
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800 text-[10px] font-mono text-zinc-400">
                <span>{isLivePeerConnected ? 'WebRTC getStats()' : 'Simulated Stats'}</span>
                <span
                  className={
                    sample.rttMs <= 80
                      ? 'text-emerald-400'
                      : sample.rttMs <= 180
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {sample.rttMs <= 80 ? 'Optimal' : sample.rttMs <= 180 ? 'Elevated' : 'High RTT'}
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Ping (RTT)</span>
                  <span className="text-zinc-100">{sample.rttMs} ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Jitter</span>
                  <span className="text-zinc-200">{sample.jitterMs} ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Packet Loss</span>
                  <span className="text-zinc-200">{sample.packetLossPct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Transport</span>
                  <span className="text-zinc-200">{sample.connectionType}</span>
                </div>
              </div>
            </div>
          </div>

          <span className="hidden lg:inline text-zinc-500 shrink-0">·</span>
          <span className="hidden lg:inline text-zinc-400 font-normal truncate">
            {isLivePeerConnected
              ? showLiveRemoteVideo
                ? 'Live WebRTC Video'
                : 'Live WebRTC (Camera off)'
              : 'Solo Fault Lab · Share invite link for 2nd user'}
          </span>
        </div>

        {/* Right Mode Label (Compact on mobile, full on sm+) */}
        <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 whitespace-nowrap shrink-0">
          <span className="sm:hidden">
            {sample.mode === 'ADAPTIVE' ? 'Adaptive' : 'Baseline'}
          </span>
          <span className="hidden sm:inline">
            {sample.mode === 'ADAPTIVE' ? 'Adaptive Control Active' : 'Baseline WebRTC'}
          </span>
        </div>
      </div>
    </div>
  );
};
