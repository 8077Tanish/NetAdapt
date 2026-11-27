# P2P Adaptive WebRTC Video Conferencing System
## Complete System Design, Architecture & Implementation Plan

---

## 1. Project Overview & Tech Stack

Your team is building a **browser-to-browser (P2P) video calling application** with three major features that elevate it from a basic clone to a final-year engineering project:
1. **Direct P2P Media Streaming** using WebRTC (low latency, privacy-preserving).
2. **Real-Time Network Adaptation Algorithm** that monitors connection health and smoothly adjusts video quality without freezing the call.
3. **Experimental Validation + AR Filters** (proving your algorithm outperforms default WebRTC under bad networks, plus real-time face filters).

### Recommended Tech Stack (Beginner-Friendly & Reliable)

| Layer | Technology | Why Choose This? |
| :--- | :--- | :--- |
| **Frontend UI** | React (Vite) + Tailwind CSS | Fast setup, clean components, easy to build live dashboards. |
| **Signaling Server** | Node.js + Express + Socket.IO | Minimal boilerplate (~80 lines of code) to exchange WebRTC handshakes and chat. |
| **Media & Networking** | Native Browser WebRTC API (`RTCPeerConnection`) | Built into Chrome/Firefox/Edge; gives direct access to `getStats()` and `setParameters()`. |
| **NAT Traversal** | Google STUN (free) + Metered.ca / Coturn (TURN) | Required so calls work across different Wi-Fi networks and mobile hotspots. |
| **AR Filters** | MediaPipe Face Landmarker (`@mediapipe/tasks-vision`) + HTML5 `<canvas>` | Runs directly in the browser at 30 FPS with no backend GPU server needed. |
| **Network Simulation** | **Clumsy** (Windows) or **`tc netem`** (Linux) | Lets Member 3 inject exact packet loss, latency, jitter, and bandwidth limits. |
| **Data Analysis & Plots** | In-app CSV Exporter + Python (`matplotlib` / `pandas`) or Excel | Turns live test runs into publication-grade graphs for your report and PPT. |
| **Deployment** | Vercel/Netlify (Frontend) + Render/Railway (Signaling) | Free tiers with automatic **HTTPS** (mandatory for webcam access). |

---

## 2. Full System Architecture

### 2.1 High-Level Architecture Diagram

```text
+-----------------------------------------------------------------------------+
|                        SIGNALING SERVER (Node.js + Socket.IO)               |
|    Handles ONLY lightweight JSON: Room Join, SDP Offer/Answer, ICE, Chat    |
+-----------------------------------------------------------------------------+
               ^                                               ^
               | WebSockets (Signaling Only)                   | WebSockets
               v                                               v
+-------------------------------+               +-----------------------------+
|            PEER A             |               |           PEER B            |
|  +-------------------------+  |               |  +-----------------------+  |
|  | Webcam -> AR Canvas     |  |               |  | Remote <video> Player |  |
|  | (MediaPipe Face Filter) |  |               |  +-----------------------+  |
|  +------------+------------+  |               |              ^              |
|               | MediaStream   |               |              |              |
|               v               |               |              |              |
|  +-------------------------+  |  Direct P2P   |  +-----------------------+  |
|  |   RTCPeerConnection     |==================|  |   RTCPeerConnection   |  |
|  |  (Audio + Video + UDP)  |  | (STUN / TURN) |  |                       |  |
|  +------+-----------+------+  |               |  +-----------------------+  |
|         |           ^         |               +-----------------------------+
|  getStats()    setParameters()|
|  (every 1s)    (bitrate/FPS)  |
|         v           |         |
|  +-------------------------+  |
|  |  Adaptation Engine      |  |
|  |  1. Metrics Collector   |  |
|  |  2. NQS Calculator      |  |
|  |  3. Hysteresis FSM      |  |
|  |  4. Quality Controller  |  |
|  +------------+------------+  |
|               |               |
|               v               |
|  +-------------------------+  |
|  | Live HUD & CSV Logger   |  |
|  +-------------------------+  |
+-------------------------------+
```

### 2.2 Step-by-Step Connection Lifecycle (How a Call Actually Starts)

