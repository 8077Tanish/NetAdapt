export type QualityState = 'GOOD' | 'MODERATE' | 'POOR';
export type AdaptationMode = 'ADAPTIVE' | 'BASELINE';
export type ConnectionType = 'P2P' | 'RELAY';

export type WorkspaceView =
  | 'landing'
  | 'meeting'
  | 'analytics'
  | 'roadmap'
  | 'brainstorm'
  | 'architecture'
  | 'settings';

export type FaultScenarioId =
  | 'normal'
  | 'low_bw'
  | 'high_latency'
  | 'packet_loss'
  | 'high_jitter'
  | 'fluctuating'
  | 'interruption';

export interface FaultScenarioSpec {
  id: FaultScenarioId;
  code: string;
  label: string;
  shortLabel: string;
  simulatedParams: string;
  objective: string;
  connectionType: ConnectionType;
}

export interface TelemetrySample {
  timestamp: number;
  elapsedSec: number;
  connectionType: ConnectionType;
  rttMs: number;
  jitterMs: number;
  packetLossPct: number;
  bitrateKbps: number;
  fps: number;
  resolution: string;
  scaleFactor: number;
  nqs: number;
  smoothNqs: number;
  qualityState: QualityState;
  mode: AdaptationMode;
  scenario: FaultScenarioId;
  mosEstimate: number;
  isFrozen: boolean;
  isRecovering: boolean;
}

export interface StateTransitionEvent {
  id: string;
  timestamp: number;
  elapsedSec: number;
  fromState: QualityState;
  toState: QualityState;
  reason: string;
  smoothNqs: number;
  mode: AdaptationMode;
}

export interface NQSConfig {
  wRtt: number;
  wLoss: number;
  wJitter: number;
  wBw: number;
  emaAlpha: number;
  downgradeToModerateThreshold: number;
  downgradeToPoorThreshold: number;
  upgradeToModerateThreshold: number;
  upgradeToGoodThreshold: number;
  downgradeHoldSec: number;
  upgradeHoldSec: number;
  emergencyLossPct: number;
  emergencyNqsThreshold: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  isSelf: boolean;
  text: string;
  time: string;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  role: 'Host' | 'Remote Peer';
  isSelf: boolean;
  micOn: boolean;
  camOn: boolean;
  connectionType: ConnectionType;
  qualityState: QualityState;
}

export type TrackName =
  | 'Networking'
  | 'Algorithm'
  | 'Testing'
  | 'Frontend & AR'
  | 'Database & Scale';

export interface MilestoneTask {
  id: string;
  title: string;
  track: TrackName;
  done: boolean;
}

export interface RoadmapMonth {
  month: number;
  phase: 'Completed Foundation' | 'Remaining 7-Month Plan';
  status: 'completed' | 'in_progress' | 'planned';
  title: string;
  focus: string;
  primaryTrack: TrackName;
  exitCriteria: string;
  dependencies: string;
  tasks: MilestoneTask[];
}

export type BrainstormPillar = 'Features' | 'UX Flows' | 'Research';
export type BrainstormHorizon = 'M6–M7 Near-Term' | 'M8–M10 Core Scale' | 'M11–M12 Polish & Future';

export interface BrainstormIdea {
  id: string;
  title: string;
  summary: string;
  pillar: BrainstormPillar;
  horizon: BrainstormHorizon;
  impact: 'High' | 'Medium';
  effort: 'Low' | 'Medium' | 'High';
  pinned: boolean;
  ownerTrack: TrackName;
}
