import { BrainstormIdea, RoadmapMonth } from '../types/netadapt';

export const INITIAL_ROADMAP_MONTHS: RoadmapMonth[] = [
  {
    month: 1,
    phase: 'Completed Foundation',
    status: 'completed',
    title: 'Architecture Spec & Signaling Server',
    focus: 'Express + Socket.IO room signaling & shared telemetry contract',
    primaryTrack: 'Networking',
    exitCriteria: 'Two browser tabs complete join-room, offer/answer, and ICE handshake reliably on localhost.',
    dependencies: 'Node.js 20 LTS, Vite/React workspace, team contract lock.',
    tasks: [
      { id: 'm1-t1', title: 'Lock shared TelemetrySample JSON schema across all 4 modules', track: 'Algorithm', done: true },
      { id: 'm1-t2', title: 'Implement stateless Socket.IO signaling events (join, offer, answer, ice, chat)', track: 'Networking', done: true },
      { id: 'm1-t3', title: 'Build initial React + Vite lobby and room routing skeleton', track: 'Frontend & AR', done: true },
    ],
  },
  {
    month: 2,
    phase: 'Completed Foundation',
    status: 'completed',
    title: 'Direct P2P WebRTC & NAT Traversal',
    focus: 'STUN/TURN config, queued ICE candidates, and ICE Restart recovery',
    primaryTrack: 'Networking',
    exitCriteria: 'Cross-network calls (Wi-Fi ↔ 4G/5G) connect cleanly and auto-recover via ICE Restart.',
    dependencies: 'Month 1 signaling server & Coturn/Metered.ca TURN credentials.',
    tasks: [
      { id: 'm2-t1', title: 'Queue early ICE candidates until setRemoteDescription() resolves', track: 'Networking', done: true },
      { id: 'm2-t2', title: 'Detect active candidate-pair type (P2P host/srflx vs RELAY TURN)', track: 'Networking', done: true },
      { id: 'm2-t3', title: 'Trigger 2s-debounced createOffer({ iceRestart: true }) on disconnect', track: 'Networking', done: true },
    ],
  },
  {
    month: 3,
    phase: 'Completed Foundation',
    status: 'completed',
    title: 'Stats Collector & NQS Mathematical Core',
    focus: '1Hz pc.getStats() delta math, composite NQS, and EMA smoothing',
    primaryTrack: 'Algorithm',
    exitCriteria: 'Unit-tested NQS pipeline computes RTT, Jitter, PLR, Bitrate, and smoothNqs every second.',
    dependencies: 'Active RTCPeerConnection outbound-rtp & remote-inbound-rtp reports.',
    tasks: [
      { id: 'm3-t1', title: 'Compute delta throughput B(t) and clamped PLR(t) safely when Δpackets = 0', track: 'Algorithm', done: true },
      { id: 'm3-t2', title: 'Implement weighted sub-scores (S_RTT, S_loss, S_jitter, S_bw) + EMA α=0.3', track: 'Algorithm', done: true },
      { id: 'm3-t3', title: 'Build offline mock-stats harness to validate NQS curves before live calls', track: 'Testing', done: true },
    ],
  },
  {
    month: 4,
    phase: 'Completed Foundation',
    status: 'completed',
    title: 'Hysteresis FSM & Live Parameter Control',
    focus: 'GOOD/MODERATE/POOR state machine + RTCRtpSender.setParameters()',
    primaryTrack: 'Algorithm',
    exitCriteria: 'Seamless live resolution/FPS/bitrate scaling without black screens or camera restart.',
    dependencies: 'Month 3 NQS scorer and active video RTCRtpSender.',
    tasks: [
      { id: 'm4-t1', title: 'Implement dual-threshold Hysteresis FSM (3s downgrade, 6s upgrade, emergency drop)', track: 'Algorithm', done: true },
      { id: 'm4-t2', title: 'Apply maxBitrate, maxFramerate, and scaleResolutionDownBy via setParameters()', track: 'Algorithm', done: true },
      { id: 'm4-t3', title: 'Add Baseline vs Adaptive kill-switch toggle and in-memory CSV exporter', track: 'Testing', done: true },
    ],
  },
  {
    month: 5,
    phase: 'Completed Foundation',
    status: 'in_progress',
    title: 'NetAdapt Dark Studio UI & Month 5 Hub',
    focus: 'Minimalist Obsidian UI, high-performance navigation, and 7-month blueprint',
    primaryTrack: 'Frontend & AR',
    exitCriteria: 'Polished Meeting Room, live NQS telemetry HUD, ⌘K command nav, and signed-off M6–M12 roadmap.',
    dependencies: 'NetAdapt UI reference alignment and existing README contract.',
    tasks: [
      { id: 'm5-t1', title: 'Deliver Precision Dark Obsidian Meeting Room with docked Chat & Network Dashboard', track: 'Frontend & AR', done: true },
      { id: 'm5-t2', title: 'Add keyboard-first navigation (⌘K palette, slim rail, live sparkline widget)', track: 'Frontend & AR', done: true },
      { id: 'm5-t3', title: 'Finalize Months 6–12 feature brainstorm and PostgreSQL + TimescaleDB + Redis schema', track: 'Database & Scale', done: true },
    ],
  },
  {
    month: 6,
    phase: 'Remaining 7-Month Plan',
    status: 'planned',
    title: 'Pre-Flight Diagnostics & Redis Signaling',
    focus: 'Hardware/NAT readiness probe, keyboard call controls, and horizontal Socket.IO',
    primaryTrack: 'Frontend & AR',
    exitCriteria: 'Zero black-screen joins; signaling scales cleanly across 2+ stateless Node instances via Redis.',
    dependencies: 'Redis 7 Pub/Sub instance and @socket.io/redis-adapter.',
    tasks: [
      { id: 'm6-t1', title: 'Add silent 1.5s pre-call camera, mic RMS, and STUN/TURN reachability probe', track: 'Frontend & AR', done: false },
      { id: 'm6-t2', title: 'Connect Socket.IO signaling server to Redis Pub/Sub adapter with room TTL hashes', track: 'Database & Scale', done: false },
      { id: 'm6-t3', title: 'Instrument ICE Restart recovery latency counter inside live telemetry ticks', track: 'Networking', done: false },
    ],
  },
  {
    month: 7,
    phase: 'Remaining 7-Month Plan',
    status: 'planned',
    title: 'MediaPipe AR Pipeline & NQS Throttling',
    focus: 'OffscreenCanvas Face Landmarker + captureStream() + replaceTrack()',
    primaryTrack: 'Frontend & AR',
    exitCriteria: 'Remote peer receives live AR overlays/blur mid-call; AR auto-throttles in POOR network state.',
    dependencies: '@mediapipe/tasks-vision, Web Worker support, active video RTCRtpSender.',
    tasks: [
      { id: 'm7-t1', title: 'Replace AR popover hook with MediaPipe Face Landmarker + OffscreenCanvas worker', track: 'Frontend & AR', done: false },
      { id: 'm7-t2', title: 'Pipe processed frames via canvas.captureStream(30) & videoSender.replaceTrack()', track: 'Frontend & AR', done: false },
      { id: 'm7-t3', title: 'Implement NQS-aware AR throttling (drop AR to 15fps/off when state enters POOR)', track: 'Algorithm', done: false },
    ],
  },
  {
    month: 8,
    phase: 'Remaining 7-Month Plan',
    status: 'planned',
    title: 'PostgreSQL 16 + TimescaleDB Persistence',
    focus: 'Relational sessions, compressed 1Hz hypertables, and 5s batched ingestion',
    primaryTrack: 'Database & Scale',
    exitCriteria: 'Telemetry persists durably with <20ms rollup queries and 90%+ compression after 7 days.',
    dependencies: 'PostgreSQL 16 with TimescaleDB extension, Redis Stream ingestion worker.',
    tasks: [
      { id: 'm8-t1', title: 'Provision relational tables (users, rooms, call_sessions, experiment_runs)', track: 'Database & Scale', done: false },
      { id: 'm8-t2', title: 'Create call_telemetry_ticks hypertable with 1-day chunks & 7-day compression policy', track: 'Database & Scale', done: false },
      { id: 'm8-t3', title: 'Implement client 5s ring-buffer flush → Redis Stream → bulk COPY worker', track: 'Database & Scale', done: false },
    ],
  },
  {
    month: 9,
    phase: 'Remaining 7-Month Plan',
    status: 'planned',
    title: 'Multi-Party Mesh & Simulcast SFU Bridge',
    focus: 'Per-peer independent NQS state machines (3–4 peers) + SFU migration blueprint',
    primaryTrack: 'Networking',
    exitCriteria: '4-user Mesh calls adapt each peer independently without slow-peer drag-down.',
    dependencies: 'Backward-compatible Socket.IO envelope adding fromPeerId/toPeerId.',
    tasks: [
      { id: 'm9-t1', title: 'Extend signaling contract with peerId routing while preserving 1-on-1 fallback', track: 'Networking', done: false },
      { id: 'm9-t2', title: 'Instantiate isolated NQS + Hysteresis FSM controllers per remote RTCPeerConnection', track: 'Algorithm', done: false },
      { id: 'm9-t3', title: 'Prototype 3-layer Simulcast (rid: h/m/l) bridge spec for Mediasoup/LiveKit >4 users', track: 'Networking', done: false },
    ],
  },
  {
    month: 10,
    phase: 'Remaining 7-Month Plan',
    status: 'planned',
    title: 'Security, E2EE & Audio Survival Mode',
    focus: 'Ephemeral TURN auth, WebRTC Encoded Transform E2EE, and voice-first cutoff',
    primaryTrack: 'Networking',
    exitCriteria: 'Zero static TURN secrets in client bundles; audio remains intelligible at 15%+ packet loss.',
    dependencies: 'Coturn REST HMAC-SHA1 secret, browser Encoded Transform API.',
    tasks: [
      { id: 'm10-t1', title: 'Build backend /api/ice-credentials endpoint issuing short-lived HMAC TURN tokens', track: 'Networking', done: false },
      { id: 'm10-t2', title: 'Add optional E2EE media frame encryption via WebRTC Insertable Streams', track: 'Networking', done: false },
      { id: 'm10-t3', title: 'Implement Emergency Audio-Only Survival Mode (pause video if NQS < 20 for 6s)', track: 'Algorithm', done: false },
    ],
  },
  {
    month: 11,
    phase: 'Remaining 7-Month Plan',
    status: 'planned',
    title: 'Automated Experiment Lab & MOS Analysis',
    focus: '7-scenario Playwright + tc netem runner, E-Model MOS, and statistical exports',
    primaryTrack: 'Testing',
    exitCriteria: '21+ reproducible Baseline vs Adaptive trials stored in TimescaleDB with automated plots.',
    dependencies: 'Month 8 TimescaleDB continuous aggregates & Linux tc netem / Clumsy scripts.',
    tasks: [
      { id: 'm11-t1', title: 'Automate 7-scenario Baseline vs Adaptive test matrix (3 trials × 60s each)', track: 'Testing', done: false },
      { id: 'm11-t2', title: 'Compute E-Model MOS (1.0–4.5), freeze duration (FPS < 5), and switches/min', track: 'Testing', done: false },
      { id: 'm11-t3', title: 'Generate publication-grade SVG/PNG comparison charts directly from TimescaleDB', track: 'Testing', done: false },
    ],
  },
  {
    month: 12,
    phase: 'Remaining 7-Month Plan',
    status: 'planned',
    title: 'Production Hardening & Viva Demo Suite',
    focus: 'Multi-region HTTPS/WSS deploy, synthetic probes, and split-screen kill-switch demo',
    primaryTrack: 'Testing',
    exitCriteria: 'Sub-2s live demo startup on restrictive university Wi-Fi with reproducible thesis bundle.',
    dependencies: 'HTTPS frontend host, WSS signaling cluster, verified TURN fallback.',
    tasks: [
      { id: 'm12-t1', title: 'Deploy production frontend + signaling + Coturn over HTTPS/WSS with canary alerts', track: 'Database & Scale', done: false },
      { id: 'm12-t2', title: 'Rehearse 5-minute live viva demo switching Baseline ↔ Adaptive under live packet drop', track: 'Testing', done: false },
      { id: 'm12-t3', title: 'Archive full TimescaleDB benchmark snapshot, architecture docs, and handover guide', track: 'Frontend & AR', done: false },
    ],
  },
];

