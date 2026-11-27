import React, { useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Link2,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Send,
  Sparkles,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { FAULT_SCENARIOS } from '../algorithm/nqsEngine';
import { LiveConnectionPhase } from '../core/webrtcSession';
import {
  AdaptationMode,
  ChatMessage,
  FaultScenarioId,
  ParticipantInfo,
  TelemetrySample,
} from '../types/netadapt';
import { VideoCanvasStage } from './VideoCanvasStage';

interface MeetingViewProps {
  roomId: string;
  username: string;
  micOn: boolean;
  camOn: boolean;
  screenSharing: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteName: string;
  remoteCamOn: boolean;
  remoteMicOn: boolean;
  livePhase: LiveConnectionPhase;
  cameraError: string | null;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onCopyInviteLink: () => void;
  onLeaveCall: () => void;
  sample: TelemetrySample;
  sampleCount: number;
  mode: AdaptationMode;
  onToggleMode: () => void;
  activeScenario: FaultScenarioId;
  onSelectScenario: (id: FaultScenarioId) => void;
  onExportCsv: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  participants: ParticipantInfo[];
}

export const MeetingView: React.FC<MeetingViewProps> = ({
  roomId,
  username,
  micOn,
  camOn,
  screenSharing,
  localStream,
  remoteStream,
  remoteName,
  remoteCamOn,
  remoteMicOn,
  livePhase,
  cameraError,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onCopyInviteLink,
  onLeaveCall,
  sample,
  sampleCount,
  mode,
  onToggleMode,
  activeScenario,
  onSelectScenario,
  onExportCsv,
  messages,
  onSendMessage,
  participants,
}) => {
  const [rightTab, setRightTab] = useState<'chat' | 'participants'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [hudExpanded, setHudExpanded] = useState(true);
  const [openPopover, setOpenPopover] = useState<'none' | 'ar' | 'fault'>('none');
  const [arPreviewOverlay, setArPreviewOverlay] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const isLivePeerConnected = livePhase === 'connected';

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setChatInput('');
  };

  const handleCopyInvite = () => {
    onCopyInviteLink();
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  };

  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference - (Math.min(100, Math.max(0, sample.smoothNqs)) / 100) * circumference;

  const stateMeta =
    sample.qualityState === 'GOOD'
      ? { label: '● Good', color: 'text-emerald-400', stroke: '#10B981' }
      : sample.qualityState === 'MODERATE'
      ? { label: '▲ Moderate', color: 'text-amber-400', stroke: '#F59E0B' }
      : { label: '✖ Poor', color: 'text-rose-400', stroke: '#F43F5E' };

  const activeScenarioObj =
    FAULT_SCENARIOS.find((s) => s.id === activeScenario) || FAULT_SCENARIOS[0];

  return (
    <div className="h-full flex flex-col xl:flex-row gap-5">
      {/* Main Video Stage + Floating Bottom Control Dock */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <VideoCanvasStage
            username={username}
            remoteName={remoteName}
            micOn={micOn}
            camOn={camOn}
            screenSharing={screenSharing}
            localStream={localStream}
            remoteStream={remoteStream}
            remoteCamOn={remoteCamOn}
            remoteMicOn={remoteMicOn}
            livePhase={livePhase}
            cameraError={cameraError}
            sample={sample}
            arPreviewOverlay={arPreviewOverlay}
          />

          {/* Live 2-User Status / Invite Bar or Solo Fault Profile Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <div className="flex items-center gap-2 text-zinc-400 min-w-0">
              {isLivePeerConnected ? (
                <>
                  <span className="font-mono text-emerald-400">● Live 2-User WebRTC</span>
                  <span className="text-zinc-600" aria-hidden="true">·</span>
                  <span className="text-zinc-300 truncate">
                    Real <span className="font-mono">pc.getStats()</span> &{' '}
                    <span className="font-mono">setParameters()</span> active with {remoteName}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-zinc-500">
                    {livePhase === 'negotiating'
                      ? 'Connecting peer...'
                      : livePhase === 'room_full'
                      ? 'Room full (2/2)'
                      : 'Waiting for 2nd user ·'}
                  </span>
                  {livePhase !== 'negotiating' && livePhase !== 'room_full' && (
                    <span className="text-zinc-300 truncate">
                      Solo Fault Lab: {activeScenarioObj.label}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!isLivePeerConnected && (
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                >
                  {copiedInvite ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedInvite ? 'Invite link copied' : `Copy invite (?room=${roomId})`}</span>
                </button>
              )}
              <span className="font-mono tabular-nums text-[11px] text-zinc-500">
                MOS {sample.mosEstimate.toFixed(2)} / 4.50
              </span>
            </div>
          </div>
        </div>

        {/* Floating Minimalist Bottom Control Dock */}
        <div className="relative flex items-center justify-center py-1">
          {openPopover === 'ar' && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-80 bg-[#111114] border border-zinc-800 rounded-xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-100">
                  AR Canvas Pipeline (Month 7 Track)
                </span>
                <button
                  type="button"
                  onClick={() => setOpenPopover('none')}
                  className="text-zinc-500 hover:text-zinc-200"
                  aria-label="Close AR panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Remote-visible AR requires <span className="font-mono text-zinc-300">MediaPipe Face Landmarker</span>{' '}
                piped through <span className="font-mono text-zinc-300">canvas.captureStream(30)</span> and{' '}
                <span className="font-mono text-zinc-300">sender.replaceTrack()</span>. CSS filters are
                intentionally avoided.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                <span className="text-xs text-zinc-300">Local landmark guide hook</span>
                <button
                  type="button"
                  onClick={() => setArPreviewOverlay((v) => !v)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    arPreviewOverlay
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {arPreviewOverlay ? 'Active' : 'Preview Hook'}
                </button>
              </div>
            </div>
          )}

          {openPopover === 'fault' && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-80 sm:w-96 bg-[#111114] border border-zinc-800 rounded-xl p-3 shadow-2xl space-y-2">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-zinc-800">
                <span className="text-xs font-semibold text-zinc-100">
                  {isLivePeerConnected
                    ? 'Live WebRTC Active (Use Clumsy / tc netem)'
                    : 'Inject Solo Network Fault'}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenPopover('none')}
                  className="text-zinc-500 hover:text-zinc-200"
                  aria-label="Close fault simulator"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {isLivePeerConnected ? (
                <p className="text-xs text-zinc-400 px-1 py-2 leading-relaxed">
                  You are connected to a real remote peer ({remoteName}). Telemetry now reads directly from live{' '}
                  <span className="font-mono text-zinc-200">RTCPeerConnection.getStats()</span>. Apply Clumsy or{' '}
                  <span className="font-mono text-zinc-200">tc netem</span> on either machine to test real congestion.
                </p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {FAULT_SCENARIOS.map((sc) => {
                    const selected = sc.id === activeScenario;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => {
                          onSelectScenario(sc.id);
                          setOpenPopover('none');
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                          selected
                            ? 'bg-blue-600/20 text-zinc-100 border border-blue-500/40'
                            : 'text-zinc-300 hover:bg-zinc-800/70 border border-transparent'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">
                            {sc.code}. {sc.label}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {sc.simulatedParams}
                          </div>
                        </div>
                        {selected && (
                          <span className="font-mono text-[10px] text-blue-400 shrink-0">Active</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="inline-flex items-center gap-2.5 px-3 py-2 bg-[#111114] border border-zinc-800 rounded-full">
            <button
              type="button"
              onClick={onToggleMic}
              title={micOn ? 'Mute microphone (M)' : 'Unmute microphone (M)'}
              aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                micOn
                  ? 'bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onToggleCam}
              title={camOn ? 'Turn camera off (V)' : 'Turn camera on (V)'}
              aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                camOn
                  ? 'bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onToggleScreenShare}
              title={screenSharing ? 'Stop screen share (S)' : 'Share screen (S)'}
              aria-label={screenSharing ? 'Stop screen share' : 'Share screen'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                screenSharing
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700'
              }`}
            >
              {screenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setOpenPopover((p) => (p === 'ar' ? 'none' : 'ar'))}
              title="AR Pipeline Hook (Month 7)"
              aria-label="AR Pipeline Hook"
              className={`h-10 px-3 rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                openPopover === 'ar' || arPreviewOverlay
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                  : 'bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AR</span>
            </button>

            <button
              type="button"
              onClick={() => setOpenPopover((p) => (p === 'fault' ? 'none' : 'fault'))}
              title={isLivePeerConnected ? 'Live WebRTC stats info' : 'Inject network fault scenario'}
              aria-label="Network fault simulator"
              className={`h-10 px-3 rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                openPopover === 'fault' || (!isLivePeerConnected && activeScenario !== 'normal')
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isLivePeerConnected ? 'Live Stats' : 'Fault Sim'}
              </span>
            </button>

            <div className="w-px h-5 bg-zinc-800 mx-0.5" />

            <button
              type="button"
              onClick={onLeaveCall}
              title="Leave meeting"
              aria-label="Leave meeting"
              className="w-11 h-10 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Split Rail (348px): Chat/Participants Top + Network Dashboard Bottom */}
      <aside className="w-full xl:w-[348px] shrink-0 flex flex-col gap-4">
        {/* Top Panel: Real Socket.IO Chat & Participants */}
        <section className="flex-1 min-h-[260px] max-h-[380px] xl:max-h-none bg-[#111114] border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-zinc-800 px-2 pt-2 gap-1">
            <button
              type="button"
              onClick={() => setRightTab('chat')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                rightTab === 'chat'
                  ? 'border-blue-500 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setRightTab('participants')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                rightTab === 'participants'
                  ? 'border-blue-500 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Participants ({participants.length}/2)
            </button>
          </div>

          {rightTab === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-500 text-center px-4">
                    Room chat is synced live over Socket.IO. Open the invite link in another tab or device to chat and call in real time.
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                          msg.isSelf
                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                            : 'bg-zinc-800 text-zinc-200'
                        }`}
                      >
                        {msg.sender.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 text-xs">
                          <span className="font-medium text-zinc-200">{msg.sender}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{msg.time}</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-300 bg-zinc-900/90 border border-zinc-800/80 rounded-lg px-2.5 py-1.5 inline-block max-w-full break-words">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={handleChatSubmit}
                className="p-2.5 border-t border-zinc-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Message room over Socket.IO..."
                  className="flex-1 bg-[#09090B] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-blue-600 text-zinc-200 hover:text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b border-zinc-800/70 last:border-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-200 shrink-0">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-zinc-100 truncate">
                        {p.name} {p.isSelf ? '(You)' : ''}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {p.role} · {p.connectionType}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 shrink-0">
                    {p.micOn ? (
                      <Mic className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <MicOff className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    {p.camOn ? (
                      <Video className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <VideoOff className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </div>
                </div>
              ))}
              {participants.length < 2 && (
                <div className="pt-2 space-y-2">
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Waiting for a second user to join <span className="font-mono text-zinc-300">{roomId}</span>. Open this app in another browser tab or send the invite link to another device.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="w-full py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 transition-colors"
                  >
                    {copiedInvite ? 'Copied Invite URL' : 'Copy Room Invite URL'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Bottom Panel: Collapsible Network Dashboard */}
        <section className="bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800/80">
            <button
              type="button"
              onClick={() => setHudExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100 hover:text-white"
            >
              <span>Network Dashboard</span>
              {hudExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </button>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-[11px] text-zinc-400">Adaptive Mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={mode === 'ADAPTIVE'}
                onClick={onToggleMode}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  mode === 'ADAPTIVE' ? 'bg-blue-600' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    mode === 'ADAPTIVE' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          </div>

          {hudExpanded ? (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-8 grid grid-cols-3 gap-x-2.5 gap-y-3.5">
                  <div>
                    <div className="text-[11px] text-zinc-500">RTT</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-blue-400">
                      {sample.rttMs}
                      <span className="text-[10px] text-zinc-500 font-normal ml-0.5">ms</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">Jitter</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-emerald-400">
                      {sample.jitterMs}
                      <span className="text-[10px] text-zinc-500 font-normal ml-0.5">ms</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">Packet Loss</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-amber-400">
                      {sample.packetLossPct.toFixed(1)}
                      <span className="text-[10px] text-zinc-500 font-normal">%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">Bitrate</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-zinc-100">
                      {sample.bitrateKbps >= 1000
                        ? (sample.bitrateKbps / 1000).toFixed(1)
                        : sample.bitrateKbps}
                      <span className="text-[10px] text-zinc-500 font-normal ml-0.5">
                        {sample.bitrateKbps >= 1000 ? 'Mbps' : 'kbps'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">FPS</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-zinc-100">
                      {sample.fps}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">NQS</div>
                    <div className="relative w-12 h-12 -mt-0.5 flex items-center justify-center">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 50 50">
                        <circle
                          cx="25"
                          cy="25"
                          r={radius}
                          fill="none"
                          stroke="#27272A"
                          strokeWidth="3.5"
                        />
                        <circle
                          cx="25"
                          cy="25"
                          r={radius}
                          fill="none"
                          stroke={stateMeta.stroke}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          className="transition-all duration-300"
                        />
                      </svg>
                      <span className="absolute font-mono tabular-nums text-xs font-semibold text-zinc-100">
                        {Math.round(sample.smoothNqs)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="col-span-4 pl-3 border-l border-zinc-800 space-y-2.5">
                  <div>
                    <div className="text-[11px] text-zinc-500">Connection</div>
                    <div className="font-mono text-sm font-semibold text-zinc-100 mt-0.5">
                      {sample.connectionType}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">Quality State</div>
                    <div className={`font-mono text-xs font-semibold mt-0.5 ${stateMeta.color}`}>
                      {stateMeta.label}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onExportCsv}
                disabled={sampleCount === 0}
                className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>Download CSV ({sampleCount} ticks)</span>
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 flex items-center justify-between text-xs font-mono tabular-nums text-zinc-400">
              <span className={stateMeta.color}>{stateMeta.label}</span>
              <span>NQS {sample.smoothNqs.toFixed(0)}</span>
              <span>{sample.resolution}</span>
              <span>{sample.fps} fps</span>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
};
