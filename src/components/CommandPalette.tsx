import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Compass,
  Database,
  Download,
  Lightbulb,
  Search,
  Settings,
  Sliders,
  Video,
  Zap,
} from 'lucide-react';
import { FAULT_SCENARIOS } from '../algorithm/nqsEngine';
import { AdaptationMode, FaultScenarioId, WorkspaceView } from '../types/netadapt';

interface CommandItem {
  id: string;
  group: 'Navigation' | 'Call & Telemetry' | 'Network Fault Scenarios';
  label: string;
  hint?: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: WorkspaceView) => void;
  mode: AdaptationMode;
  onToggleMode: () => void;
  activeScenario: FaultScenarioId;
  onSelectScenario: (id: FaultScenarioId) => void;
  onExportCsv: () => void;
  canExportCsv: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
  mode,
  onToggleMode,
  activeScenario,
  onSelectScenario,
  onExportCsv,
  canExportCsv,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: CommandItem[] = useMemo(() => {
    const navItems: CommandItem[] = [
      {
        id: 'nav-meeting',
        group: 'Navigation',
        label: 'Meeting Room',
        hint: 'Live video stage, chat & docked network HUD',
        shortcut: 'G M',
        icon: <Video className="w-4 h-4 text-zinc-400" />,
        action: () => onNavigate('meeting'),
      },
      {
        id: 'nav-analytics',
        group: 'Navigation',
        label: 'Analytics & Fault Lab',
        hint: 'Live NQS, Bitrate, FPS, RTT & transition logs',
        shortcut: 'G A',
        icon: <Activity className="w-4 h-4 text-zinc-400" />,
        action: () => onNavigate('analytics'),
      },
      {
        id: 'nav-roadmap',
        group: 'Navigation',
        label: '12-Month Roadmap',
        hint: 'Months 1–5 completed vs Months 6–12 plan',
        shortcut: 'G R',
        icon: <Compass className="w-4 h-4 text-zinc-400" />,
        action: () => onNavigate('roadmap'),
      },
      {
        id: 'nav-brainstorm',
        group: 'Navigation',
        label: '7-Month Brainstorm Lab',
        hint: 'Features, UX flows & research backlog',
        shortcut: 'G B',
        icon: <Lightbulb className="w-4 h-4 text-zinc-400" />,
        action: () => onNavigate('brainstorm'),
      },
      {
        id: 'nav-arch',
        group: 'Navigation',
        label: 'Database & Scale Blueprint',
        hint: 'PostgreSQL 16 + TimescaleDB + Redis 7 schemas',
        shortcut: 'G D',
        icon: <Database className="w-4 h-4 text-zinc-400" />,
        action: () => onNavigate('architecture'),
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        label: 'Settings & NQS Calibration',
        hint: 'Tune w1–w4 weights, EMA alpha & hysteresis',
        shortcut: 'G S',
        icon: <Settings className="w-4 h-4 text-zinc-400" />,
        action: () => onNavigate('settings'),
      },
      {
        id: 'nav-landing',
        group: 'Navigation',
        label: 'Lobby & Create Meeting',
        hint: 'Pre-call entry & room code generator',
        icon: <Sliders className="w-4 h-4 text-zinc-400" />,
        action: () => onNavigate('landing'),
      },
    ];

    const actionItems: CommandItem[] = [
      {
        id: 'act-toggle-mode',
        group: 'Call & Telemetry',
        label: `Switch to ${mode === 'ADAPTIVE' ? 'Baseline WebRTC' : 'Adaptive Algorithm'} Mode`,
        hint: `Currently running ${mode === 'ADAPTIVE' ? 'Adaptive' : 'Baseline'}`,
        shortcut: 'A',
        icon: <Zap className="w-4 h-4 text-blue-400" />,
        action: onToggleMode,
      },
      {
        id: 'act-export-csv',
        group: 'Call & Telemetry',
        label: 'Download Recorded Telemetry CSV',
        hint: canExportCsv ? 'Exports Member 3 benchmark format' : 'Collecting initial samples...',
        shortcut: 'E',
        icon: <Download className="w-4 h-4 text-zinc-400" />,
        action: () => {
          if (canExportCsv) onExportCsv();
        },
      },
    ];

    const faultItems: CommandItem[] = FAULT_SCENARIOS.map((sc) => ({
      id: `fault-${sc.id}`,
      group: 'Network Fault Scenarios',
      label: `Inject Scenario ${sc.code}: ${sc.label}`,
      hint: `${sc.simulatedParams}${activeScenario === sc.id ? ' · Active' : ''}`,
      icon: <Activity className="w-4 h-4 text-amber-400" />,
      action: () => onSelectScenario(sc.id),
    }));

    return [...navItems, ...actionItems, ...faultItems];
  }, [mode, activeScenario, canExportCsv, onNavigate, onToggleMode, onSelectScenario, onExportCsv]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.hint && item.hint.toLowerCase().includes(q)) ||
        item.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, selectedIndex, onClose]);

  if (!open) return null;

  const groups: CommandItem['group'][] = [
    'Navigation',
    'Call & Telemetry',
    'Network Fault Scenarios',
  ];

  let runningIdx = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-[12vh] px-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to workspace, inject network fault, or toggle Adaptive Mode..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <kbd className="text-[11px] font-mono text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5 shrink-0">
            ESC
          </kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No matching command for “{query}”.
            </div>
          ) : (
            groups.map((groupName) => {
              const groupItems = filtered.filter((item) => item.group === groupName);
              if (groupItems.length === 0) return null;
              return (
                <div key={groupName} className="mb-2 last:mb-0">
                  <div className="px-4 py-1.5 text-xs font-medium text-zinc-500">
                    {groupName}
                  </div>
                  {groupItems.map((item) => {
                    runningIdx += 1;
                    const idx = runningIdx;
                    const active = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                          active ? 'bg-zinc-800/80 text-zinc-50' : 'text-zinc-300 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="shrink-0">{item.icon}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{item.label}</div>
                            {item.hint && (
                              <div className="text-xs text-zinc-500 truncate">{item.hint}</div>
                            )}
                          </div>
                        </div>
                        {item.shortcut && (
                          <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 text-[11px] text-zinc-500">
          <span>Use ↑ ↓ to navigate · Enter to execute</span>
          <span className="font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
};