export const INITIAL_BRAINSTORM_IDEAS: BrainstormIdea[] = [
  {
    id: 'bs-1',
    title: 'NQS-Aware AR Auto-Throttling',
    summary: 'Automatically step MediaPipe Face Landmarker inference from 30fps down to 15fps in MODERATE and pause background blur in POOR so CPU load never starves the WebRTC encoder.',
    pillar: 'Research',
    horizon: 'M6–M7 Near-Term',
    impact: 'High',
    effort: 'Medium',
    pinned: true,
    ownerTrack: 'Algorithm',
  },
  {
    id: 'bs-2',
    title: 'Silent 1.5s Pre-Flight Hardware & NAT Probe',
    summary: 'Run an unobtrusive camera FPS, mic RMS meter, and STUN/TURN candidate check directly inside the Lobby before joining—displaying quiet inline readiness text with zero blocking popups.',
    pillar: 'UX Flows',
    horizon: 'M6–M7 Near-Term',
    impact: 'High',
    effort: 'Low',
    pinned: true,
    ownerTrack: 'Frontend & AR',
  },
  {
    id: 'bs-3',
    title: 'Client 5-Second Telemetry Ring Buffer',
    summary: 'Keep local NQS reaction at 1Hz while buffering telemetry rows in memory and flushing batches every 5s into a Redis Stream for bulk TimescaleDB COPY inserts—cutting write IOPS by 5–10x.',
    pillar: 'Features',
    horizon: 'M8–M10 Core Scale',
    impact: 'High',
    effort: 'Medium',
    pinned: true,
    ownerTrack: 'Database & Scale',
  },
  {
    id: 'bs-4',
    title: 'Per-Peer Independent NQS State Machines (Mesh)',
    summary: 'For 3–4 participant Mesh calls, run a dedicated NQS + Hysteresis FSM per RTCPeerConnection so one peer on 3G receives 240p while two peers on fiber keep crisp 720p.',
    pillar: 'Research',
    horizon: 'M8–M10 Core Scale',
    impact: 'High',
    effort: 'High',
    pinned: true,
    ownerTrack: 'Networking',
  },
  {
    id: 'bs-5',
    title: 'Emergency Audio-Only Survival Mode',
    summary: 'When NQS stays below 20 for 6 consecutive seconds (or PLR exceeds 18%), gracefully pause outgoing video track while locking Opus audio priority and showing a calm avatar placeholder.',
    pillar: 'Features',
    horizon: 'M8–M10 Core Scale',
    impact: 'High',
    effort: 'Low',
    pinned: false,
    ownerTrack: 'Algorithm',
  },
  {
    id: 'bs-6',
    title: 'Progressive Disclosure Telemetry HUD',
    summary: 'Allow everyday users to collapse the Network Dashboard into a minimal one-line quality readout (Good · 720p), while researchers tap H or ⌘K to open full curves and fault presets.',
    pillar: 'UX Flows',
    horizon: 'M6–M7 Near-Term',
    impact: 'Medium',
    effort: 'Low',
    pinned: false,
    ownerTrack: 'Frontend & AR',
  },
  {
    id: 'bs-7',
    title: 'Dynamic HMAC-SHA1 Ephemeral TURN Credentials',
    summary: 'Eliminate static VITE_TURN_CREDENTIAL secrets by minting 10-minute signed Coturn tokens from the Node signaling server upon room join.',
    pillar: 'Features',
    horizon: 'M8–M10 Core Scale',
    impact: 'High',
    effort: 'Low',
    pinned: false,
    ownerTrack: 'Networking',
  },
  {
    id: 'bs-8',
    title: 'Live E-Model MOS (1.0–4.5) Quality Scoring',
    summary: 'Pair NetAdapt NQS with industry-standard ITU-T G.107 Mean Opinion Score estimation so thesis tables report both custom NQS and recognized telecom voice/video quality metrics.',
    pillar: 'Research',
    horizon: 'M11–M12 Polish & Future',
    impact: 'High',
    effort: 'Low',
    pinned: true,
    ownerTrack: 'Testing',
  },
  {
    id: 'bs-9',
    title: 'Calm Degradation Micro-Copy System',
    summary: 'Replace alarming red warning banners with subtle, auto-fading inline status notes (Adapting to 360p to preserve voice clarity) so calls feel composed even under heavy congestion.',
    pillar: 'UX Flows',
    horizon: 'M6–M7 Near-Term',
    impact: 'Medium',
    effort: 'Low',
    pinned: false,
    ownerTrack: 'Frontend & AR',
  },
  {
    id: 'bs-10',
    title: 'TimescaleDB Continuous Aggregates for Instant Benchmarks',
    summary: 'Precompute 1-minute rollups (p95 RTT, avg FPS, freeze-second counts, switches/min) inside TimescaleDB so multi-hour Baseline vs Adaptive dashboards load in under 20ms.',
    pillar: 'Features',
    horizon: 'M8–M10 Core Scale',
    impact: 'High',
    effort: 'Medium',
    pinned: false,
    ownerTrack: 'Database & Scale',
  },
  {
    id: 'bs-11',
    title: 'WebRTC Encoded Transform E2EE Mode',
    summary: 'Offer an opt-in room passphrase that encrypts raw VP8/H.264/Opus frames in a browser Worker before packetization, verifying zero media readability even across TURN relays.',
    pillar: 'Features',
    horizon: 'M8–M10 Core Scale',
    impact: 'Medium',
    effort: 'High',
    pinned: false,
    ownerTrack: 'Networking',
  },
  {
    id: 'bs-12',
    title: 'One-Keystroke Viva Kill-Switch Choreography',
    summary: 'Map keyboard shortcuts (1–7 for fault presets, A for Adaptive toggle, E for CSV export) so presenters can demonstrate live congestion recovery smoothly without hunting menus.',
    pillar: 'UX Flows',
    horizon: 'M11–M12 Polish & Future',
    impact: 'High',
    effort: 'Low',
    pinned: false,
    ownerTrack: 'Testing',
  },
  {
    id: 'bs-13',
    title: 'Simulcast + SFU Bridge (>4 Participants)',
    summary: 'Keep 1-on-1 calls direct P2P for zero server egress cost, and auto-promote rooms with 5+ peers to a Mediasoup/LiveKit SFU consuming 3 simulcast layers (720p, 360p, 180p).',
    pillar: 'Features',
    horizon: 'M11–M12 Polish & Future',
    impact: 'High',
    effort: 'High',
    pinned: false,
    ownerTrack: 'Networking',
  },
  {
    id: 'bs-14',
    title: 'Automated Playwright + tc netem Trial Runner',
    summary: 'Script headless Chromium pairs across all 7 network profiles (3 trials each), automatically tagging experiment_runs in PostgreSQL and exporting thesis comparison charts.',
    pillar: 'Research',
    horizon: 'M11–M12 Polish & Future',
    impact: 'High',
    effort: 'Medium',
    pinned: false,
    ownerTrack: 'Testing',
  },
];