1. **Room Join:** Peer A opens the app, enters Room ID `room-101`, and sends `join-room` to the Socket.IO server.
2. **Local Media Capture:** Peer A requests camera/mic via `navigator.mediaDevices.getUserMedia()`. If AR is enabled, the video routes through the AR `<canvas>` first.
3. **Peer Discovery:** Peer B joins `room-101`. The server notifies Peer A (`user-joined`).
4. **SDP Offer/Answer Exchange:**
   * Peer A creates an `RTCPeerConnection`, attaches local audio/video tracks, calls `createOffer()`, sets it as Local Description, and sends the SDP Offer to Peer B via Socket.IO.
   * Peer B sets Peer A's offer as Remote Description, calls `createAnswer()`, sets it as Local Description, and sends the SDP Answer back to Peer A.
5. **ICE Candidate Trickling:** Both browsers ask the **STUN server** for their public IP/port pairs (ICE candidates) and exchange them through Socket.IO.
6. **P2P Connection Established:** Both peers punch through NAT and connect directly over UDP (falling back to a **TURN relay server** only if a strict firewall blocks direct P2P).
7. **Continuous Adaptation Loop:** Every $1\text{ second}$, Peer A polls `pc.getStats()`, feeds metrics into the Adaptation Engine, updates the UI dashboard, logs a CSV row, and adjusts outgoing video parameters if needed.

---

## 3. Recommended Repository & Folder Structure

To prevent 4 teammates from constantly overwriting each other's code in Git, split the codebase cleanly by **module ownership**:

```text
p2p-adaptive-webrtc/
├── server/                         # [Owned by Member 1 & Member 4]
│   ├── package.json
│   └── index.js                    # Express + Socket.IO signaling server
│
├── client/                         # React + Vite frontend
│   ├── package.json
│   └── src/
│       ├── core/                   # [Owned by Member 1: WebRTC + P2P]
│       │   ├── signaling.js        # Socket.IO wrapper
│       │   ├── webrtcManager.js    # RTCPeerConnection, ICE, Offer/Answer, Recovery
│       │   └── iceConfig.js        # STUN/TURN server credentials
│       │
│       ├── algorithm/              # [Owned by Member 2: Adaptation Algorithm]
│       │   ├── statsCollector.js   # Parses pc.getStats() into clean metrics
│       │   ├── qualityScorer.js    # Computes NQS + EMA smoothing
│       │   ├── hysteresisFSM.js    # State machine (GOOD / MODERATE / POOR)
│       │   └── adaptiveController.js # Calls sender.setParameters()
│       │
│       ├── testing/                # [Owned by Member 3: Telemetry & Logging]
│       │   ├── metricsLogger.js    # Records time-series data in memory
│       │   └── csvExporter.js      # Downloads test run as .csv file
│       │
│       ├── ar/                     # [Owned by Member 4: AR Filters]
│       │   └── arPipeline.js       # MediaPipe Face Landmarker + Canvas stream
│       │
│       ├── components/             # [Owned by Member 4: UI/UX]
│       │   ├── Lobby.jsx           # Login / Create & Join Room
│       │   ├── VideoRoom.jsx       # Main call screen & video tiles
│       │   ├── ControlBar.jsx      # Mute, Cam, Screen Share, AR, Algo Toggle
│       │   ├── ChatPanel.jsx       # Real-time text chat
│       │   └── NetworkDashboard.jsx# Live RTT, Jitter, Loss, Quality HUD
│       │
│       └── App.jsx                 # Integrates all modules
│
└── experiments/                    # [Owned by Member 3: Data & Graphs]
    ├── raw_csv/                    # Exported CSV logs (Baseline vs Adaptive)
    ├── analyze_results.py          # Python script to generate comparison charts
    └── plots/                      # PNG graphs for final report & viva PPT
```

> **Integration Contract Hint:** Agree on a single shared JavaScript object shape early in Week 1 so everyone can code independently!
> ```javascript
> // Shared Telemetry Object passed from Member 2 -> Member 3 & Member 4
> {
>   timestamp: 1710000000,
>   connectionType: "P2P",      // "P2P" (host/srflx) or "RELAY" (TURN)
>   rttMs: 42,                  // Round-Trip Time in ms
>   jitterMs: 6,                // Jitter in ms
>   packetLossPct: 0.4,         // Percentage (0 to 100)
>   bitrateKbps: 1800,          // Sending bitrate in kbps
>   fps: 30,                    // Current frames per second
>   resolution: "1280x720",     // Current video dimensions
>   nqs: 88.5,                  // Network Quality Score (0 to 100)
>   qualityState: "GOOD"        // "GOOD" | "MODERATE" | "POOR"
> }
> ```

