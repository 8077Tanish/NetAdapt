import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PeerRecord {
  socketId: string;
  username: string;
  micOn: boolean;
  camOn: boolean;
  joinedAt: number;
}

interface StoredChatMessage {
  id: string;
  sender: string;
  senderId: string;
  text: string;
  time: string;
}

interface RoomState {
  peers: Map<string, PeerRecord>;
  messages: StoredChatMessage[];
}

const rooms = new Map<string, RoomState>();
const MAX_PEERS_PER_ROOM = 2;

function sanitizeRoomId(raw: unknown): string {
  const str = String(raw || 'room-101')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 32);
  return str || 'room-101';
}

function sanitizeUsername(raw: unknown): string {
  const str = String(raw || 'Guest')
    .trim()
    .slice(0, 32);
  return str || 'Guest';
}

function getOrCreateRoom(roomId: string): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = { peers: new Map(), messages: [] };
    rooms.set(roomId, room);
  }
  return room;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Health & ICE configuration API endpoints
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      activeRooms: rooms.size,
      maxPeersPerRoom: MAX_PEERS_PER_ROOM,
    });
  });

  app.get('/api/ice-config', (_req, res) => {
    const iceServers: RTCIceServer[] = [
      {
        urls: [
          process.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      },
    ];

    if (process.env.VITE_TURN_URL) {
      iceServers.push({
        urls: process.env.VITE_TURN_URL,
        username: process.env.VITE_TURN_USERNAME || undefined,
        credential: process.env.VITE_TURN_CREDENTIAL || undefined,
      });
    }

    res.json({ iceServers });
  });

  io.on('connection', (socket) => {
    let currentRoomId: string | null = null;

    const leaveCurrentRoom = () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room) {
        const departed = room.peers.get(socket.id);
        room.peers.delete(socket.id);
        socket.leave(currentRoomId);

        if (departed) {
          socket.to(currentRoomId).emit('peer-left', {
            roomId: currentRoomId,
            peerId: socket.id,
            username: departed.username,
            peers: Array.from(room.peers.values()),
          });
        }

        if (room.peers.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
      currentRoomId = null;
    };

    socket.on(
      'join-room',
      (payload: { roomId?: string; username?: string; micOn?: boolean; camOn?: boolean }) => {
        const nextRoomId = sanitizeRoomId(payload?.roomId);
        const username = sanitizeUsername(payload?.username);

        if (currentRoomId && currentRoomId !== nextRoomId) {
          leaveCurrentRoom();
        }

        const room = getOrCreateRoom(nextRoomId);

        // Enforce clean 2-user P2P room capacity unless already in room
        if (!room.peers.has(socket.id) && room.peers.size >= MAX_PEERS_PER_ROOM) {
          socket.emit('room-full', {
            roomId: nextRoomId,
            maxPeers: MAX_PEERS_PER_ROOM,
            message: `Room ${nextRoomId} already has ${MAX_PEERS_PER_ROOM} active participants.`,
          });
          return;
        }

        const peer: PeerRecord = {
          socketId: socket.id,
          username,
          micOn: payload?.micOn !== false,
          camOn: Boolean(payload?.camOn),
          joinedAt: Date.now(),
        };

        const existingPeers = Array.from(room.peers.values()).filter(
          (p) => p.socketId !== socket.id
        );

        room.peers.set(socket.id, peer);
        currentRoomId = nextRoomId;
        socket.join(nextRoomId);

        // Send authoritative room state to the joining socket
        socket.emit('room-state', {
          roomId: nextRoomId,
          selfId: socket.id,
          peers: Array.from(room.peers.values()),
          messages: room.messages,
        });

        // Notify existing peer using both event names from NetAdapt README contract
        if (existingPeers.length > 0) {
          const joinPayload = {
            roomId: nextRoomId,
            peerId: socket.id,
            username: peer.username,
            peer,
            peers: Array.from(room.peers.values()),
          };
          socket.to(nextRoomId).emit('peer-joined', joinPayload);
          socket.to(nextRoomId).emit('user-joined', joinPayload);
        }
      }
    );

    socket.on('offer', (payload: { roomId?: string; sdp?: RTCSessionDescriptionInit }) => {
      const targetRoom = sanitizeRoomId(payload?.roomId || currentRoomId);
      if (!payload?.sdp || currentRoomId !== targetRoom) return;
      socket.to(targetRoom).emit('offer', {
        roomId: targetRoom,
        fromPeerId: socket.id,
        sdp: payload.sdp,
      });
    });

    socket.on('answer', (payload: { roomId?: string; sdp?: RTCSessionDescriptionInit }) => {
      const targetRoom = sanitizeRoomId(payload?.roomId || currentRoomId);
      if (!payload?.sdp || currentRoomId !== targetRoom) return;
      socket.to(targetRoom).emit('answer', {
        roomId: targetRoom,
        fromPeerId: socket.id,
        sdp: payload.sdp,
      });
    });

    socket.on(
      'ice-candidate',
      (payload: { roomId?: string; candidate?: RTCIceCandidateInit }) => {
        const targetRoom = sanitizeRoomId(payload?.roomId || currentRoomId);
        if (!payload?.candidate || currentRoomId !== targetRoom) return;
        socket.to(targetRoom).emit('ice-candidate', {
          roomId: targetRoom,
          fromPeerId: socket.id,
          candidate: payload.candidate,
        });
      }
    );

    socket.on(
      'peer-media-state',
      (payload: { roomId?: string; micOn?: boolean; camOn?: boolean; username?: string }) => {
        const targetRoom = sanitizeRoomId(payload?.roomId || currentRoomId);
        const room = rooms.get(targetRoom);
        if (!room || currentRoomId !== targetRoom) return;
        const existing = room.peers.get(socket.id);
        if (!existing) return;

        existing.micOn = payload?.micOn !== undefined ? Boolean(payload.micOn) : existing.micOn;
        existing.camOn = payload?.camOn !== undefined ? Boolean(payload.camOn) : existing.camOn;
        if (payload?.username) {
          existing.username = sanitizeUsername(payload.username);
        }

        socket.to(targetRoom).emit('peer-media-state', {
          roomId: targetRoom,
          peerId: socket.id,
          micOn: existing.micOn,
          camOn: existing.camOn,
          username: existing.username,
          peers: Array.from(room.peers.values()),
        });
      }
    );

    socket.on(
      'chat-message',
      (payload: { id?: string; roomId?: string; sender?: string; text?: string; time?: string }) => {
        const targetRoom = sanitizeRoomId(payload?.roomId || currentRoomId);
        const room = rooms.get(targetRoom);
        if (!room || currentRoomId !== targetRoom) return;

        const text = String(payload?.text || '').trim().slice(0, 1000);
        if (!text) return;

        const msgId = String(payload?.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
        if (room.messages.some((m) => m.id === msgId)) return;

        const msg: StoredChatMessage = {
          id: msgId,
          sender: sanitizeUsername(payload?.sender || room.peers.get(socket.id)?.username),
          senderId: socket.id,
          text,
          time:
            String(payload?.time || '').slice(0, 16) ||
            new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        };

        room.messages = [...room.messages.slice(-99), msg];
        io.to(targetRoom).emit('chat-message', { roomId: targetRoom, ...msg });
      }
    );

    socket.on('leave-room', () => {
      leaveCurrentRoom();
    });

    socket.on('disconnect', () => {
      leaveCurrentRoom();
    });
  });

  // Mount Vite middleware in dev, or serve static dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`NetAdapt server (Express + Socket.IO) listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NetAdapt server:', err);
  process.exit(1);
});
