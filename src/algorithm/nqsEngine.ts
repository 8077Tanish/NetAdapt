import {
  AdaptationMode,
  FaultScenarioId,
  FaultScenarioSpec,
  NQSConfig,
  QualityState,
  StateTransitionEvent,
  TelemetrySample,
} from '../types/netadapt';

export const DEFAULT_NQS_CONFIG: NQSConfig = {
  wRtt: 0.3,
  wLoss: 0.35,
  wJitter: 0.2,
  wBw: 0.15,
  emaAlpha: 0.3,
  downgradeToModerateThreshold: 65,
  downgradeToPoorThreshold: 40,
  upgradeToModerateThreshold: 50,
  upgradeToGoodThreshold: 75,
  downgradeHoldSec: 3,
  upgradeHoldSec: 6,
  emergencyLossPct: 15,
  emergencyNqsThreshold: 30,
};

export const FAULT_SCENARIOS: FaultScenarioSpec[] = [
  {
    id: 'normal',
    code: '01',
    label: 'Normal Network',
    shortLabel: 'Normal',
    simulatedParams: '0 ms delay · 0% loss · Unlimited BW',
    objective: 'Verify zero overhead and stable 720p · 30 fps operation.',
    connectionType: 'P2P',
  },
  {
    id: 'low_bw',
    code: '02',
    label: 'Low Bandwidth',
    shortLabel: 'Low BW (400k)',
    simulatedParams: '400 kbps upload/download cap',
    objective: 'Step down proactively to 240p/360p while keeping FPS smooth.',
    connectionType: 'P2P',
  },
  {
    id: 'high_latency',
    code: '03',
    label: 'High Latency',
    shortLabel: 'Latency +250ms',
    simulatedParams: '+250 ms round-trip delay · TURN relay',
    objective: 'Track elevated RTT accurately and stabilize encoding rate.',
    connectionType: 'RELAY',
  },
  {
    id: 'packet_loss',
    code: '04',
    label: 'Packet Loss (5–8%)',
    shortLabel: 'Loss 6.5%',
    simulatedParams: '5–8% random UDP packet drop',
    objective: 'Lower bitrate under congestion to eliminate frame freezes.',
    connectionType: 'P2P',
  },
  {
    id: 'high_jitter',
    code: '05',
    label: 'High Jitter',
    shortLabel: 'Jitter ±60ms',
    simulatedParams: '100 ms ± 60 ms variable packet delay',
    objective: 'Demonstrate EMA smoothing prevents false quality drops.',
    connectionType: 'P2P',
  },
  {
    id: 'fluctuating',
    code: '06',
    label: 'Fluctuating Network',
    shortLabel: 'Fluctuating 20s',
    simulatedParams: '20s Normal ↔ 20s Congested cycle',
    objective: 'Prove dual-threshold hysteresis suppresses ping-pong switching.',
    connectionType: 'P2P',
  },
  {
    id: 'interruption',
    code: '07',
    label: 'Network Interruption',
    shortLabel: '5s Drop / ICE',
    simulatedParams: '5s link drop → ICE Restart recovery',
    objective: 'Measure ICE restart recovery latency and audio survival.',
    connectionType: 'RELAY',
  },
];

export const STATE_PROFILES: Record<
  QualityState,
  { resolution: string; scaleFactor: number; maxFps: number; maxBitrateKbps: number }
