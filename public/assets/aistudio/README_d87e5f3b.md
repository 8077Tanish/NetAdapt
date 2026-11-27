# NetAdapt frontend

A responsive React + Vite + Tailwind CSS frontend for the P2P Adaptive WebRTC Video Conferencing System. The UI follows the NetAdapt landing-page and dark meeting-dashboard mockup.

## What's included

- Responsive landing page with **Create meeting** and **Join meeting** flows.
- Dark meeting room with local camera preview, remote video tile, microphone/camera controls, screen sharing and leave-call control.
- Socket.IO chat panel and room signaling adapter.
- WebRTC peer manager using `RTCPeerConnection`, STUN/TURN configuration and queued ICE candidates.
- Live telemetry: RTT, jitter, packet loss, outgoing bitrate, FPS, resolution, connection type and Network Quality Score (NQS).
- GOOD / MODERATE / POOR quality state machine with the thresholds and hold counters in the system plan.
- Adaptive video sender parameters using `RTCRtpSender.setParameters()`.
- CSV export of recorded metric samples.
- `public/netadapt-ui-reference.png` — the generated UI mockup for visual reference.

## Requirements

- Node.js 20 LTS or newer (Node.js 22 is also suitable).
- npm 10 or newer.
- Your existing Express + Socket.IO signaling server.
- A modern browser (Chrome or Edge recommended for project testing).
- Camera and microphone permissions. Webcam access on non-localhost deployments requires HTTPS.

## 1. Install

Open a terminal in this folder:

```bash
npm install
```

## 2. Configure the signaling server URL

Copy the example environment file:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux**

```bash
cp .env.example .env
```

Open `.env` and set the URL of your existing Socket.IO server:

```env
VITE_SIGNALING_URL=http://localhost:3001
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

Change port `3001` if your signaling server listens on a different port. For a TURN relay, set `VITE_TURN_URL`, `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL` to the credentials from your TURN provider. Do not commit private TURN credentials to GitHub.

Vite reads environment variables when it starts. Stop and restart the dev server after changing `.env`.

## 3. Start the existing signaling server

Start your existing Node.js + Express + Socket.IO backend in its own terminal using its existing start command. In the implementation plan, this is the `server/index.js` service.

The frontend expects the signaling service at the URL configured by `VITE_SIGNALING_URL`.

## 4. Run the frontend

In another terminal, from this `netadapt-frontend` folder:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Allow camera and microphone permissions. Create a room in one browser window, then open the same URL in a second browser window or another device and join using the displayed room ID.

For two-device testing, both devices must be able to reach the signaling server. For a deployed or LAN test, use HTTPS for the frontend because browsers restrict camera/microphone access to secure contexts (localhost is allowed for local development).

## 5. Production build

```bash
npm run build
```

The deployable static files are written to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

Deploy `dist/` to Vercel, Netlify or another static hosting provider. Configure the same `VITE_SIGNALING_URL` and ICE environment variables in the hosting provider's build environment before building.

## Existing integration contract

This frontend deliberately keeps the event names and basic payload shapes from the supplied system design:

| Direction | Socket.IO event | Payload |
| --- | --- | --- |
| Browser → server | `join-room` | `{ roomId, username }` |
| Server → existing peer | `peer-joined` | `{ roomId, username? }` |
| Server → browser | `offer` | `{ roomId, sdp }` |
| Browser → server | `offer` | `{ roomId, sdp }` |
| Server → browser | `answer` | `{ roomId, sdp }` |
| Browser → server | `answer` | `{ roomId, sdp }` |
| Both directions | `ice-candidate` | `{ roomId, candidate }` |
| Both directions | `chat-message` | `{ roomId, sender, text, time }` |
| Browser → server | `leave-room` | `{ roomId }` |

The peer manager listens for both `peer-joined` and `user-joined`, because the implementation notes use both names in different sections. If your server uses a different event or payload shape, update only `src/core/signaling.js` and `src/core/webrtcManager.js` to match it.

### Telemetry object

The metrics collector returns the shared shape described in the system plan:

```js
{
  timestamp: 1710000000,
  connectionType: 'P2P', // 'P2P' or 'RELAY'
  rttMs: 42,
  jitterMs: 6,
  packetLossPct: 0.4,
  bitrateKbps: 1800,
  fps: 30,
  resolution: '1280x720',
  nqs: 88.5,
  smoothNqs: 88.5
}
```

`qualityState` (`GOOD`, `MODERATE` or `POOR`) and `mode` (`ADAPTIVE` or `BASELINE`) are added by the metrics logger when exporting CSV. The quality score weights, EMA smoothing factor, hysteresis thresholds, target frame rates, scale factors and maximum bitrates are in `src/algorithm/`.

## Project structure

```text
netadapt-frontend/
├── public/
│   └── netadapt-ui-reference.png
├── src/
│   ├── algorithm/
│   │   ├── adaptiveController.js
│   │   ├── hysteresisFSM.js
│   │   ├── qualityScorer.js
│   │   └── statsCollector.js
│   ├── components/
│   │   ├── Brand.jsx
│   │   ├── ChatPanel.jsx
│   │   ├── LandingPage.jsx
│   │   ├── MeetingRoom.jsx
│   │   └── NetworkDashboard.jsx
│   ├── core/
│   │   ├── iceConfig.js
│   │   ├── signaling.js
│   │   └── webrtcManager.js
│   ├── hooks/
│   │   └── useCallSession.js
│   ├── testing/
│   │   ├── csvExporter.js
│   │   └── metricsLogger.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