export const SQL_RELATIONAL_SCHEMA = `-- PostgreSQL 16 Relational Core (OLTP — Users, Rooms, Sessions, Benchmarks)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('researcher', 'member', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rooms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code        VARCHAR(16) UNIQUE NOT NULL,
  host_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  topology_mode    TEXT NOT NULL DEFAULT 'p2p_1v1'
                     CHECK (topology_mode IN ('p2p_1v1', 'mesh_4', 'sfu')),
  max_participants SMALLINT NOT NULL DEFAULT 2,
  is_locked        BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE call_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id            UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at           TIMESTAMPTZ,
  adaptation_mode    TEXT NOT NULL CHECK (adaptation_mode IN ('ADAPTIVE', 'BASELINE')),
  nqs_config_json    JSONB NOT NULL, -- Stores w1..w4, emaAlpha, thresholds
  avg_nqs            REAL,
  freeze_seconds     INTEGER DEFAULT 0,
  ice_restart_count  INTEGER DEFAULT 0
);

CREATE TABLE experiment_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  scenario_name    TEXT NOT NULL CHECK (scenario_name IN (
                     'normal', 'low_bw', 'high_latency', 'packet_loss',
                     'high_jitter', 'fluctuating', 'interruption'
                   )),
  trial_number     SMALLINT NOT NULL DEFAULT 1,
  impairment_tool  TEXT NOT NULL DEFAULT 'clumsy',
  notes            TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_code ON rooms (room_code);
CREATE INDEX idx_sessions_room_started ON call_sessions (room_id, started_at DESC);
CREATE INDEX idx_experiments_scenario ON experiment_runs (scenario_name, trial_number);`;