> = {
  GOOD: { resolution: '1280x720', scaleFactor: 1.0, maxFps: 30, maxBitrateKbps: 1800 },
  MODERATE: { resolution: '640x360', scaleFactor: 2.0, maxFps: 20, maxBitrateKbps: 700 },
  POOR: { resolution: '426x240', scaleFactor: 4.0, maxFps: 15, maxBitrateKbps: 250 },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export interface ScoreBreakdown {
  sRtt: number;
  sLoss: number;
  sJitter: number;
  sBw: number;
  nqs: number;
}

export function computeNqsBreakdown(
  rttMs: number,
  packetLossPct: number,
  jitterMs: number,
  bitrateKbps: number,
  config: NQSConfig
): ScoreBreakdown {
  const sRtt = 100 * clamp(1 - (rttMs - 50) / (400 - 50), 0, 1);
  const sLoss = 100 * clamp(1 - packetLossPct / 10, 0, 1);
  const sJitter = 100 * clamp(1 - (jitterMs - 10) / (100 - 10), 0, 1);
  const sBw = 100 * clamp((bitrateKbps - 200) / (1500 - 200), 0, 1);

  const weightSum = config.wRtt + config.wLoss + config.wJitter + config.wBw || 1;
  const nqs =
    (config.wRtt * sRtt +
      config.wLoss * sLoss +
      config.wJitter * sJitter +
      config.wBw * sBw) /
    weightSum;

  return {
    sRtt: Number(sRtt.toFixed(1)),
    sLoss: Number(sLoss.toFixed(1)),
    sJitter: Number(sJitter.toFixed(1)),
    sBw: Number(sBw.toFixed(1)),
    nqs: Number(clamp(nqs, 0, 100).toFixed(1)),
  };
}

/**
 * Simplified ITU-T G.107 E-Model approximation mapping RTT, Jitter, and Packet Loss to MOS (1.0 - 4.5)
 */
export function estimateMos(rttMs: number, jitterMs: number, packetLossPct: number): number {
  const effectiveLatency = rttMs / 2 + jitterMs * 2 + 10;
  let rFactor = 93.2 - (effectiveLatency > 160 ? (effectiveLatency - 120) / 10 : effectiveLatency / 40);
  rFactor -= packetLossPct * 2.6;
  const clampedR = clamp(rFactor, 0, 100);
  if (clampedR <= 0) return 1.0;
  const mos = 1 + 0.035 * clampedR + 7e-6 * clampedR * (clampedR - 60) * (100 - clampedR);
  return Number(clamp(mos, 1.0, 4.5).toFixed(2));
}

export interface EngineState {
  elapsedSec: number;
  scenarioSec: number;
  qualityState: QualityState;
  smoothNqs: number;
  downgradeCounter: number;
  upgradeCounter: number;
}

export function createInitialEngineState(): EngineState {
  return {
    elapsedSec: 0,
    scenarioSec: 0,
    qualityState: 'GOOD',
    smoothNqs: 92,
    downgradeCounter: 0,
    upgradeCounter: 0,
  };
}

export interface StepResult {
  nextEngine: EngineState;
  sample: TelemetrySample;
  transition: StateTransitionEvent | null;
}

export function stepTelemetryEngine(
  prev: EngineState,
  scenario: FaultScenarioId,
  mode: AdaptationMode,
  config: NQSConfig
): StepResult {
  const elapsedSec = prev.elapsedSec + 1;
  const scenarioSec = prev.scenarioSec + 1;
  const wave = Math.sin(elapsedSec * 0.65);
  const jitterNoise = (Math.random() - 0.5) * 2;

  const isAdaptive = mode === 'ADAPTIVE';
  const currentProfile = STATE_PROFILES[prev.qualityState];

  let rttMs = 46 + wave * 5 + jitterNoise * 3;
  let jitterMs = 6 + Math.abs(wave) * 2 + Math.random() * 1.5;
  let packetLossPct = 0.2 + Math.random() * 0.25;
  let availableBwKbps = 2100 + wave * 120;
  let connectionType: 'P2P' | 'RELAY' = 'P2P';
  let isRecovering = false;

  switch (scenario) {
    case 'normal': {
      rttMs = 44 + wave * 5 + jitterNoise * 3;
      jitterMs = 5.5 + Math.random() * 2;
      packetLossPct = clamp(0.15 + Math.random() * 0.25, 0, 100);
      availableBwKbps = 2100 + wave * 100;
      connectionType = 'P2P';
      break;
    }
    case 'low_bw': {
      availableBwKbps = 390 + wave * 28 + jitterNoise * 14;
      // In baseline mode, encoder keeps pushing ~1400kbps causing severe queue bloat & loss
      rttMs = isAdaptive ? 78 + wave * 12 + jitterNoise * 6 : 210 + wave * 35 + jitterNoise * 18;
      jitterMs = isAdaptive ? 14 + Math.random() * 5 : 46 + Math.random() * 18;
      packetLossPct = isAdaptive
        ? clamp(1.1 + Math.random() * 1.2, 0, 100)
        : clamp(6.4 + Math.random() * 3.8, 0, 100);
      connectionType = 'P2P';
      break;
    }
    case 'high_latency': {
      rttMs = 288 + wave * 20 + jitterNoise * 12;
      jitterMs = 19 + Math.random() * 6;
      packetLossPct = isAdaptive ? 0.9 + Math.random() * 0.7 : 2.6 + Math.random() * 1.4;
      availableBwKbps = 920 + wave * 90;
      connectionType = 'RELAY';
      break;
    }
    case 'packet_loss': {
      const baseLoss = 6.2 + wave * 1.3 + jitterNoise * 0.9;
      packetLossPct = clamp(isAdaptive ? baseLoss * 0.78 : baseLoss * 1.25, 0, 100);
      rttMs = isAdaptive ? 92 + wave * 14 : 168 + wave * 28;
      jitterMs = isAdaptive ? 22 + Math.random() * 8 : 52 + Math.random() * 15;
      availableBwKbps = isAdaptive ? 620 + wave * 50 : 1280 + wave * 180;
      connectionType = 'P2P';
      break;
    }
    case 'high_jitter': {
      rttMs = 112 + wave * 42 + jitterNoise * 26;
      jitterMs = clamp(62 + Math.sin(elapsedSec * 1.3) * 28 + jitterNoise * 12, 10, 120);
      packetLossPct = isAdaptive ? 1.4 + Math.random() * 1.0 : 3.2 + Math.random() * 2.1;
      availableBwKbps = 1150 + wave * 180;
      connectionType = 'P2P';
      break;
    }
    case 'fluctuating': {
      const cyclePos = scenarioSec % 40;
      const congested = cyclePos >= 16 && cyclePos < 34;
      if (congested) {
        availableBwKbps = 340 + wave * 35;
        rttMs = isAdaptive ? 155 + wave * 18 : 265 + wave * 34;
        jitterMs = isAdaptive ? 28 + Math.random() * 9 : 64 + Math.random() * 16;
        packetLossPct = isAdaptive ? 4.2 + Math.random() * 1.5 : 8.5 + Math.random() * 2.8;
      } else {
        availableBwKbps = 1950 + wave * 110;
        rttMs = 48 + wave * 6;
        jitterMs = 7 + Math.random() * 3;
        packetLossPct = 0.25 + Math.random() * 0.3;
      }
      connectionType = 'P2P';
      break;
    }
    case 'interruption': {
      const cyclePos = scenarioSec % 18;
      const linkDown = cyclePos >= 5 && cyclePos < 10;
      const iceRestartWindow = cyclePos >= 10 && cyclePos < 13;
      connectionType = 'RELAY';
      if (linkDown) {
        rttMs = 460 + Math.random() * 60;
        jitterMs = 95 + Math.random() * 20;
        packetLossPct = 24 + Math.random() * 12;
        availableBwKbps = 40;
      } else if (iceRestartWindow) {
        isRecovering = true;
        rttMs = 140 + Math.random() * 25;
        jitterMs = 26 + Math.random() * 8;
        packetLossPct = 2.8 + Math.random() * 1.5;
        availableBwKbps = 480 + Math.random() * 90;
      } else {
        rttMs = 68 + wave * 8;
        jitterMs = 9 + Math.random() * 3;
        packetLossPct = 0.4 + Math.random() * 0.4;
        availableBwKbps = 1620 + wave * 90;
      }
      break;
    }
  }

  rttMs = Number(clamp(rttMs, 12, 650).toFixed(0));
  jitterMs = Number(clamp(jitterMs, 1, 140).toFixed(1));
  packetLossPct = Number(clamp(packetLossPct, 0, 45).toFixed(1));

  // Effective sending bitrate & FPS depend on whether Adaptive setParameters() is active
  let bitrateKbps: number;
  let fps: number;
  let resolution: string;
  let scaleFactor: number;

  if (isAdaptive) {
    bitrateKbps = Math.min(currentProfile.maxBitrateKbps, Math.max(120, availableBwKbps * 0.94));
    resolution = currentProfile.resolution;
    scaleFactor = currentProfile.scaleFactor;
    if (packetLossPct > 18) {
      fps = 6 + Math.random() * 3;
    } else if (isRecovering) {
      fps = Math.min(currentProfile.maxFps, 14 + Math.random() * 3);
    } else {
      const lossPenalty = packetLossPct > 4 ? (packetLossPct - 4) * 0.45 : 0;
      fps = clamp(currentProfile.maxFps - lossPenalty + jitterNoise * 0.6, 11, currentProfile.maxFps);
    }
  } else {
    // Baseline browser WebRTC without NetAdapt's proactive setParameters() scaling
    bitrateKbps = clamp(
      Math.min(2050, availableBwKbps * 1.12),
      80,
      2200
    );
    resolution = availableBwKbps < 320 ? '640x360' : '1280x720';
    scaleFactor = resolution === '1280x720' ? 1.0 : 2.0;

    // Frequent frame freezes under packet loss / low BW congestion
    if (packetLossPct > 15) {
      fps = 0;
    } else if (packetLossPct > 5.5 || availableBwKbps < 460) {
      fps = Math.random() < 0.42 ? 2 + Math.random() * 2.5 : 8 + Math.random() * 6;
    } else if (rttMs > 220) {
      fps = 16 + Math.random() * 5;
    } else {
      fps = clamp(29.5 + jitterNoise * 1.1, 24, 30);
    }
  }

  bitrateKbps = Number(bitrateKbps.toFixed(0));
  fps = Number(fps.toFixed(0));

  const { nqs } = computeNqsBreakdown(rttMs, packetLossPct, jitterMs, bitrateKbps, config);
  const smoothNqs = Number(
    (config.emaAlpha * nqs + (1 - config.emaAlpha) * prev.smoothNqs).toFixed(1)
  );

  // Hysteresis FSM evaluation
  let nextState: QualityState = prev.qualityState;
  let downgradeCounter = prev.downgradeCounter;
  let upgradeCounter = prev.upgradeCounter;
  let transitionReason: string | null = null;

  if (
    prev.qualityState !== 'POOR' &&
    (packetLossPct > config.emergencyLossPct || smoothNqs < config.emergencyNqsThreshold)
  ) {
    nextState = 'POOR';
    downgradeCounter = 0;
    upgradeCounter = 0;
    transitionReason =
      packetLossPct > config.emergencyLossPct
        ? `Emergency drop: PLR ${packetLossPct}% > ${config.emergencyLossPct}%`
        : `Emergency drop: NQS ${smoothNqs} < ${config.emergencyNqsThreshold}`;
  } else if (prev.qualityState === 'GOOD') {
    if (smoothNqs < config.downgradeToModerateThreshold) {
      downgradeCounter += 1;
      upgradeCounter = 0;
      if (downgradeCounter >= config.downgradeHoldSec) {
        nextState = 'MODERATE';
        downgradeCounter = 0;
        transitionReason = `Held NQS < ${config.downgradeToModerateThreshold} for ${config.downgradeHoldSec}s`;
      }
    } else {
      downgradeCounter = 0;
    }
  } else if (prev.qualityState === 'MODERATE') {
    if (smoothNqs < config.downgradeToPoorThreshold) {
      downgradeCounter += 1;
      upgradeCounter = 0;
      if (downgradeCounter >= config.downgradeHoldSec) {
        nextState = 'POOR';
        downgradeCounter = 0;
        transitionReason = `Held NQS < ${config.downgradeToPoorThreshold} for ${config.downgradeHoldSec}s`;
      }
    } else if (smoothNqs > config.upgradeToGoodThreshold) {
      upgradeCounter += 1;
      downgradeCounter = 0;
      if (upgradeCounter >= config.upgradeHoldSec) {
        nextState = 'GOOD';
        upgradeCounter = 0;
        transitionReason = `Stable NQS > ${config.upgradeToGoodThreshold} for ${config.upgradeHoldSec}s`;
      }
    } else {
      downgradeCounter = 0;
      upgradeCounter = 0;
    }
  } else if (prev.qualityState === 'POOR') {
    if (smoothNqs > config.upgradeToModerateThreshold) {
      upgradeCounter += 1;
      downgradeCounter = 0;
      if (upgradeCounter >= config.upgradeHoldSec) {
        nextState = 'MODERATE';
        upgradeCounter = 0;
        transitionReason = `Recovered NQS > ${config.upgradeToModerateThreshold} for ${config.upgradeHoldSec}s`;
      }
    } else {
      upgradeCounter = 0;
    }
  }

  const now = Date.now();
  const transition: StateTransitionEvent | null =
    nextState !== prev.qualityState && transitionReason
      ? {
          id: `tr-${now}-${elapsedSec}`,
          timestamp: now,
          elapsedSec,
          fromState: prev.qualityState,
          toState: nextState,
          reason: transitionReason,
          smoothNqs,
          mode,
        }
      : null;

  // Apply updated state resolution if adaptive switched on this tick
  if (isAdaptive && nextState !== prev.qualityState) {
    resolution = STATE_PROFILES[nextState].resolution;
    scaleFactor = STATE_PROFILES[nextState].scaleFactor;
  }

  const sample: TelemetrySample = {
    timestamp: now,
    elapsedSec,
    connectionType,
    rttMs,
    jitterMs,
    packetLossPct,
    bitrateKbps,
    fps,
    resolution,
    scaleFactor,
    nqs,
    smoothNqs,
    qualityState: nextState,
    mode,
    scenario,
    mosEstimate: estimateMos(rttMs, jitterMs, packetLossPct),
    isFrozen: fps < 5,
    isRecovering,
  };

  return {
    nextEngine: {
      elapsedSec,
      scenarioSec,
      qualityState: nextState,
      smoothNqs,
      downgradeCounter,
      upgradeCounter,
    },
    sample,
    transition,
  };
}

export function exportTelemetryToCsv(samples: TelemetrySample[], roomId: string): void {
  if (samples.length === 0) return;

  const headers = [
    'timestamp',
    'elapsedSec',
    'roomId',
    'connectionType',
    'rttMs',
    'jitterMs',
    'packetLossPct',
    'bitrateKbps',
    'fps',
    'resolution',
    'nqs',
    'smoothNqs',
    'qualityState',
    'mode',
    'scenario',
    'mosEstimate',
  ];

  const rows = samples.map((s) =>
    [
      s.timestamp,
      s.elapsedSec,
      roomId,
      s.connectionType,
      s.rttMs,
      s.jitterMs,
      s.packetLossPct,
      s.bitrateKbps,
      s.fps,
      s.resolution,
      s.nqs,
      s.smoothNqs,
      s.qualityState,
      s.mode,
      s.scenario,
      s.mosEstimate,
    ].join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.href = url;
  link.download = `netadapt-${roomId}-${dateTag}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
