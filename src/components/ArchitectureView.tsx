import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  REDIS_KEYSPACE_SPEC,
  SOCKET_CONTRACT_SPEC,
  SQL_RELATIONAL_SCHEMA,
  SQL_TIMESCALEDB_SCHEMA,
} from '../data/projectData';

type SchemaTab = 'postgres' | 'timescaledb' | 'redis' | 'signaling';
type LayerKey = 'client' | 'signaling' | 'redis' | 'postgres' | 'timescaledb';

const LAYER_DETAILS: Record<
  LayerKey,
  { title: string; horizon: string; role: string; keyDesign: string }
> = {
  client: {
    title: 'NetAdapt Browser Client (WebRTC + Ring Buffer)',
    horizon: 'M1–M5 Done · M7 AR + M8 Buffer',
    role: 'Runs 1Hz pc.getStats() + NQS + Hysteresis locally for instant setParameters() video scaling without waiting on server round-trips.',
    keyDesign:
      'Buffers 1Hz telemetry rows in a lightweight ring buffer and flushes 5-second batches over HTTPS/WS so DB writes drop by 5–10x.',
  },
  signaling: {
    title: 'Stateless Socket.IO Signaling & Ingest Cluster',
    horizon: 'M1 Done · M6 Redis Adapter · M9 Mesh',
    role: 'Relays SDP offers, answers, ICE candidates, and chat while keeping media strictly peer-to-peer (or SFU for 5+ users).',
    keyDesign:
      'Zero in-memory room lock-in once backed by @socket.io/redis-adapter; also mints 10-minute HMAC-SHA1 Coturn TURN tokens in Month 10.',
  },
  redis: {
    title: 'Redis 7 (Presence, Pub/Sub & Stream Buffer)',
    horizon: 'M6–M8 Planned',
    role: 'Handles sub-millisecond room membership hashes, ICE candidate race queues, rate limiting, and telemetry burst absorption.',
    keyDesign:
      'XADD telemetry:ingest absorbs traffic spikes during multi-peer tests; a Node worker drains 500-row batches into TimescaleDB via bulk COPY.',
  },
  postgres: {
    title: 'PostgreSQL 16 (Relational OLTP Core)',
    horizon: 'M8 Planned',
    role: 'Stores authoritative users, room metadata, topology modes, call session summaries, NQS weight configs (JSONB), and experiment trial tags.',
    keyDesign:
      'Co-located with TimescaleDB in a single PostgreSQL engine so experiment_runs JOIN cleanly with call_telemetry_ticks using standard SQL.',
  },
  timescaledb: {
    title: 'TimescaleDB Hypertables (Time-Series Metrics)',
    horizon: 'M8 Planned · M11 Automated Benchmarks',
    role: 'Stores every 1Hz NetAdapt telemetry sample (RTT, Jitter, Loss, Bitrate, FPS, NQS, MOS) across long-running benchmark campaigns.',
    keyDesign:
      '1-day chunks, automatic columnar compression after 7 days (~90% storage reduction), 90-day retention drop, and 1-minute continuous rollups.',
  },
};