export const SQL_TIMESCALEDB_SCHEMA = `-- TimescaleDB Hypertables (1Hz Telemetry + Compression + Continuous Aggregates)
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE call_telemetry_ticks (
  time             TIMESTAMPTZ NOT NULL,
  session_id       UUID NOT NULL,
  peer_id          UUID NOT NULL,
  connection_type  TEXT NOT NULL CHECK (connection_type IN ('P2P', 'RELAY')),
  rtt_ms           REAL NOT NULL,
  jitter_ms        REAL NOT NULL,
  packet_loss_pct  REAL NOT NULL,
  bitrate_kbps     REAL NOT NULL,
  fps              REAL NOT NULL,
  resolution       TEXT NOT NULL,
  nqs              REAL NOT NULL,
  smooth_nqs       REAL NOT NULL,
  quality_state    TEXT NOT NULL CHECK (quality_state IN ('GOOD', 'MODERATE', 'POOR')),
  mode             TEXT NOT NULL CHECK (mode IN ('ADAPTIVE', 'BASELINE')),
  mos_estimate     REAL NOT NULL
);

SELECT create_hypertable(
  'call_telemetry_ticks', 'time',
  chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX idx_ticks_session_time
  ON call_telemetry_ticks (session_id, time DESC);

-- ~90% Storage Savings: Segment by session/peer and compress chunks older than 7 days
ALTER TABLE call_telemetry_ticks SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'session_id, peer_id',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('call_telemetry_ticks', INTERVAL '7 days');
SELECT add_retention_policy('call_telemetry_ticks', INTERVAL '90 days');

-- Instant <20ms Analytics Rollup (Precomputed 1-Minute Summaries)
CREATE MATERIALIZED VIEW telemetry_1min_rollup
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  session_id,
  mode,
  ROUND(AVG(smooth_nqs)::numeric, 1) AS avg_nqs,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rtt_ms)::numeric, 1) AS p95_rtt_ms,
  ROUND(AVG(fps)::numeric, 1) AS avg_fps,
  COUNT(*) FILTER (WHERE fps < 5) AS freeze_seconds,
  ROUND(AVG(mos_estimate)::numeric, 2) AS avg_mos
FROM call_telemetry_ticks
GROUP BY bucket, session_id, mode;`;