## Important integration notes

1. **This is a frontend package, not a replacement backend.** Keep your existing Socket.IO server running. The room flow and signaling adapter expect the event contract above.
2. **The supplied signaling contract is one-to-one.** The manager currently maintains one `RTCPeerConnection` for one remote peer. The UI has participant-oriented panels, but actual multi-party Mesh requires peer/socket IDs in signaling messages and one peer connection per remote participant. An SFU requires a different media architecture.
3. **TURN is important for real networks.** STUN alone will not connect every NAT/firewall combination. Configure a TURN server before relying on cross-network demonstrations.
4. **AR filters are a visible integration hook only.** The AR popover identifies where the planned MediaPipe canvas pipeline belongs; this frontend does not claim to apply a remote-visible AR filter yet. Do not use a CSS-only preview filter as a substitute for the `canvas.captureStream()` + `replaceTrack()` pipeline.
5. **Metrics depend on an established WebRTC peer connection.** Until a peer connects and stats become available, the dashboard displays waiting placeholders instead of invented live measurements.
6. **The baseline toggle disables NetAdapt's adaptive `setParameters()` controller.** Browser-native WebRTC congestion handling remains active.

## Troubleshooting

- **“Cannot reach signaling server”:** Check the backend is running, the port in `.env` is correct, and CORS allows the frontend origin.
- **Camera/mic does not start:** Check browser permissions and use `localhost` or HTTPS. Another app may be using the camera.
- **Room opens but no remote video appears:** Confirm both clients joined the same room, check the server relays `offer`, `answer` and `ice-candidate`, and configure TURN for restrictive networks.
- **Chat does not update:** Confirm the server relays `chat-message` to the other socket in that room.
- **CSV export is disabled:** It becomes enabled after WebRTC telemetry samples are collected from an active peer connection.

## Main files to modify when integrating

- Backend URL or event changes: `src/core/signaling.js`
- SDP / ICE / peer-connection behavior: `src/core/webrtcManager.js`
- STUN / TURN: `.env` and `src/core/iceConfig.js`
- NQS weights: `src/algorithm/qualityScorer.js`
- State thresholds / hold counters: `src/algorithm/hysteresisFSM.js`
- Resolution / FPS / bitrate targets: `src/algorithm/adaptiveController.js`
- CSV columns: `src/testing/csvExporter.js`
