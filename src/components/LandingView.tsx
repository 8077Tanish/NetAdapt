import React, { useEffect, useState } from 'react';
import { ArrowRight, Compass, Database, Link2, Video } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { WorkspaceView } from '../types/netadapt';

interface LandingViewProps {
  username: string;
  onChangeUsername: (name: string) => void;
  onCreateMeeting: (roomCode: string) => void;
  onJoinMeeting: (roomCode: string) => void;
  onNavigateWorkspace: (view: WorkspaceView) => void;
}

function generateRoomCode(): string {
  const num = Math.floor(100 + Math.random() * 900);
  return `room-${num}`;
}

export const LandingView: React.FC<LandingViewProps> = ({
  username,
  onChangeUsername,
  onCreateMeeting,
  onJoinMeeting,
  onNavigateWorkspace,
}) => {
  const [joinCode, setJoinCode] = useState('room-101');
  const [preflightState, setPreflightState] = useState<'checking' | 'ready'>('checking');

  useEffect(() => {
    const timer = window.setTimeout(() => setPreflightState('ready'), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinCode.trim() || 'room-101';
    onJoinMeeting(trimmed);
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="w-full border-b border-zinc-800/80 bg-[#09090B]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <BrandMark className="w-6 h-6" />
            <span className="font-display text-base font-semibold tracking-tight text-zinc-100">
              NetAdapt
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
            <button
              type="button"
              onClick={() => onNavigateWorkspace('analytics')}
              className="hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
            >
              Analytics
            </button>
            <button
              type="button"
              onClick={() => onNavigateWorkspace('roadmap')}
              className="hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
            >
              12-Month Plan
            </button>
            <button
              type="button"
              onClick={() => onNavigateWorkspace('brainstorm')}
              className="hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
            >
              Brainstorm
            </button>
            <button
              type="button"
              onClick={() => onNavigateWorkspace('architecture')}
              className="hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
            >
              Database & Scale
            </button>
          </nav>

          <button
            type="button"
            onClick={() => onJoinMeeting(joinCode.trim() || 'room-101')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <span>Enter Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Centered Split Stage */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left: Hero & Meeting Entry */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              <span>P2P Adaptive WebRTC</span>
              <span aria-hidden="true">·</span>
              <span>Month 5 of 12</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-zinc-400">
                {preflightState === 'checking'
                  ? 'Checking STUN & media...'
                  : 'STUN reachable · Local engine ready'}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-50 leading-[1.1]">
              Video Calls That <span className="text-blue-500">Adapt</span> to Your Network
            </h1>

            <p className="text-base text-zinc-400 max-w-xl leading-relaxed">
              Direct peer-to-peer WebRTC conferencing powered by real-time Network Quality Scoring,
              EMA smoothing, and hysteresis bitrate control—paired with your team’s Months 6–12
              engineering roadmap.
            </p>
          </div>

          {/* Minimalist Create / Join Controls */}
          <div className="max-w-lg space-y-3 pt-1">
            <div>
              <label htmlFor="landing-username" className="block text-xs text-zinc-500 mb-1.5">
                Display name
              </label>
              <input
                id="landing-username"
                type="text"
                value={username}
                onChange={(e) => onChangeUsername(e.target.value)}
                placeholder="Your name"
                className="w-full px-3.5 py-2.5 text-sm bg-[#111114] border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <form onSubmit={handleJoinSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => onCreateMeeting(generateRoomCode())}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Video className="w-4 h-4" />
                <span>Create Meeting</span>
              </button>

              <div className="flex-1 flex items-center bg-[#111114] border border-zinc-800 rounded-lg focus-within:border-blue-500 transition-colors">
                <Link2 className="w-4 h-4 text-zinc-500 ml-3 shrink-0" />
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="room-101"
                  aria-label="Room ID"
                  className="w-full px-2.5 py-2.5 bg-transparent text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 mr-1 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Join
                </button>
              </div>
            </form>
          </div>

          {/* 3 Quiet Core Capability Columns (No Pill Clutter) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-zinc-800/80">
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-100">Direct P2P Media</div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Low-latency WebRTC over UDP with STUN/TURN fallback and ICE Restart recovery.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-100">Hysteresis NQS Engine</div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                1Hz stats collector with EMA smoothing and seamless <span className="font-mono">setParameters()</span> scaling.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-100">Months 6–12 Blueprint</div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                MediaPipe AR pipeline, multi-party Mesh/SFU, and PostgreSQL + TimescaleDB + Redis.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Single-Elevation Studio Summary Panel */}
        <div className="lg:col-span-5">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">1-Year Engineering Progress</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Months 1–5 completed · 7 months remaining
                </p>
              </div>
              <span className="font-mono tabular-nums text-sm font-medium text-zinc-200">
                42%
              </span>
            </div>

            {/* Clean Progress Bar */}
            <div className="space-y-2">
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full w-[42%] bg-blue-500 rounded-full" />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                <span>M1 Signaling</span>
                <span className="text-zinc-300">M5 Current</span>
                <span>M12 Viva Launch</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-300">P2P WebRTC & ICE Restart</span>
                <span className="font-mono text-emerald-400">● Done (M1–M2)</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-300">NQS + EMA + Hysteresis FSM</span>
                <span className="font-mono text-emerald-400">● Done (M3–M4)</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-300">Obsidian Studio UI & Hub</span>
                <span className="font-mono text-blue-400">▲ Active (M5)</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-300">MediaPipe AR Canvas Pipeline</span>
                <span className="font-mono text-zinc-500">Planned (M7)</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">PostgreSQL + TimescaleDB + Redis</span>
                <span className="font-mono text-zinc-500">Planned (M8)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigateWorkspace('roadmap')}
                className="px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Compass className="w-3.5 h-3.5 text-zinc-400" />
                <span>View Roadmap</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateWorkspace('architecture')}
                className="px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Database className="w-3.5 h-3.5 text-zinc-400" />
                <span>DB Blueprint</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