export const REDIS_KEYSPACE_SPEC = `# Redis 7 Ephemeral Layer — Signaling Scale, Presence & Ingestion Buffering

# 1. Horizontal Socket.IO Signaling Adapter (@socket.io/redis-adapter)
CHANNEL  socket.io#/#room-101#         # Relays offer/answer/ice across Node pods

# 2. Active Room Presence (Hash with automatic 2h TTL cleanup)
HSET     room:room-101:members  socket_a '{"name":"You","mic":true,"cam":true,"state":"GOOD"}'
HSET     room:room-101:members  socket_b '{"name":"Sarah","mic":false,"cam":true,"state":"GOOD"}'
EXPIRE   room:room-101:members  7200

# 3. Early ICE Candidate Buffer (Prevents SDP race before remoteDescription)
RPUSH    ice:queue:room-101:socket_b   '{"candidate":"candidate:842163049...","sdpMid":"0"}'
EXPIRE   ice:queue:room-101:socket_b   120

# 4. Batched Telemetry Ingestion Stream (5s Client Flushes -> Bulk COPY Worker)
XADD     telemetry:ingest MAXLEN ~ 100000 * session_id "9f8c..." batch_json "[{...5 ticks...}]"
XREADGROUP GROUP tsdb-workers worker-1 COUNT 500 BLOCK 2000 STREAMS telemetry:ingest >

# 5. Sliding-Window Rate Limiting (Protect Signaling & Ephemeral TURN Auth)
INCR     ratelimit:turn:203.0.113.42
EXPIRE   ratelimit:turn:203.0.113.42   60`;

export const SOCKET_CONTRACT_SPEC = `// Backward-Compatible NetAdapt Socket.IO Signaling Contract
// Existing Month 5 (1-on-1 P2P) — Preserved with zero breaking changes
socket.emit('join-room',     { roomId, username });
socket.on('peer-joined',     { roomId, username }); // Also listens to 'user-joined'
socket.emit('offer',         { roomId, sdp });
socket.emit('answer',        { roomId, sdp });
socket.emit('ice-candidate', { roomId, candidate });
socket.emit('chat-message',  { roomId, sender, text, time });
socket.emit('leave-room',    { roomId });

// Month 9 Extension (3–4 Peer Mesh + Optional SFU Upgrade Envelope)
// Adding optional fromPeerId / targetPeerId enables isolated NQS per peer
socket.emit('offer',         { roomId, fromPeerId, targetPeerId, sdp });
socket.emit('answer',        { roomId, fromPeerId, targetPeerId, sdp });
socket.emit('ice-candidate', { roomId, fromPeerId, targetPeerId, candidate });
socket.emit('telemetry-batch', { sessionId, peerId, ticks: TelemetrySample[] });`;
