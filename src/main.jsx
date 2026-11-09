import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { Room } from "livekit-client";
import {
  AudioLines, Bell, ChevronDown, Hash, LogOut,
  Menu, Mic, MicOff, Plus, Send, Smile, Waves, X
} from "lucide-react";
import "./style.css";

const AVATARS = ["🌗","🐷","🐽","🐺","🦝","🦊","🐸","🐻"];
const CHANNELS = [
  { id: "lounge", name: "общая" },
  { id: "games", name: "игры" },
  { id: "memes", name: "мемы" }
];

function App() {
  const [name, setName] = useState(localStorage.getItem("ku-name") || "");
  const [draftName, setDraftName] = useState("");
  const [avatar, setAvatar] = useState(Number(localStorage.getItem("ku-avatar") || 0));
  const [ready, setReady] = useState(Boolean(localStorage.getItem("ku-name")));
  const [channel, setChannel] = useState("lounge");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [people, setPeople] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [voiceState, setVoiceState] = useState("idle");
  const [muted, setMuted] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [status, setStatus] = useState({ voiceConfigured: false });
  const socketRef = useRef(null);
  const roomRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketUrl = useMemo(() => window.location.origin, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !name) return;
    const socket = io(socketUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("hello", { name, avatar });
      socket.emit("join-text", channel);
    });

    socket.on("presence", setPeople);
    socket.on("history", setMessages);
    socket.on("chat-message", (item) => {
      setMessages((prev) => [...prev, item].slice(-200));
    });
    socket.on("typing", ({ id, name: tName, typing }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing) next[id] = tName;
        else delete next[id];
        return next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [ready, name, avatar, socketUrl]);

  useEffect(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("join-text", channel);
      setMessages([]);
      setTypingUsers({});
    }
  }, [channel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  function enter(e) {
    e?.preventDefault();
    const clean = draftName.trim().slice(0, 24);
    if (!clean) return;
    localStorage.setItem("ku-name", clean);
    localStorage.setItem("ku-avatar", String(avatar));
    setName(clean);
    setReady(true);
  }

  function send(e) {
    e?.preventDefault();
    const clean = text.trim();
    if (!clean || !socketRef.current) return;
    socketRef.current.emit("chat-message", { room: channel, text: clean });
    setText("");
    socketRef.current.emit("typing", { room: channel, typing: false });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }

  function onTextChange(e) {
    const value = e.target.value;
    setText(value);
    if (!socketRef.current) return;

    socketRef.current.emit("typing", { room: channel, typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing", { room: channel, typing: false });
    }, 1800);
  }

  async function joinVoice() {
    setVoiceError("");
    try {
      const response = await fetch("/api/voice-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, room: "voice-lounge" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Голосовой сервер пока недоступен.");
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on("disconnected", () => {
        setVoiceState("idle");
        setMuted(false);
      });
      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setVoiceState("connected");
    } catch (err) {
      setVoiceError(err.message || "Не удалось подключиться.");
    }
  }

  async function leaveVoice() {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setVoiceState("idle");
    setMuted(false);
  }

  async function toggleMic() {
    const next = !muted;
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch {
      setVoiceError("Не удалось переключить микрофон.");
    }
  }

  const activeChannel = CHANNELS.find((c) => c.id === channel);
  const typingList = Object.values(typingUsers).filter(Boolean);

  if (!ready) {
    return (
      <main className="welcome">
        <div className="welcome-card">
          <div className="brand-mark">🌗</div>
          <div className="eyebrow">ЗАКРЫТОЕ МЕСТО ДЛЯ СВОИХ</div>
          <h1>Кабаний уголок</h1>
          <p>Залетай к своим. Тут спокойно.</p>
          <form onSubmit={enter}>
            <label>Как тебя звать?</label>
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Твоё имя"
              maxLength={24}
            />
            <label>Выбери кабанчика</label>
            <div className="avatar-picker">
              {AVATARS.map((a, i) => (
                <button
                  type="button"
                  className={avatar === i ? "chosen" : ""}
                  onClick={() => setAvatar(i)}
                  key={a}
                >
                  {a}
                </button>
              ))}
            </div>
            <button className="primary wide" type="submit">
              Войти в уголок <span>→</span>
            </button>
          </form>
          <small>Небольшой чат для большой компании</small>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">🌗</div>
          <div>
            <b>Кабаний уголок</b>
            <span>свои на связи</span>
          </div>
          <button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="side-label">ТВОЁ ПРОСТРАНСТВО</div>
        <div className="server-pill">
          <span className="server-dot" /> Кабаний дворик <ChevronDown size={14} />
        </div>

        <div className="side-label channel-label">
          ТЕКСТОВЫЕ КОМНАТЫ
        </div>
        <nav className="channels">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              className={channel === c.id ? "channel active" : "channel"}
              onClick={() => {
                setChannel(c.id);
                setMobileOpen(false);
              }}
            >
              <Hash size={16} />
              {c.name}
            </button>
          ))}
        </nav>

        <div className="side-label voice-label">ГОЛОС</div>
        <button
          className={`voice-room ${voiceState === "connected" ? "voice-active" : ""}`}
          onClick={voiceState === "connected" ? leaveVoice : joinVoice}
        >
          <div className="voice-icon">
            <Waves size={17} />
          </div>
          <div>
            <b>Общий костёр</b>
            <span>{voiceState === "connected" ? "Ты в голосе" : "Зайти поговорить"}</span>
          </div>
          <span className="voice-count">{voiceState === "connected" ? "●" : ""}</span>
        </button>
        {voiceState === "connected" && (
          <button className="voice-mic-btn" onClick={toggleMic} title={muted ? "Включить микрофон" : "Выключить микрофон"}>
            {muted ? <MicOff size={16} /> : <Mic size={16} />}
            {muted ? "Микрофон выкл" : "Микрофон вкл"}
          </button>
        )}
        {voiceError && <div className="voice-error">{voiceError}</div>}
        {!status.voiceConfigured && (
          <div className="setup-hint">Голос можно подключить позже через LiveKit.</div>
        )}

        <div className="sidebar-spacer" />
        <div className="user-panel">
          <div className="avatar">{AVATARS[avatar]}</div>
          <div className="user-meta">
            <b>{name}</b>
            <span>
              <i className="online-dot" /> В сети
            </span>
          </div>
          <button
            className="icon-btn"
            title="Выйти"
            onClick={() => {
              localStorage.removeItem("ku-name");
              setReady(false);
              setName("");
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="channel-heading">
            <Hash size={19} />
            <b>{activeChannel?.name}</b>
            <span className="heading-divider" />
            <span>Место для разговоров</span>
          </div>
          <div className="top-actions">
            <span className="online-summary">
              <i className="online-dot" />
              {people.length} в сети
            </span>
            <button className="icon-btn" title="Уведомления">
              <Bell size={18} />
            </button>
          </div>
        </header>

        <section className="chat-area">
          <div className="welcome-chat">
            <div className="welcome-chat-icon">✳</div>
            <h2>Добро пожаловать в #{activeChannel?.name}</h2>
            <p>Здесь начинается хорошая беседа.</p>
          </div>

          <div className="messages">
            {messages.map((m) => (
              <article className="message" key={m.id}>
                <div className="message-avatar">{AVATARS[m.avatar] || "🌗"}</div>
                <div className="message-body">
                  <div className="message-meta">
                    <b>{m.name}</b>
                    <time>
                      {new Date(m.time).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </time>
                  </div>
                  <p>{m.text}</p>
                </div>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          {typingList.length > 0 && (
            <div className="typing-indicator">
              {typingList.length === 1
                ? `${typingList[0]} печатает...`
                : `${typingList.slice(0, 2).join(", ")} печатают...`}
            </div>
          )}

          <form className="composer" onSubmit={send}>
            <button type="button" className="composer-plus" title="Скоро">
              <Plus size={19} />
            </button>
            <input
              value={text}
              onChange={onTextChange}
              placeholder={`Написать в #${activeChannel?.name}`}
              maxLength={1200}
              autoComplete="off"
            />
            <button type="button" className="composer-emoji" title="Эмодзи">
              <Smile size={19} />
            </button>
            <button className="send-btn" type="submit" disabled={!text.trim()} title="Отправить">
              <Send size={18} />
            </button>
          </form>
        </section>
      </main>

      <aside className="members">
        <div className="members-title">
          УГОЛОК СЕЙЧАС <span>{people.length}</span>
        </div>
        <div className="member-group">НА СВЯЗИ — {people.length}</div>
        {people.map((p) => (
          <div className="member" key={p.id}>
            <div className="member-avatar">
              {AVATARS[p.avatar] || "🌗"}
              <i />
            </div>
            <span>
              {p.name}
              {p.id === socketRef.current?.id ? " (ты)" : ""}
            </span>
          </div>
        ))}
        {!people.length && (
          <div className="empty-members">Пока тихо. Позови друзей 🌗</div>
        )}
        <div className="tip-card">
          <div className="tip-icon">
            <AudioLines size={17} />
          </div>
          <b>Совет кабана</b>
          <p>Голосовой костёр лучше всего звучит в наушниках.</p>
        </div>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
