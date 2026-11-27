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

function formatNowTime(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function seedInitialTelemetry(config: NQSConfig): {
  engine: EngineState;
  samples: TelemetrySample[];
} {
  let engine = createInitialEngineState();
  const samples: TelemetrySample[] = [];
  for (let i = 0; i < 18; i++) {
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
  const [roomId, setRoomId] = useState('room-101');
  const [username, setUsername] = useState('You');
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Local media controls (real WebRTC getUserMedia / getDisplayMedia with graceful fallback)
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // NQS Adaptation Engine State
  const [nqsConfig, setNqsConfig] = useState<NQSConfig>(DEFAULT_NQS_CONFIG);
  const [mode, setMode] = useState<AdaptationMode>('ADAPTIVE');
  const [activeScenario, setActiveScenario] = useState<FaultScenarioId>('normal');
  const [isPaused, setIsPaused] = useState(false);

  const initialSeed = useMemo(() => seedInitialTelemetry(DEFAULT_NQS_CONFIG), []);
  const engineRef = useRef<EngineState>(initialSeed.engine);
  const [samples, setSamples] = useState<TelemetrySample[]>(initialSeed.samples);
  const [transitions, setTransitions] = useState<StateTransitionEvent[]>([]);

  // Chat messages (seeded with realistic NetAdapt reference context)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'Sarah',
      isSelf: false,
      text: 'Looks great! P2P stream is locked at 720p.',
      time: '8:24 PM',
    },
    {
      id: 'msg-2',
      sender: 'You',
      isSelf: true,
      text: 'Perfect — trying Low Bandwidth fault next.',
      time: '8:25 PM',
    },
  ]);

  // Persistent Roadmap & Brainstorm State
  const [roadmapMonths, setRoadmapMonths] = useState<RoadmapMonth[]>(loadRoadmap);
  const [brainstormIdeas, setBrainstormIdeas] = useState<BrainstormIdea[]>(loadBrainstorm);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
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

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Sync fullscreen document state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Continuous 1Hz Telemetry & Hysteresis Engine Loop
  useEffect(() => {
    if (isPaused) return;
    const interval = window.setInterval(() => {
      const result = stepTelemetryEngine(engineRef.current, activeScenario, mode, nqsConfig);
      engineRef.current = result.nextEngine;
      setSamples((prev) => [...prev.slice(-299), result.sample]);
      if (result.transition) {
        setTransitions((prev) => [result.transition!, ...prev.slice(0, 49)]);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeScenario, mode, nqsConfig, isPaused]);

  const stopStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const handleToggleCam = useCallback(async () => {
    if (camOn) {
      if (!screenSharing) stopStream();
      setCamOn(false);
      setCameraError(null);
      return;
    }

    setScreenSharing(false);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Unavailable in this browser');
      setCamOn(true);
      showToast('Camera API unavailable — running simulated PiP preview');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCamOn(true);
      setCameraError(null);
    } catch {
      setCameraError('Permission denied');
      setCamOn(false);
      showToast('Camera permission blocked — keeping local preview simulated');
    }
  }, [camOn, screenSharing, stopStream, showToast]);

  const handleToggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      stopStream();
      setScreenSharing(false);
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast('Screen sharing is not supported in this browser context');
      return;
    }

    try {
      stopStream();
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setScreenSharing(false);
          stopStream();
        };
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCamOn(false);
      setScreenSharing(true);
      showToast('Screen share active on local track');
    } catch {
      showToast('Screen share cancelled');
    }
  }, [screenSharing, stopStream, showToast]);

  const handleToggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      showToast(next ? 'Microphone unmuted' : 'Microphone muted');
      return next;
    });
  }, [showToast]);

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

  // Global high-performance keyboard shortcuts
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

  const participants: ParticipantInfo[] = useMemo(
    () => [
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
      {
        id: 'peer-sarah',
        name: 'Sarah',
        role: 'Remote Peer',
        isSelf: false,
        micOn: true,
        camOn: true,
        connectionType: latestSample.connectionType,
        qualityState: latestSample.qualityState,
      },
    ],
    [username, micOn, camOn, screenSharing, latestSample.connectionType, latestSample.qualityState]
  );

  const handleCopyRoom = () => {
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopiedRoom(true);
    showToast(`Copied room code ${roomId}`);
    window.setTimeout(() => setCopiedRoom(false), 1600);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleSendMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: username || 'You',
        isSelf: true,
        text,
        time: formatNowTime(),
      },
    ]);
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

  // Bottom-Left Sparkline Path (Honoring NetAdapt Mockup)
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
            setRoomId(code);
            setView('meeting');
            showToast(`Created room ${code}`);
          }}
          onJoinMeeting={(code) => {
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

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex">
      {/* Slim Collapsible Obsidian Navigation Rail */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 bg-[#0D0D10] border-r border-zinc-800/90 transition-all duration-150 ${
          railCollapsed ? 'w-16' : 'w-[228px]'
        }`}
      >
        <div className="p-3 space-y-5">
          {/* Brand Row */}
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

          {/* Primary Nav Links */}
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

          {/* Quiet Lobby Link */}
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

        {/* Bottom-Left Live Network Quality Sparkline Widget (Honors NetAdapt Reference) */}
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
                  M5 / 12
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

      {/* Main Column: Top Bar + Active View Canvas */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Top Bar */}
        <header className="h-14 shrink-0 border-b border-zinc-800/90 bg-[#09090B] px-4 lg:px-6 flex items-center justify-between gap-4">
          {/* Left Zone: Room ID in Meeting View, Breadcrumb in Hub Views */}
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

                <span className="hidden sm:inline font-mono text-emerald-400 whitespace-nowrap">
                  {latestSample.connectionType === 'P2P'
                    ? '● P2P Connection'
                    : '▲ TURN Relay'}
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

          {/* Right Zone: Contextual Info + High-Performance ⌘K Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            {view === 'meeting' && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 pr-2 border-r border-zinc-800">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-mono tabular-nums">
                  {participants.length} Participants
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

        {/* Mobile Compact View Bar (Strict <= 15% Viewport Height) */}
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

        {/* Active View Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1440px] mx-auto h-full">
            {view === 'meeting' && (
              <MeetingView
                username={username}
                micOn={micOn}
                camOn={camOn}
                screenSharing={screenSharing}
                localStream={localStream}
                cameraError={cameraError}
                onToggleMic={handleToggleMic}
                onToggleCam={handleToggleCam}
                onToggleScreenShare={handleToggleScreenShare}
                onLeaveCall={() => {
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

      {/* Global Command Palette */}
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

      {/* Quiet Toast Feedback */}
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
