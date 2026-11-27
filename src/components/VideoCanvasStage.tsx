import React, { useEffect, useRef } from 'react';
import { MicOff, Monitor, VideoOff } from 'lucide-react';
import { TelemetrySample } from '../types/netadapt';

interface VideoCanvasStageProps {
  username: string;
  remoteName: string;
  micOn: boolean;
  camOn: boolean;
  screenSharing: boolean;
  localStream: MediaStream | null;
  cameraError: string | null;
  sample: TelemetrySample;
  arPreviewOverlay: boolean;
}

/**
 * Renders the main 16:9 remote peer stage (visually demonstrating real-time resolution scaling,
 * FPS cadence, and Baseline freeze vs Adaptive smoothness) plus the top-right Picture-in-Picture
 * local camera/screen stream.
 */
export const VideoCanvasStage: React.FC<VideoCanvasStageProps> = ({
  username,
  remoteName,
  micOn,
  camOn,
  screenSharing,
  localStream,
  cameraError,
  sample,
  arPreviewOverlay,
}) => {
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const sampleRef = useRef<TelemetrySample>(sample);

  useEffect(() => {
    sampleRef.current = sample;
  }, [sample]);

  // Attach real MediaStream to local PiP video element when available
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

  // Render adaptive remote peer stream responding faithfully to live FPS, resolution scale, & freezes
  useEffect(() => {
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
      const targetFps = Math.max(1, current.fps);
      const frameInterval = current.isFrozen ? 1400 : 1000 / targetFps;

      if (now - lastDrawTime < frameInterval) return;
      lastDrawTime = now;

      if (!current.isFrozen) {
        phase += 0.045 * (30 / Math.max(10, targetFps));
      }

      // Scale internal buffer to visually reflect 720p (1x), 360p (2x), or 240p (4x)
      const renderScale = current.scaleFactor >= 4 ? 0.34 : current.scaleFactor >= 2 ? 0.56 : 1;
      const w = Math.max(240, Math.round(960 * renderScale));
      const h = Math.max(135, Math.round(540 * renderScale));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // Calm obsidian studio room backdrop
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#14151A');
      bg.addColorStop(0.55, '#101116');
      bg.addColorStop(1, '#0B0C10');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle architectural backdrop grid lines (studio acoustics panel feel)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const step = Math.round(w / 12);
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Subtle warm studio rim light behind speaker silhouette
      const glowX = w * 0.5 + Math.sin(phase * 0.5) * (w * 0.015);
      const glowY = h * 0.44;
      const radial = ctx.createRadialGradient(glowX, glowY, w * 0.03, glowX, glowY, w * 0.38);
      radial.addColorStop(0, 'rgba(59, 130, 246, 0.14)');
      radial.addColorStop(0.55, 'rgba(39, 39, 42, 0.12)');
      radial.addColorStop(1, 'rgba(9, 9, 11, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, w, h);

      // Minimalist geometric remote peer figure + live audio waveform halo
      const cx = w * 0.5;
      const cy = h * 0.46;
      const breath = Math.sin(phase) * (h * 0.008);

      // Voice activity concentric hairline rings (audio remains active even in POOR video!)
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

      // Shoulders silhouette
      ctx.beginPath();
      ctx.ellipse(cx, cy + h * 0.25 + breath, w * 0.14, h * 0.16, 0, Math.PI, Math.PI * 2);
      ctx.fillStyle = '#1E2028';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = Math.max(1, w * 0.0015);
      ctx.stroke();

      // Head avatar disk with crisp monogram
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

      // Live calibrated oscilloscope wave along lower stage showing frame cadence continuity
      ctx.beginPath();
      const waveY = h * 0.8;
      const waveW = w * 0.36;
      const startX = cx - waveW / 2;
      for (let i = 0; i <= 48; i++) {
        const px = startX + (waveW * i) / 48;
        const envelope = Math.sin((i / 48) * Math.PI);
        const py =
          waveY +
          Math.sin(phase * 2.4 + i * 0.38) * (h * 0.022) * envelope * voiceAmp;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = current.isFrozen ? 'rgba(244, 63, 94, 0.6)' : 'rgba(96, 165, 250, 0.55)';
      ctx.lineWidth = Math.max(1.2, w * 0.002);
      ctx.stroke();

      // Visual packet-loss artifact lines only when severe baseline freeze happens
      if (current.isFrozen) {
        ctx.fillStyle = 'rgba(9, 9, 11, 0.45)';
        ctx.fillRect(0, 0, w, h);
      }
    };

    animId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animId);
  }, [remoteName]);

  const adaptationNotice =
    sample.isRecovering
      ? 'ICE Restart active — re-establishing media path'
      : sample.isFrozen
      ? 'Frame stall detected — Baseline WebRTC congestion'
      : sample.mode === 'ADAPTIVE' && sample.qualityState !== 'GOOD'
      ? `Adapting video to ${sample.resolution} · ${sample.fps} fps to protect audio`
      : null;

  return (
    <div className="relative w-full aspect-video bg-[#0E0E12] border border-zinc-800 rounded-xl overflow-hidden select-none">
      {/* Remote Peer Adaptive Stream Canvas */}
      <canvas
        ref={remoteCanvasRef}
        className="w-full h-full object-cover block"
        style={{ imageRendering: sample.scaleFactor >= 4 ? 'pixelated' : 'auto' }}
      />

      {/* Subtle Measured Contrast Scrim at Bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

      {/* Top-Left Stream Technical Readout (Unboxed quiet telemetry) */}
      <div className="absolute top-3.5 left-4 flex items-center gap-2 text-[11px] font-mono tabular-nums text-zinc-300 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/10">
        <span>{sample.resolution}</span>
        <span className="text-zinc-500">·</span>
        <span>{sample.fps} fps</span>
        <span className="text-zinc-500">·</span>
        <span>
          {sample.bitrateKbps >= 1000
            ? `${(sample.bitrateKbps / 1000).toFixed(2)} Mbps`
            : `${sample.bitrateKbps} kbps`}
        </span>
      </div>

      {/* Calm Inline Degradation / Recovery Notice */}
      {adaptationNotice && (
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-black/75 border border-zinc-700/80 text-xs text-zinc-200 whitespace-nowrap max-w-[90%] truncate">
          {adaptationNotice}
        </div>
      )}

      {/* Top-Right Picture-in-Picture Local Preview Tile (Matches NetAdapt Mockup) */}
      <div className="absolute top-3.5 right-3.5 w-36 sm:w-48 aspect-video bg-[#131419] border border-zinc-700/80 rounded-lg overflow-hidden shadow-lg">
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
              <Monitor className="w-5 h-5 text-blue-400" />
            ) : (
              <VideoOff className="w-4 h-4 text-zinc-500" />
            )}
            <span className="text-[11px] text-zinc-400 px-2 text-center truncate max-w-full">
              {cameraError ? 'Preview simulated' : 'Camera off'}
            </span>
          </div>
        )}

        {/* Local AR Mesh Landmark Guide Overlay (explicitly labeled Month 7 Canvas Hook preview) */}
        {arPreviewOverlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-blue-950/15">
            <div className="w-16 h-20 rounded-full border border-dashed border-cyan-400/70 flex items-end justify-center pb-1">
              <span className="text-[9px] font-mono text-cyan-300 bg-black/70 px-1 rounded">
                M7 Hook
              </span>
            </div>
          </div>
        )}

        {/* PiP Bottom Label */}
        <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[11px] text-zinc-200">
          <span className="truncate flex items-center gap-1">
            {!micOn && <MicOff className="w-3 h-3 text-rose-400 shrink-0" />}
            <span>{username || 'You'}</span>
          </span>
          {screenSharing && <span className="font-mono text-[10px] text-blue-400">Screen</span>}
        </div>
      </div>

      {/* Bottom-Left Remote Participant Label */}
      <div className="absolute bottom-3.5 left-4 flex items-center gap-2 text-xs font-medium text-zinc-100">
        <span>{remoteName}</span>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-400 font-normal">Remote Peer</span>
      </div>

      {/* Bottom-Right Mode Label */}
      <div className="absolute bottom-3.5 right-4 text-[11px] font-mono text-zinc-400">
        {sample.mode === 'ADAPTIVE' ? 'Adaptive Control Active' : 'Baseline WebRTC'}
      </div>
    </div>
  );
};
