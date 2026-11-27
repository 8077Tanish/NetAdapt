import React, { useMemo } from 'react';
import { Download, Pause, Play, RotateCcw } from 'lucide-react';
import { FAULT_SCENARIOS } from '../algorithm/nqsEngine';
import {
  AdaptationMode,
  FaultScenarioId,
  NQSConfig,
  StateTransitionEvent,
  TelemetrySample,
} from '../types/netadapt';

interface AnalyticsViewProps {
  samples: TelemetrySample[];
  transitions: StateTransitionEvent[];
  mode: AdaptationMode;
  onToggleMode: () => void;
  activeScenario: FaultScenarioId;
  onSelectScenario: (id: FaultScenarioId) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onResetSamples: () => void;
  onExportCsv: () => void;
  config: NQSConfig;
}

interface LineSeries {
  values: number[];
  color: string;
  label: string;
  dashed?: boolean;
}

const TelemetrySvgChart: React.FC<{
  title: string;
  unit: string;
  minY: number;
  maxY: number;
  series: LineSeries[];
  thresholds?: { value: number; label: string; color: string }[];
}> = ({ title, unit, minY, maxY, series, thresholds = [] }) => {
  const width = 560;
  const height = 164;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 20;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const toY = (v: number) => {
    const clamped = Math.min(maxY, Math.max(minY, v));
    return padT + innerH - ((clamped - minY) / (maxY - minY || 1)) * innerH;
  };

  const count = Math.max(series[0]?.values.length || 0, 2);

  const buildPath = (vals: number[]) => {
    if (vals.length === 0) return '';
    return vals
      .map((v, i) => {
        const x = padL + (i / Math.max(1, count - 1)) * innerW;
        const y = toY(v);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
          <span className="text-[11px] font-mono text-zinc-500">{unit}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-0.5 inline-block"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40 block overflow-visible"
        role="img"
        aria-label={title}
      >
        {/* Horizontal Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const val = minY + (maxY - minY) * t;
          const y = toY(val);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="#27272A"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fill="#71717A"
                fontSize="9.5"
                fontFamily="JetBrains Mono, monospace"
              >
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Threshold reference lines */}
        {thresholds.map((th) => {
          const y = toY(th.value);
          return (
            <g key={th.label}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke={th.color}
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.65"
              />
              <text
                x={width - padR - 2}
                y={y - 3}
                textAnchor="end"
                fill={th.color}
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                {th.label}
              </text>
            </g>
          );
        })}

        {/* Series curves */}
        {series.map((s) => (
          <path
            key={s.label}
            d={buildPath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.dashed ? 1.3 : 1.9}
            strokeDasharray={s.dashed ? '4 3' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  samples,
  transitions,
  mode,
  onToggleMode,
  activeScenario,
  onSelectScenario,
  isPaused,
  onTogglePause,
  onResetSamples,
  onExportCsv,
  config,
}) => {
  const recent = samples.slice(-60);

  const summary = useMemo(() => {
    if (samples.length === 0) {
      return {
        avgNqs: 0,
        avgFps: 0,
        avgRtt: 0,
        freezeCount: 0,
        avgMos: 0,
        switchesPerMin: 0,
      };
    }
    const len = samples.length;
    const avgNqs = samples.reduce((a, b) => a + b.smoothNqs, 0) / len;
    const avgFps = samples.reduce((a, b) => a + b.fps, 0) / len;
    const avgRtt = samples.reduce((a, b) => a + b.rttMs, 0) / len;
    const avgMos = samples.reduce((a, b) => a + b.mosEstimate, 0) / len;
    const freezeCount = samples.filter((s) => s.fps < 5).length;
    const minutes = Math.max(1 / 60, len / 60);
    const switchesPerMin = transitions.length / minutes;

    return {
      avgNqs,
      avgFps,
      avgRtt,
      freezeCount,
      avgMos,
      switchesPerMin,
    };
  }, [samples, transitions]);

  return (
    <div className="space-y-6">
      {/* Header & Experiment Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Analytics & Experimental Fault Lab
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Live 1Hz time-series comparison across the 7 Clumsy / <span className="font-mono text-zinc-300">tc netem</span> validation scenarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Mode Control */}
          <div className="inline-flex items-center p-1 bg-[#111114] border border-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => mode !== 'BASELINE' && onToggleMode()}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'BASELINE'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Baseline WebRTC
            </button>
            <button
              type="button"
              onClick={() => mode !== 'ADAPTIVE' && onToggleMode()}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'ADAPTIVE'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Adaptive Algorithm
            </button>
          </div>

          <button
            type="button"
            onClick={onTogglePause}
            className="px-3 py-2 text-xs font-medium bg-[#111114] hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            type="button"
            onClick={onResetSamples}
            className="px-3 py-2 text-xs font-medium bg-[#111114] hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            disabled={samples.length === 0}
            className="px-3.5 py-2 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 7-Scenario Selector Strip */}
      <div className="space-y-2">
        <div className="text-xs text-zinc-500">
          Active Network Scenario (switch live to observe Baseline stalls vs Adaptive stabilization)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {FAULT_SCENARIOS.map((sc) => {
            const active = sc.id === activeScenario;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => onSelectScenario(sc.id)}
                className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  active
                    ? 'bg-blue-600/15 border-blue-500/60 text-zinc-100'
                    : 'bg-[#111114] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div className="font-mono text-[10px] text-zinc-500">Scenario {sc.code}</div>
                <div className="text-xs font-medium mt-0.5 truncate">{sc.shortLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Strip (Flat Single Elevation, Tabular Monospace) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-zinc-800 rounded-xl bg-[#111114] divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 overflow-hidden">
        <div className="p-4">
          <div className="text-xs text-zinc-500">Avg Smooth NQS</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-zinc-100 mt-1">
            {summary.avgNqs.toFixed(1)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-zinc-500">Avg Frame Rate</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-zinc-100 mt-1">
            {summary.avgFps.toFixed(1)}
            <span className="text-xs text-zinc-500 font-normal ml-1">fps</span>
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-zinc-500">Avg RTT</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-zinc-100 mt-1">
            {summary.avgRtt.toFixed(0)}
            <span className="text-xs text-zinc-500 font-normal ml-1">ms</span>
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-zinc-500">Freeze Ticks (&lt;5 fps)</div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1 ${
              summary.freezeCount > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {summary.freezeCount}
            <span className="text-xs text-zinc-500 font-normal ml-1">s</span>
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-zinc-500">Switches / Min</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-zinc-100 mt-1">
            {summary.switchesPerMin.toFixed(1)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-zinc-500">E-Model MOS</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-blue-400 mt-1">
            {summary.avgMos.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Multi-Channel Live SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TelemetrySvgChart
          title="Network Quality Score (Raw vs EMA Smooth)"
          unit="0–100 · Last 60s"
          minY={0}
          maxY={100}
          series={[
            { values: recent.map((s) => s.nqs), color: '#52525B', label: 'Raw NQS', dashed: true },
            { values: recent.map((s) => s.smoothNqs), color: '#06B6D4', label: 'EMA Smooth' },
          ]}
          thresholds={[
            { value: config.upgradeToGoodThreshold, label: `↑GOOD ${config.upgradeToGoodThreshold}`, color: '#10B981' },
            { value: config.downgradeToModerateThreshold, label: `↓MOD ${config.downgradeToModerateThreshold}`, color: '#F59E0B' },
            { value: config.downgradeToPoorThreshold, label: `↓POOR ${config.downgradeToPoorThreshold}`, color: '#F43F5E' },
          ]}
        />

        <TelemetrySvgChart
          title="Outgoing Bitrate & Frame Cadence"
          unit="kbps / FPS · Last 60s"
          minY={0}
          maxY={2200}
          series={[
            { values: recent.map((s) => s.bitrateKbps), color: '#3B82F6', label: 'Bitrate (kbps)' },
            { values: recent.map((s) => s.fps * 60), color: '#10B981', label: 'FPS (×60 scale)' },
          ]}
        />

        <TelemetrySvgChart
          title="Round-Trip Latency & Jitter"
          unit="ms · Last 60s"
          minY={0}
          maxY={450}
          series={[
            { values: recent.map((s) => s.rttMs), color: '#60A5FA', label: 'RTT (ms)' },
            { values: recent.map((s) => s.jitterMs), color: '#F59E0B', label: 'Jitter (ms)' },
          ]}
        />

        {/* Hysteresis State Transition Audit Log */}
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <h3 className="text-sm font-medium text-zinc-100">Hysteresis FSM Transition Log</h3>
            <span className="font-mono text-[11px] text-zinc-500">
              {transitions.length} events
            </span>
          </div>

          {transitions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 text-xs text-zinc-500 text-center">
              State is stable. Select Low Bandwidth, Packet Loss, or Fluctuating Network above to observe hold-timer transitions.
            </div>
          ) : (
            <div className="flex-1 max-h-44 overflow-y-auto divide-y divide-zinc-800/60 mt-1">
              {transitions.slice(0, 12).map((tr) => (
                <div
                  key={tr.id}
                  className="py-2 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-zinc-200">
                      {tr.fromState} →{' '}
                      <span
                        className={
                          tr.toState === 'GOOD'
                            ? 'text-emerald-400'
                            : tr.toState === 'MODERATE'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }
                      >
                        {tr.toState}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">{tr.reason}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums text-[11px] text-zinc-400 shrink-0">
                    <div>T+{tr.elapsedSec}s</div>
                    <div className="text-zinc-500">NQS {tr.smoothNqs}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
