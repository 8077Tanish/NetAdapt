import React, { useMemo, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { RoadmapMonth, TrackName } from '../types/netadapt';

interface RoadmapViewProps {
  months: RoadmapMonth[];
  onToggleTask: (monthNumber: number, taskId: string) => void;
}

const TRACKS: ('All' | TrackName)[] = [
  'All',
  'Networking',
  'Algorithm',
  'Testing',
  'Frontend & AR',
  'Database & Scale',
];

export const RoadmapView: React.FC<RoadmapViewProps> = ({ months, onToggleTask }) => {
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(6);
  const [trackFilter, setTrackFilter] = useState<'All' | TrackName>('All');

  const selectedMonth =
    months.find((m) => m.month === selectedMonthNum) || months[5] || months[0];

  const stats = useMemo(() => {
    const allTasks = months.flatMap((m) => m.tasks);
    const doneTasks = allTasks.filter((t) => t.done).length;
    const m1To5Tasks = months.filter((m) => m.month <= 5).flatMap((m) => m.tasks);
    const m1To5Done = m1To5Tasks.filter((t) => t.done).length;
    const m6To12Tasks = months.filter((m) => m.month >= 6).flatMap((m) => m.tasks);
    const m6To12Done = m6To12Tasks.filter((t) => t.done).length;
    return {
      totalPct: Math.round((doneTasks / Math.max(1, allTasks.length)) * 100),
      doneTasks,
      totalTasks: allTasks.length,
      m1To5Done,
      m1To5Total: m1To5Tasks.length,
      m6To12Done,
      m6To12Total: m6To12Tasks.length,
    };
  }, [months]);

  const visibleTasks = useMemo(() => {
    if (trackFilter === 'All') return selectedMonth.tasks;
    return selectedMonth.tasks.filter((t) => t.track === trackFilter);
  }, [selectedMonth, trackFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">12-Month Engineering Roadmap</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Months 1–5 foundation completed (P2P WebRTC + NQS engine). Months 6–12 planned for UI polish, AR, PostgreSQL/TimescaleDB/Redis, Mesh/SFU, and viva validation.
          </p>
        </div>

        <div className="flex items-center gap-5 text-xs font-mono tabular-nums text-zinc-400 shrink-0">
          <div>
            <span className="text-zinc-500">M1–M5: </span>
            <span className="text-emerald-400">
              {stats.m1To5Done}/{stats.m1To5Total}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">M6–M12: </span>
            <span className="text-zinc-200">
              {stats.m6To12Done}/{stats.m6To12Total}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Overall: </span>
            <span className="text-blue-400 font-semibold">{stats.totalPct}%</span>
          </div>
        </div>
      </div>

      {/* Track Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#111114] border border-zinc-800 rounded-lg">
          {TRACKS.map((track) => (
            <button
              key={track}
              type="button"
              onClick={() => setTrackFilter(track)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                trackFilter === track
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {track}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          Click any month below to inspect deliverables and check off tasks
        </span>
      </div>

      {/* 12-Month Grid Selector (Clearly Distinguishing M1–M5 vs M6–M12) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {months.map((m) => {
          const isSelected = m.month === selectedMonth.month;
          const doneCount = m.tasks.filter((t) => t.done).length;
          const allDone = doneCount === m.tasks.length && m.tasks.length > 0;
          const isPastOrCurrent = m.month <= 5;
          const matchesTrack =
            trackFilter === 'All' ||
            m.primaryTrack === trackFilter ||
            m.tasks.some((t) => t.track === trackFilter);

          return (
            <button
              key={m.month}
              type="button"
              onClick={() => setSelectedMonthNum(m.month)}
              className={`p-3.5 rounded-xl border text-left transition-colors ${
                isSelected
                  ? 'bg-[#18181B] border-blue-500 text-zinc-100'
                  : 'bg-[#111114] border-zinc-800 hover:border-zinc-700 text-zinc-300'
              } ${!matchesTrack ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isSelected ? 'text-blue-400' : 'text-zinc-500'}>
                  Month {String(m.month).padStart(2, '0')}
                </span>
                <span
                  className={
                    allDone
                      ? 'text-emerald-400'
                      : m.month === 5
                      ? 'text-blue-400'
                      : 'text-zinc-500'
                  }
                >
                  {doneCount}/{m.tasks.length}
                </span>
              </div>
              <div className="text-xs font-medium text-zinc-100 mt-1.5 line-clamp-2 leading-snug">
                {m.title}
              </div>
              <div className="text-[11px] text-zinc-500 mt-2">
                {allDone
                  ? '● Done'
                  : m.month === 5
                  ? '▲ Active'
                  : isPastOrCurrent
                  ? 'In Review'
                  : 'Planned'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Month Deep Dive Panel */}
      <div className="bg-[#111114] border border-zinc-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-zinc-800/80">
          <div className="space-y-1">
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              <span className="font-mono text-zinc-300">
                Month {String(selectedMonth.month).padStart(2, '0')} of 12
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedMonth.phase}</span>
              <span aria-hidden="true">·</span>
              <span>Primary Track: {selectedMonth.primaryTrack}</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">{selectedMonth.title}</h2>
            <p className="text-sm text-zinc-400">{selectedMonth.focus}</p>
          </div>

          <div className="text-xs font-mono text-zinc-400 shrink-0">
            {selectedMonth.month <= 5 ? (
              <span className="text-emerald-400">● Foundation Milestone</span>
            ) : (
              <span className="text-amber-400">▲ Remaining 7-Month Horizon</span>
            )}
          </div>
        </div>

        {/* Exit Criteria & Dependencies */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1">
            <div className="text-zinc-500 font-medium">Measurable Exit Criteria</div>
            <p className="text-zinc-300 leading-relaxed">{selectedMonth.exitCriteria}</p>
          </div>
          <div className="space-y-1">
            <div className="text-zinc-500 font-medium">Technical Dependencies</div>
            <p className="text-zinc-300 leading-relaxed">{selectedMonth.dependencies}</p>
          </div>
        </div>

        {/* Interactive Checklist */}
        <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-zinc-400">
              Deliverables ({visibleTasks.filter((t) => t.done).length}/{visibleTasks.length}{' '}
              complete)
            </h3>
            <span className="text-[11px] text-zinc-500">Saved automatically to browser</span>
          </div>

          {visibleTasks.length === 0 ? (
            <div className="py-6 text-xs text-zinc-500">
              No tasks under the “{trackFilter}” track in Month {selectedMonth.month}. Switch filter
              to All to view every deliverable.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/70">
              {visibleTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onToggleTask(selectedMonth.month, task.id)}
                  className="w-full py-3 flex items-start justify-between gap-4 text-left hover:bg-zinc-900/50 px-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {task.done ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-zinc-600" />
                      )}
                    </span>
                    <span
                      className={`text-sm ${
                        task.done ? 'text-zinc-400 line-through' : 'text-zinc-100'
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-zinc-500 whitespace-nowrap shrink-0">
                    {task.track}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
