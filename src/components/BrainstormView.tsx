import React, { useMemo, useState } from 'react';
import { Bookmark, Plus, Search, X } from 'lucide-react';
import {
  BrainstormHorizon,
  BrainstormIdea,
  BrainstormPillar,
  TrackName,
} from '../types/netadapt';

interface BrainstormViewProps {
  ideas: BrainstormIdea[];
  onTogglePin: (id: string) => void;
  onAddIdea: (idea: Omit<BrainstormIdea, 'id' | 'pinned'>) => void;
}

const PILLARS: ('All' | BrainstormPillar)[] = ['All', 'Features', 'UX Flows', 'Research'];
const HORIZONS: ('All' | BrainstormHorizon)[] = [
  'All',
  'M6–M7 Near-Term',
  'M8–M10 Core Scale',
  'M11–M12 Polish & Future',
];

export const BrainstormView: React.FC<BrainstormViewProps> = ({
  ideas,
  onTogglePin,
  onAddIdea,
}) => {
  const [pillar, setPillar] = useState<'All' | BrainstormPillar>('All');
  const [horizon, setHorizon] = useState<'All' | BrainstormHorizon>('All');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Add Idea Form State
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newPillar, setNewPillar] = useState<BrainstormPillar>('Features');
  const [newHorizon, setNewHorizon] = useState<BrainstormHorizon>('M6–M7 Near-Term');
  const [newImpact, setNewImpact] = useState<'High' | 'Medium'>('High');
  const [newEffort, setNewEffort] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [newTrack, setNewTrack] = useState<TrackName>('Frontend & AR');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas
      .filter((item) => (pillar === 'All' ? true : item.pillar === pillar))
      .filter((item) => (horizon === 'All' ? true : item.horizon === horizon))
      .filter((item) => (pinnedOnly ? item.pinned : true))
      .filter((item) =>
        q
          ? item.title.toLowerCase().includes(q) ||
            item.summary.toLowerCase().includes(q) ||
            item.ownerTrack.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [ideas, pillar, horizon, pinnedOnly, query]);

  const handleSubmitIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSummary.trim()) return;
    onAddIdea({
      title: newTitle.trim(),
      summary: newSummary.trim(),
      pillar: newPillar,
      horizon: newHorizon,
      impact: newImpact,
      effort: newEffort,
      ownerTrack: newTrack,
    });
    setNewTitle('');
    setNewSummary('');
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            7-Month Feature, UX & Research Brainstorm
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Structured ideas for Months 6–12 so your team can pin priorities, remember long-term improvements, and add new concepts anytime.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Idea</span>
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-[#111114] border border-zinc-800 rounded-lg">
            {PILLARS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPillar(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  pillar === p ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as 'All' | BrainstormHorizon)}
            aria-label="Filter by horizon"
            className="px-3 py-2 text-xs bg-[#111114] border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h} className="bg-[#111114]">
                {h === 'All' ? 'All Horizons (M6–M12)' : h}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setPinnedOnly((v) => !v)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              pinnedOnly
                ? 'bg-blue-600/15 border-blue-500/50 text-blue-300'
                : 'bg-[#111114] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Pinned Only</span>
          </button>
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter brainstorm ideas..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#111114] border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Idea List (Clean Single-Elevation Grid, Zero Pill Sandwiches) */}
      {filtered.length === 0 ? (
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-10 text-center space-y-2">
          <div className="text-sm font-medium text-zinc-200">No matching ideas</div>
          <p className="text-xs text-zinc-500">
            Adjust your pillar, horizon, or search filter—or add a new brainstorm concept.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="bg-[#111114] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-zinc-700 transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-1.5">
                      <span className="text-zinc-300 font-medium">{item.pillar}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.horizon}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.ownerTrack}</span>
                    </div>
                    <h2 className="text-sm font-semibold text-zinc-100">{item.title}</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => onTogglePin(item.id)}
                    aria-label={item.pinned ? 'Unpin idea' : 'Pin idea'}
                    title={item.pinned ? 'Pinned priority' : 'Pin as priority'}
                    className={`p-1.5 rounded-md transition-colors shrink-0 ${
                      item.pinned
                        ? 'text-blue-400 bg-blue-500/10'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" fill={item.pinned ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{item.summary}</p>
              </div>

              <div className="pt-3 border-t border-zinc-800/70 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>
                  Impact:{' '}
                  <span className={item.impact === 'High' ? 'text-emerald-400' : 'text-zinc-300'}>
                    {item.impact}
                  </span>
                </span>
                <span>Effort: {item.effort}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Add Idea Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Add brainstorm idea"
        >
          <form
            onSubmit={handleSubmitIdea}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#111114] border border-zinc-800 rounded-xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-semibold text-zinc-100">Add Months 6–12 Idea</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-200"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Idea Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., WebCodecs AV1 Fallback for Ultra-Low Bandwidth"
                  className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Engineering Rationale & Scope
                </label>
                <textarea
                  rows={3}
                  required
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Describe why this strengthens NetAdapt and how it fits the remaining 7 months..."
                  className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Pillar</label>
                  <select
                    value={newPillar}
                    onChange={(e) => setNewPillar(e.target.value as BrainstormPillar)}
                    className="w-full px-3 py-2 text-xs bg-[#09090B] border border-zinc-800 rounded-lg text-zinc-100"
                  >
                    <option value="Features">Features</option>
                    <option value="UX Flows">UX Flows</option>
                    <option value="Research">Research</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Target Horizon</label>
                  <select
                    value={newHorizon}
                    onChange={(e) => setNewHorizon(e.target.value as BrainstormHorizon)}
                    className="w-full px-3 py-2 text-xs bg-[#09090B] border border-zinc-800 rounded-lg text-zinc-100"
                  >
                    <option value="M6–M7 Near-Term">M6–M7 Near-Term</option>
                    <option value="M8–M10 Core Scale">M8–M10 Core Scale</option>
                    <option value="M11–M12 Polish & Future">M11–M12 Polish & Future</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Owner Track</label>
                  <select
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value as TrackName)}
                    className="w-full px-3 py-2 text-xs bg-[#09090B] border border-zinc-800 rounded-lg text-zinc-100"
                  >
                    <option value="Networking">Networking</option>
                    <option value="Algorithm">Algorithm</option>
                    <option value="Testing">Testing</option>
                    <option value="Frontend & AR">Frontend & AR</option>
                    <option value="Database & Scale">Database & Scale</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Impact</label>
                    <select
                      value={newImpact}
                      onChange={(e) => setNewImpact(e.target.value as 'High' | 'Medium')}
                      className="w-full px-2 py-2 text-xs bg-[#09090B] border border-zinc-800 rounded-lg text-zinc-100"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Effort</label>
                    <select
                      value={newEffort}
                      onChange={(e) => setNewEffort(e.target.value as 'Low' | 'Medium' | 'High')}
                      className="w-full px-2 py-2 text-xs bg-[#09090B] border border-zinc-800 rounded-lg text-zinc-100"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Save to Backlog
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