---

## 4. Deep Dive: Module-by-Module Design & Hints

### 👨‍💻 Module 1: WebRTC + P2P Networking (Member 1)

**Core Responsibilities:** Signaling, Peer Connection setup, NAT traversal, and automatic recovery.

#### A. Signaling Events Specification
Keep your Socket.IO server stateless and focused on these exact events:
* `join-room` `{ roomId, username }` $\rightarrow$ Joins Socket.IO room; emits `peer-joined` to existing user.
* `offer` `{ roomId, sdp }` $\rightarrow$ Relays SDP offer to the other peer.
* `answer` `{ roomId, sdp }` $\rightarrow$ Relays SDP answer back.
* `ice-candidate` `{ roomId, candidate }` $\rightarrow$ Relays network candidates as they are discovered.
* `chat-message` `{ roomId, sender, text, time }` $\rightarrow$ Broadcasts chat messages.
* `leave-room` / `disconnect` $\rightarrow$ Notifies peer to clean up remote video.

#### B. Key Implementation Hints
1. **Handling ICE Candidates Safely:** Sometimes ICE candidates arrive *before* `setRemoteDescription()` finishes, causing a crash. Queue incoming candidates in an array until `remoteDescription` is set, then flush the queue.
2. **Detecting P2P vs. Relay:** Inside `pc.getStats()`, find the active `candidate-pair` (where `state === "succeeded"` and `nominated === true`). Look up its `localCandidateId` and `remoteCandidateId`. If `candidateType === "relay"`, display **RELAY (TURN)**; otherwise display **P2P**.
3. **Connection Recovery:** Listen to `pc.oniceconnectionstatechange`. When state becomes `"disconnected"` or `"failed"`, trigger an **ICE Restart**:
   * Wait $2\text{ seconds}$ (in case of a brief Wi-Fi blip).
   * If still disconnected, call `pc.createOffer({ iceRestart: true })` and send the new offer over Socket.IO.
   * Member 3 will measure how fast this recovers (**Recovery Time**).

---

### 👨‍💻 Module 2: Network Adaptation Algorithm (Member 2 — Core Research)

**Core Responsibilities:** Extract live stats, compute a smooth Network Quality Score, apply hysteresis, and dynamically adapt video output.

#### A. Extracting Stats from `pc.getStats()`
Run a `setInterval` every $\Delta t = 1\text{ second}$. Read three WebRTC report types:
1. `outbound-rtp` (where `kind === "video"`): gives `bytesSent`, `packetsSent`, `framesPerSecond`, `frameWidth`, `frameHeight`.
2. `remote-inbound-rtp` (where `kind === "video"`): gives receiver-measured `roundTripTime` (in seconds, multiply by $1000$ for ms), `jitter` (in seconds, multiply by $1000$ for ms), and `packetsLost`.
3. `candidate-pair` (active/nominated): gives fallback `currentRoundTripTime` and `availableOutgoingBitrate`.

#### B. Metric Formulas (Delta Calculations)
Because WebRTC returns **cumulative** counters since the call started, always subtract the previous tick's value:

* **Outgoing Bitrate / Throughput ($B$, in kbps):**
  $$B(t) = \frac{(\text{bytesSent}_t - \text{bytesSent}_{t-1}) \times 8}{\Delta t \times 1000}$$

* **Packet Loss Rate ($PLR$, in %):**
  $$PLR(t) = \frac{\Delta \text{packetsLost}}{\Delta \text{packetsSent}} \times 100\%$$
  *(Clamp to $[0, 100]$ and handle $\Delta \text{packetsSent} = 0$ safely).*

#### C. Network Quality Score ($NQS$) Formula
Normalize each raw metric onto a $0$ to $100$ scale (where $100$ = perfect, $0$ = unusable), then take a weighted sum:

1. **RTT Score ($S_{\text{RTT}}$):** Ideal $\le 50\text{ ms}$, Worst $\ge 400\text{ ms}$
   $$S_{\text{RTT}} = 100 \times \text{clamp}\left(1 - \frac{\text{RTT} - 50}{400 - 50},\; 0,\; 1\right)$$

2. **Packet Loss Score ($S_{\text{loss}}$):** Ideal $= 0\%$, Worst $\ge 10\%$
   $$S_{\text{loss}} = 100 \times \text{clamp}\left(1 - \frac{PLR}{10},\; 0,\; 1\right)$$

