import React from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_NQS_CONFIG, STATE_PROFILES } from '../algorithm/nqsEngine';
import { NQSConfig } from '../types/netadapt';

interface SettingsViewProps {
  config: NQSConfig;
  onChangeConfig: (next: NQSConfig) => void;
  onResetDefaults: () => void;
  roomId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onChangeConfig,
  onResetDefaults,
  roomId,
}) => {
  const weightSum = config.wRtt + config.wLoss + config.wJitter + config.wBw;

  const updateField = <K extends keyof NQSConfig>(key: K, value: NQSConfig[K]) => {
    onChangeConfig({ ...config, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Settings & NQS Algorithm Calibration
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Adjust composite NQS weights, EMA smoothing α, and hysteresis hold counters live. Changes apply immediately to the active Meeting Room and Analytics engine.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          className="px-3.5 py-2 text-xs font-medium bg-[#111114] hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-200 transition-colors flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Paper Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weights & EMA Smoothing */}
        <section className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-semibold text-zinc-100">Composite NQS Weights & EMA</h2>
            <span className="font-mono tabular-nums text-xs text-zinc-400">
              Σw = {weightSum.toFixed(2)} (auto-normalized)
            </span>
          </div>

          <div className="space-y-4">
            {[
              { key: 'wRtt' as const, label: 'w₁ · Round-Trip Time (S_RTT)', val: config.wRtt },
              { key: 'wLoss' as const, label: 'w₂ · Packet Loss Rate (S_loss)', val: config.wLoss },
              { key: 'wJitter' as const, label: 'w₃ · Jitter Variance (S_jitter)', val: config.wJitter },
              { key: 'wBw' as const, label: 'w₄ · Outgoing Bitrate (S_bw)', val: config.wBw },
            ].map((item) => (
              <label key={item.key} className="block space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300">{item.label}</span>
                  <span className="font-mono tabular-nums text-zinc-100">
                    {item.val.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.6}
                  step={0.05}
                  value={item.val}
                  onChange={(e) => updateField(item.key, Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </label>
            ))}

            <div className="pt-3 border-t border-zinc-800/80">
              <label className="block space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300">EMA Smoothing Factor (α)</span>
                  <span className="font-mono tabular-nums text-blue-400">
                    {config.emaAlpha.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  value={config.emaAlpha}
                  onChange={(e) => updateField('emaAlpha', Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>0.10 (Heavier smoothing)</span>
                  <span>0.80 (Faster reaction)</span>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* Hysteresis FSM Thresholds & Hold Counters */}
        <section className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-semibold text-zinc-100">
              Asymmetric Hysteresis FSM Rules
            </h2>
            <span className="font-mono text-xs text-zinc-500">Fast down · Slow up</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">GOOD → MODERATE</span>
                <span className="font-mono tabular-nums text-amber-400">
                  &lt; {config.downgradeToModerateThreshold}
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={75}
                step={1}
                value={config.downgradeToModerateThreshold}
                onChange={(e) =>
                  updateField('downgradeToModerateThreshold', Number(e.target.value))
                }
                className="w-full accent-amber-500"
              />
            </label>

            <label className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">MODERATE → GOOD</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  &gt; {config.upgradeToGoodThreshold}
                </span>
              </div>
              <input
                type="range"
                min={65}
                max={90}
                step={1}
                value={config.upgradeToGoodThreshold}
                onChange={(e) => updateField('upgradeToGoodThreshold', Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </label>

            <label className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">MODERATE → POOR</span>
                <span className="font-mono tabular-nums text-rose-400">
                  &lt; {config.downgradeToPoorThreshold}
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={55}
                step={1}
                value={config.downgradeToPoorThreshold}
                onChange={(e) => updateField('downgradeToPoorThreshold', Number(e.target.value))}
                className="w-full accent-rose-500"
              />
            </label>

            <label className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">POOR → MODERATE</span>
                <span className="font-mono tabular-nums text-amber-400">
                  &gt; {config.upgradeToModerateThreshold}
                </span>
              </div>
              <input
                type="range"
                min={35}
                max={65}
                step={1}
                value={config.upgradeToModerateThreshold}
                onChange={(e) =>
                  updateField('upgradeToModerateThreshold', Number(e.target.value))
                }
                className="w-full accent-amber-500"
              />
            </label>

            <label className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">Downgrade Hold</span>
                <span className="font-mono tabular-nums text-zinc-100">
                  {config.downgradeHoldSec}s
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={config.downgradeHoldSec}
                onChange={(e) => updateField('downgradeHoldSec', Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </label>

            <label className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">Upgrade Hold</span>
                <span className="font-mono tabular-nums text-zinc-100">
                  {config.upgradeHoldSec}s
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={12}
                step={1}
                value={config.upgradeHoldSec}
                onChange={(e) => updateField('upgradeHoldSec', Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </label>
          </div>

          {/* Target Encoding Ladder */}
          <div className="pt-3 border-t border-zinc-800/80">
            <div className="text-xs font-medium text-zinc-400 mb-2">
              RTCRtpSender.setParameters() Target Ladder
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
              {(['GOOD', 'MODERATE', 'POOR'] as const).map((st) => {
                const p = STATE_PROFILES[st];
                return (
                  <div
                    key={st}
                    className="p-2.5 rounded-lg bg-[#09090B] border border-zinc-800/90 space-y-0.5"
                  >
                    <div
                      className={
                        st === 'GOOD'
                          ? 'text-emerald-400'
                          : st === 'MODERATE'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }
                    >
                      {st}
                    </div>
                    <div className="text-zinc-200">{p.resolution}</div>
                    <div className="text-[11px] text-zinc-500">
                      {p.maxFps}fps · {p.maxBitrateKbps}k
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Existing Frontend .env Signaling & ICE Contract Reference */}
        <section className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            Signaling & ICE Environment Reference
          </h2>
          <p className="text-xs text-zinc-400">
            Active room <span className="font-mono text-zinc-200">{roomId}</span> aligns with your
            existing <span className="font-mono text-zinc-300">netadapt-frontend</span> contract.
            In Month 10, static TURN credentials transition to short-lived HMAC-SHA1 tokens.
          </p>
          <pre className="p-3.5 rounded-lg bg-[#09090B] border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
{`VITE_SIGNALING_URL=http://localhost:3001
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=turn:openrelay.metered.ca:80
VITE_TURN_USERNAME=<ephemeral-in-month-10>
VITE_TURN_CREDENTIAL=<never-commit-to-git>`}
          </pre>
        </section>

        {/* Keyboard Navigation Shortcuts */}
        <section className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            High-Performance Keyboard Shortcuts
          </h2>
          <div className="divide-y divide-zinc-800/70 text-xs">
            {[
              { key: '⌘K / Ctrl+K', desc: 'Open global command palette & fault launcher' },
              { key: 'M', desc: 'Toggle microphone mute in Meeting Room' },
              { key: 'V', desc: 'Toggle local camera stream in Meeting Room' },
              { key: 'A', desc: 'Toggle Adaptive Algorithm vs Baseline WebRTC' },
              { key: 'E', desc: 'Download recorded telemetry as RFC-4180 CSV' },
            ].map((row) => (
              <div key={row.key} className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-zinc-300">{row.desc}</span>
                <kbd className="font-mono text-[11px] text-zinc-300 bg-[#09090B] border border-zinc-800 px-2 py-0.5 rounded shrink-0">
                  {row.key}
                </kbd>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-zinc-500 pt-1">
            Paper default weights: w₁={DEFAULT_NQS_CONFIG.wRtt}, w₂={DEFAULT_NQS_CONFIG.wLoss},
            w₃={DEFAULT_NQS_CONFIG.wJitter}, w₄={DEFAULT_NQS_CONFIG.wBw}, α=
            {DEFAULT_NQS_CONFIG.emaAlpha}.
          </div>
        </section>
      </div>
    </div>
  );
};