export const ArchitectureView: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<LayerKey>('timescaledb');
  const [schemaTab, setSchemaTab] = useState<SchemaTab>('timescaledb');
  const [copied, setCopied] = useState(false);

  // Interactive Capacity & Storage Estimator State
  const [concurrentCalls, setConcurrentCalls] = useState(50);
  const [avgPeersPerCall, setAvgPeersPerCall] = useState(2);
  const [dailyCalls, setDailyCalls] = useState(600);
  const [avgDurationMin, setAvgDurationMin] = useState(25);
  const [flushIntervalSec, setFlushIntervalSec] = useState(5);

  const estimator = useMemo(() => {
    const activePeers = concurrentCalls * avgPeersPerCall;
    const rawTicksPerSec = activePeers; // 1Hz per peer
    const batchRequestsPerSec = activePeers / Math.max(1, flushIntervalSec);
    const monthlyTicks = dailyCalls * avgPeersPerCall * avgDurationMin * 60 * 30;
    // ~140 bytes/row uncompressed in PostgreSQL heap + index overhead; ~14 bytes/row after TimescaleDB columnar compression
    const rawGbPerMonth = (monthlyTicks * 140) / 1e9;
    const compressedGbPerMonth = rawGbPerMonth * 0.11;
    // Redis presence (~400B per active peer) + 50k stream buffer (~12MB)
    const redisMb = Math.max(16, (activePeers * 0.0004) + 18);

    return {
      activePeers,
      rawTicksPerSec,
      batchRequestsPerSec,
      monthlyTicks,
      rawGbPerMonth,
      compressedGbPerMonth,
      redisMb,
    };
  }, [concurrentCalls, avgPeersPerCall, dailyCalls, avgDurationMin, flushIntervalSec]);

  const activeCode =
    schemaTab === 'postgres'
      ? SQL_RELATIONAL_SCHEMA
      : schemaTab === 'timescaledb'
      ? SQL_TIMESCALEDB_SCHEMA
      : schemaTab === 'redis'
      ? REDIS_KEYSPACE_SPEC
      : SOCKET_CONTRACT_SPEC;

  const handleCopy = () => {
    navigator.clipboard?.writeText(activeCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const layerInfo = LAYER_DETAILS[activeLayer];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-zinc-800/80">
        <h1 className="text-xl font-semibold text-zinc-100">
          Scalable Database & Architecture Blueprint (Months 6–12)
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          PostgreSQL 16 + TimescaleDB hypertables + Redis 7 ephemeral signaling and telemetry ingestion pipeline designed to scale NetAdapt without slowing live calls.
        </p>
      </div>

      {/* Interactive Topology Selector + Layer Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Interactive System Topology</h2>
            <span className="text-[11px] text-zinc-500">Select a layer to inspect</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(
              [
                { id: 'client', label: '01. Browser Client', sub: 'WebRTC · 1Hz NQS · 5s Buffer' },
                { id: 'signaling', label: '02. Node Signaling', sub: 'Socket.IO · Bulk Worker' },
                { id: 'redis', label: '03. Redis 7 Layer', sub: 'Pub/Sub · Room TTL · Stream' },
              ] as const
            ).map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setActiveLayer(node.id)}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
                  activeLayer === node.id
                    ? 'bg-blue-600/15 border-blue-500 text-zinc-100'
                    : 'bg-[#09090B] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="text-xs font-semibold">{node.label}</div>
                <div className="text-[11px] font-mono text-zinc-500 mt-1">{node.sub}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center text-[11px] font-mono text-zinc-600 py-0.5">
            ↓ Single PostgreSQL 16 Engine (OLTP + Hypertables) ↓
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              [
                {
                  id: 'postgres',
                  label: '04. PostgreSQL 16 Relational',
                  sub: 'users · rooms · call_sessions · experiment_runs',
                },
                {
                  id: 'timescaledb',
                  label: '05. TimescaleDB Hypertables',
                  sub: 'call_telemetry_ticks · 7d Compress · 1m Rollups',
                },
              ] as const
            ).map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setActiveLayer(node.id)}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
                  activeLayer === node.id
                    ? 'bg-blue-600/15 border-blue-500 text-zinc-100'
                    : 'bg-[#09090B] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="text-xs font-semibold">{node.label}</div>
                <div className="text-[11px] font-mono text-zinc-500 mt-1">{node.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Layer Inspector */}
        <div className="lg:col-span-5 bg-[#111114] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="text-[11px] font-mono text-blue-400">{layerInfo.horizon}</div>
            <h2 className="text-base font-semibold text-zinc-100">{layerInfo.title}</h2>
            <p className="text-xs text-zinc-300 leading-relaxed">{layerInfo.role}</p>
            <div className="pt-3 border-t border-zinc-800/80 space-y-1">
              <div className="text-[11px] font-medium text-zinc-500">Key Scalability Pattern</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{layerInfo.keyDesign}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Zero Cross-DB Joins</span>
            <span>SQL + Redis Only</span>
          </div>
        </div>
      </div>

      {/* Interactive Scale & Storage Estimator */}
      <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-800/80">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Live Telemetry Scale & Storage Estimator
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Model peak ingestion throughput and TimescaleDB columnar compression savings across concurrent NetAdapt rooms.
            </p>
          </div>
          <span className="font-mono text-xs text-zinc-400">
            1Hz local stats · {flushIntervalSec}s batch flush
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <label className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Peak Rooms</span>
              <span className="font-mono tabular-nums text-zinc-100">{concurrentCalls}</span>
            </div>
            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={concurrentCalls}
              onChange={(e) => setConcurrentCalls(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>

          <label className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Peers / Room</span>
              <span className="font-mono tabular-nums text-zinc-100">{avgPeersPerCall}</span>
            </div>
            <input
              type="range"
              min={2}
              max={8}
              step={1}
              value={avgPeersPerCall}
              onChange={(e) => setAvgPeersPerCall(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>

          <label className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Calls / Day</span>
              <span className="font-mono tabular-nums text-zinc-100">{dailyCalls}</span>
            </div>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={dailyCalls}
              onChange={(e) => setDailyCalls(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>

          <label className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Avg Duration</span>
              <span className="font-mono tabular-nums text-zinc-100">{avgDurationMin}m</span>
            </div>
            <input
              type="range"
              min={5}
              max={90}
              step={5}
              value={avgDurationMin}
              onChange={(e) => setAvgDurationMin(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>

          <label className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Batch Window</span>
              <span className="font-mono tabular-nums text-zinc-100">{flushIntervalSec}s</span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={flushIntervalSec}
              onChange={(e) => setFlushIntervalSec(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-zinc-800/80">
          <div>
            <div className="text-[11px] text-zinc-500">Peak Telemetry Rows/s</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-zinc-100 mt-0.5">
              {estimator.rawTicksPerSec.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Batched Ingest Req/s</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-blue-400 mt-0.5">
              {estimator.batchRequestsPerSec.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Raw PG Storage / Mo</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-zinc-400 mt-0.5">
              {estimator.rawGbPerMonth.toFixed(2)} GB
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">TimescaleDB Compressed</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-emerald-400 mt-0.5">
              {estimator.compressedGbPerMonth.toFixed(2)} GB
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Redis Peak Memory</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-zinc-100 mt-0.5">
              ~{estimator.redisMb.toFixed(0)} MB
            </div>
          </div>
        </div>
      </div>

      {/* Schema & Contract Inspector */}
      <div className="bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-800">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'timescaledb', label: 'TimescaleDB Hypertables' },
                { id: 'postgres', label: 'PostgreSQL 16 Core' },
                { id: 'redis', label: 'Redis 7 Keyspace' },
                { id: 'signaling', label: 'Socket.IO M5 → M9 Contract' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSchemaTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  schemaTab === tab.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-zinc-300 bg-[#0B0B0E]">
          <code>{activeCode}</code>
        </pre>
      </div>
    </div>
  );
};