3. **Jitter Score ($S_{\text{jitter}}$):** Ideal $\le 10\text{ ms}$, Worst $\ge 100\text{ ms}$
   $$S_{\text{jitter}} = 100 \times \text{clamp}\left(1 - \frac{\text{Jitter} - 10}{100 - 10},\; 0,\; 1\right)$$

4. **Bitrate Score ($S_{\text{bw}}$):** Ideal $\ge 1500\text{ kbps}$, Worst $\le 200\text{ kbps}$
   $$S_{\text{bw}} = 100 \times \text{clamp}\left(\frac{B - 200}{1500 - 200},\; 0,\; 1\right)$$

5. **Composite Network Quality Score ($NQS$):**
   $$NQS(t) = w_1 S_{\text{RTT}} + w_2 S_{\text{loss}} + w_3 S_{\text{jitter}} + w_4 S_{\text{bw}}$$
   Recommended starting weights (tune during testing):
   $$w_1 = 0.30,\quad w_2 = 0.35,\quad w_3 = 0.20,\quad w_4 = 0.15$$

6. **EMA Smoothing (Noise Reduction):**
   To prevent a single random lag spike from ruining video quality, smooth the score using an Exponential Moving Average with $\alpha = 0.3$:
   $$NQS_{\text{smooth}}(t) = \alpha \cdot NQS(t) + (1 - \alpha) \cdot NQS_{\text{smooth}}(t - 1)$$

#### D. Quality States & Hysteresis Logic (Preventing Oscillation)
If you switch from `GOOD` to `MODERATE` at $NQS = 70$ and back to `GOOD` at $NQS = 70$, your video will constantly flicker ("ping-pong effect") when the network hovers near $70$.

Use **dual thresholds (hysteresis)** + **hold counters**:

| State | Target Resolution | Scale Factor (`scaleResolutionDownBy`) | Max FPS | Max Bitrate |
| :--- | :--- | :---: | :---: | :---: |
| **`GOOD`** | $720\text{p}$ | $1.0$ | $30\text{ FPS}$ | $1800\text{ kbps}$ |
| **`MODERATE`** | $480\text{p}$ / $360\text{p}$ | $2.0$ | $20\text{ FPS}$ | $700\text{ kbps}$ |
| **`POOR`** | $240\text{p}$ / $180\text{p}$ | $4.0$ | $15\text{ FPS}$ | $250\text{ kbps}$ |

**Transition Rules (Fast Downgrade, Slow Upgrade):**
* **Downgrade Quickly** (protect call smoothness):
  * `GOOD` $\rightarrow$ `MODERATE`: if $NQS_{\text{smooth}} < 65$ for **$3$ consecutive seconds**.
  * `MODERATE` $\rightarrow$ `POOR`: if $NQS_{\text{smooth}} < 40$ for **$3$ consecutive seconds**.
  * *Emergency drop:* `GOOD` $\rightarrow$ `POOR` immediately if $PLR > 15\%$ or $NQS_{\text{smooth}} < 30$.
* **Upgrade Cautiously** (ensure network is truly stable):
  * `POOR` $\rightarrow$ `MODERATE`: if $NQS_{\text{smooth}} > 50$ for **$6$ consecutive seconds**.
  * `MODERATE` $\rightarrow$ `GOOD`: if $NQS_{\text{smooth}} > 75$ for **$6$ consecutive seconds**.

> **Golden Implementation Hint (Smooth Switching):**
> **DO NOT** call `getUserMedia()` again to change resolution—that turns the camera off/on and causes black screens!
> Instead, get the video `RTCRtpSender` from `pc.getSenders()`, read `const params = sender.getParameters()`, update `params.encodings[0].maxBitrate`, `params.encodings[0].maxFramerate`, and `params.encodings[0].scaleResolutionDownBy`, and call `await sender.setParameters(params)`. It adapts seamlessly in real time!

---

### 👨‍💻 Module 3: Testing & Performance Analysis (Member 3)

**Core Responsibilities:** Design controlled experiments, run A/B benchmarks, and generate statistical proof for the final report and viva.

#### A. Experimental Setup (Baseline vs. Adaptive)
Add a toggle switch in the UI: **`Mode: [Baseline WebRTC | Adaptive Algorithm]`**.
* **Baseline WebRTC:** Your adaptation engine still *collects and logs* stats, but `adaptiveController.js` is disabled (default browser WebRTC behavior only).
* **Adaptive Algorithm:** Your full NQS + Hysteresis + `setParameters()` engine is active.

