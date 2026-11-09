import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { AccessToken } from "livekit-server-sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true },
  transports: ["websocket", "polling"]
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "../data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load history from disk
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, "utf8");
      const data = JSON.parse(raw);
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.warn("Could not load history:", e.message);
  }
  return new Map();
}

// Save history to disk (debounced)
let saveTimer = null;
function saveHistory() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const obj = Object.fromEntries(history);
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(obj, null, 0), "utf8");
    } catch (e) {
      console.warn("Could not save history:", e.message);
    }
  }, 800);
}

const history = loadHistory();
const users = new Map(); // socketId -> { name, avatar, channel?, typing? }

app.use(express.json());

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    voiceConfigured: Boolean(
      process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
    ),
    online: users.size
  });
});

app.post("/api/voice-token", async (req, res) => {
  const { name, room } = req.body || {};
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(503).json({
      error: "Голосовой сервер ещё не подключён. Нужны настройки LiveKit."
    });
  }
  if (!name || !room) {
    return res.status(400).json({ error: "Не хватает имени или комнаты." });
  }
  try {
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: String(name).slice(0, 32),
        ttl: "2h"
      }
    );
    token.addGrant({
      roomJoin: true,
      room: String(room).slice(0, 64),
      canPublish: true,
      canSubscribe: true
    });
    res.json({
      token: await token.toJwt(),
      url: process.env.LIVEKIT_URL
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Не удалось подготовить голосовое подключение." });
  }
});

// Health for hosts
app.get("/health", (_req, res) => res.json({ status: "ok" }));

io.on("connection", (socket) => {
  socket.on("hello", ({ name, avatar }) => {
    const safeName = String(name || "Гость").trim().slice(0, 24) || "Гость";
    users.set(socket.id, {
      name: safeName,
      avatar: Number(avatar) || 0,
      typing: false
    });
    broadcastPresence();
  });

  socket.on("join-text", (room) => {
    const safeRoom = String(room || "lounge").slice(0, 40);
    for (const joined of socket.rooms) {
      if (joined.startsWith("text:")) socket.leave(joined);
    }
    socket.join(`text:${safeRoom}`);
    const user = users.get(socket.id);
    if (user) {
      user.channel = safeRoom;
      users.set(socket.id, user);
    }
    socket.emit("history", history.get(safeRoom) || []);
    broadcastPresence();
  });

  socket.on("chat-message", ({ room, text }) => {
    const user = users.get(socket.id);
    const message = String(text || "").trim().slice(0, 1200);
    if (!user || !message) return;

    const channel = String(room || "lounge").slice(0, 40);
    const item = {
      id: `${Date.now()}-${socket.id.slice(0, 6)}`,
      name: user.name,
      avatar: user.avatar,
      text: message,
      time: new Date().toISOString()
    };

    const items = history.get(channel) || [];
    items.push(item);
    // Keep last 200 messages per channel
    history.set(channel, items.slice(-200));
    saveHistory();

    io.to(`text:${channel}`).emit("chat-message", item);

    // Clear typing for this user
    if (user.typing) {
      user.typing = false;
      users.set(socket.id, user);
      io.to(`text:${channel}`).emit("typing", {
        id: socket.id,
        name: user.name,
        typing: false
      });
    }
  });

  socket.on("typing", ({ room, typing }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const channel = String(room || "lounge").slice(0, 40);
    user.typing = Boolean(typing);
    users.set(socket.id, user);
    socket.to(`text:${channel}`).emit("typing", {
      id: socket.id,
      name: user.name,
      typing: Boolean(typing)
    });
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    broadcastPresence();
  });
});

function broadcastPresence() {
  const list = [...users.entries()].map(([id, user]) => ({
    id,
    name: user.name,
    avatar: user.avatar,
    channel: user.channel || null
  }));
  io.emit("presence", list);
}

// Serve static files from dist
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Кабаний Уголок запущен: http://localhost:${PORT}`);
  console.log(`Онлайн: ${users.size}`);
});