#### B. Controlled Network Test Scenarios
Use **Clumsy** (Windows) or **`tc netem`** (Linux) on one machine to simulate these 7 scenarios (run each for $60\text{ seconds}$, repeat $3\text{ times}$ and average):

| # | Scenario | Simulated Parameters | What to Prove |
| :-: | :--- | :--- | :--- |
| 1 | **Normal Network** | $0\text{ ms}$ extra delay, $0\%$ loss, unlimited BW | Both achieve `GOOD` ($720\text{p}$, $30\text{ FPS}$); your algorithm adds zero overhead. |
| 2 | **Low Bandwidth** | Cap upload/download at $400\text{ kbps}$ | Your algorithm proactively steps down to $240\text{p}/360\text{p}$ and keeps FPS steady; baseline stalls/buffers. |
| 3 | **High Latency** | $+250\text{ ms}$ delay | Tracks RTT accurately and stabilizes video quality. |
| 4 | **Packet Loss** | $5\%$ to $8\%$ random packet drop | Your algorithm lowers bitrate to reduce congestion and frame freezes. |
| 5 | **High Jitter** | $100\text{ ms} \pm 60\text{ ms}$ variable delay | Proves EMA smoothing prevents false quality drops. |
| 6 | **Fluctuating Network** | Alternate Normal ($20\text{s}$) $\leftrightarrow$ Bad ($20\text{s}$) $\leftrightarrow$ Normal ($20\text{s}$) | Measures **Quality Switching Frequency** and proves hysteresis prevents rapid oscillation. |
| 7 | **Network Interruption** | Disconnect Wi-Fi for $5\text{s}$, then reconnect | Measures **Recovery Time** (seconds from reconnect until video frames resume). |

#### C. Deliverables for the Final Report (Generated via Python/Excel)
1. **Time-Series Line Charts:** Bitrate vs. Time, RTT vs. Time, and FPS vs. Time (overlaying Baseline vs. Adaptive on the same graph).
2. **State Transition Timeline:** Plot $NQS_{\text{smooth}}$ with horizontal threshold lines showing clean state transitions (`GOOD` $\rightarrow$ `MODERATE` $\rightarrow$ `POOR`).
3. **Summary Comparison Table:** Average FPS, Average Latency, Freeze Count (seconds where $\text{FPS} < 5$), Quality Switches per Minute, and Recovery Time.

---

### 👨‍💻 Module 4: Frontend, AR Filters & Integration (Member 4)

**Core Responsibilities:** Build a polished UI, implement real-time AR filters, display the live network HUD, and deploy the system.

#### A. How to Integrate AR Filters Without Breaking WebRTC
Never apply CSS filters to the `<video>` tag—CSS only changes what *you* see, not what the remote peer receives! Follow this pipeline instead:

```text
Webcam Stream ---> Hidden <video> ---> RequestAnimationFrame Loop
                                              |
                                              v
                                   MediaPipe Face Landmarker
                                   (detects 468 face landmarks)
                                              |
                                              v
                                   Draw video frame + AR overlay
                                   (glasses, mask, blur) onto <canvas>
                                              |
                                              v
                                   const arStream = canvas.captureStream(30)
                                              |
                                              v
                                   videoSender.replaceTrack(arStream.getVideoTracks()[0])
```

* Using `sender.replaceTrack()` lets users toggle AR filters **mid-call** without disconnecting or renegotiating WebRTC!
* *Performance Tip:* Keep AR filters lightweight (e.g., sunglasses, cartoon mask, background blur, or dog ears) so CPU usage doesn't starve the WebRTC video encoder.

#### B. Essential UI Features Checklist
* **Lobby Screen:** Enter Name, Create Random Room ID, or Join Existing Room ID.
* **Call Screen:** Large remote video, picture-in-picture local video, clean bottom control bar (Mic Mute, Cam Off, Screen Share via `getDisplayMedia()`, AR Filter selector, Leave Call).
* **Collapsible Chat Sidebar:** Real-time messages via Socket.IO.
* **Live Network Status HUD:** Floating collapsible widget showing Connection Type (`P2P` / `RELAY`), RTT, Jitter, Packet Loss, Bitrate, FPS, Resolution, NQS, and a color-coded Quality badge (Green = `GOOD`, Yellow = `MODERATE`, Red = `POOR`).
* **Research Controls (for Demo/Viva):** Toggle switch for `Adaptive Mode ON/OFF` and a `Download CSV` button.

---

## 5. 8-Week Implementation Roadmap

Everyone works **in parallel** from Week 1 so nobody gets stuck waiting for another teammate.

### Phase 1: Foundation & Prototyping (Weeks 1–2)
* **All Members:** Set up GitHub repo, install Node.js/React, agree on the shared Telemetry Object contract.
* **Member 1:** Build Node.js + Socket.IO signaling server; get a raw 1-on-1 WebRTC video call working between two tabs on `localhost`.
* **Member 2:** Study `pc.getStats()` JSON output; write unit-tested functions for $S_{\text{RTT}}$, $S_{\text{loss}}$, $S_{\text{jitter}}$, $S_{\text{bw}}$, $NQS$, and Hysteresis using mock JSON data.
* **Member 3:** Install and master **Clumsy** / **`tc netem`**; write the `metricsLogger.js` and `csvExporter.js` modules; draft the experimental test plan.
* **Member 4:** Build the React UI shell (Lobby, VideoRoom layout, ControlBar, ChatPanel, and NetworkDashboard using dummy stats).

### Phase 2: Core Integration (Weeks 3–4)
* **Member 1:** Integrate STUN + TURN servers; test calls across two *different* networks (e.g., laptop on Wi-Fi + phone on 4G/5G); implement ICE restart recovery.
* **Member 2:** Hook `statsCollector.js` into Member 1's live `RTCPeerConnection`; wire up `adaptiveController.js` using `setParameters()`.
* **Member 3:** Integrate CSV logger into the live app; run pilot tests to verify metrics match simulated network degradation.
* **Member 4:** Connect real Socket.IO chat, screen sharing, and wire the real-time telemetry object into the Network Dashboard HUD.

### Phase 3: Advanced Features & Tuning (Weeks 5–6)
* **Member 1:** Stress-test edge cases (peer refresh, sudden disconnect, camera permission denied, fallback to audio-only).
* **Member 2:** Work with Member 3 to experimentally **tune weights ($w_1 \dots w_4$) and hysteresis thresholds** so switching is fast yet stable.
* **Member 3:** Run the full 7-scenario test matrix (Baseline vs. Adaptive, 3 trials each) and collect all CSV files.
* **Member 4:** Build and integrate the MediaPipe AR filter pipeline using `canvas.captureStream()` and `replaceTrack()`.

### Phase 4: Analysis, Deployment & Viva Prep (Weeks 7–8)
* **Member 3:** Generate all comparison plots, statistical tables, and write the Experimental Results & Limitations chapters of the report.
* **Member 4 + Member 1:** Deploy frontend (Vercel) and signaling server (Render) over HTTPS; test end-to-end live demo.
* **All Members:** Rehearse a 5-minute live demo (including turning on Clumsy *live* to show the HUD drop from `GOOD` to `POOR` and recover cleanly) and prepare individual viva Q&A.

---

## 6. Critical Pro Hints & Pitfalls to Avoid

1. **The HTTPS Trap:** Browsers strictly block `navigator.mediaDevices.getUserMedia()` on plain `http://` URLs (except `localhost`). If you test on another laptop on your LAN, use `ngrok` or deploy to Vercel/Render so you have `https://`.
2. **College Wi-Fi Will Block Your Demo Without TURN:** University networks often use strict Symmetric NATs that block direct P2P UDP packets. Always configure a free TURN server (like **Metered.ca Open Relay** or a free self-hosted **Coturn** instance) as a fallback before your viva!
3. **Don't Let Member 2 Wait for Member 1:** Member 2 can finish 80% of the algorithm in Week 2 by creating a fake stats generator (e.g., an array simulating RTT jumping from $40\text{ ms}$ to $350\text{ ms}$) and printing state transitions to the console.
4. **Audio Priority:** When network quality hits `POOR`, degrade *video* aggressively (down to $240\text{p}$ and $15\text{ FPS}$), but **never starve audio**. Users forgive blurry video, but they immediately abandon calls when voices cut out.
5. **Kill-Switch for the Live Demo:** Keep your **Adaptive Mode ON/OFF** toggle clearly visible. During your viva, showing a live side-by-side (or before/after) where Baseline freezes under 5% packet loss while your Adaptive Mode stays smooth is guaranteed to impress examiners.