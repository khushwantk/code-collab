import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "../components/Editor.jsx";
import VideoGrid from "../components/VideoGrid.jsx";
import Chat from "../components/Chat.jsx";
import { connectRoom } from "../lib/socket.js";
import { useScreenSharing } from "../lib/screenshare.js";
import ScreenSharePanel from "../components/ScreenSharePanel.jsx";
import toast from "react-hot-toast";
import "../styles.css";

export default function Room() {
  const { code } = useParams();
  const [me, setMe] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [errorHeader, setErrorHeader] = useState(null);

  // Private Room Lobby State
  const [isPrivate, setIsPrivate] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [inputName, setInputName] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [fetchingRoom, setFetchingRoom] = useState(true);

  // Timer state
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");

  // LiveKit Room instance — populated via VideoGrid's onRoomReady callback
  const [livekitRoom, setLivekitRoom] = useState(null);

  const { startScreenShare, stopScreenShare, screenShares, myScreenStream } =
    useScreenSharing(socket, me, participants, livekitRoom);

  useEffect(() => {
    async function checkRoom() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/rooms/${code}`);
        if (!res.ok) {
          setErrorHeader("Room not found.");
          setFetchingRoom(false);
          return;
        }
        const data = await res.json();
        if (data.isPrivate) {
          setIsPrivate(true);
          setNeedsAuth(true);
        }
      } catch (err) {
        setErrorHeader("Failed to fetch room details.");
      }
      setFetchingRoom(false);
    }
    checkRoom();
  }, [code]);

  useEffect(() => {
    if (fetchingRoom || needsAuth) return;

    const s = connectRoom(code, inputName, inputPassword);
    setSocket(s);

    s.on("connect", () => console.log("Signaling connected."));
    s.on("connect_error", (err) => {
      console.error("Signaling connection error:", err);
      if (err.message === "room_full") {
        setErrorHeader("Room is full. Maximum participants reached.");
      } else if (err.message === "room_not_found") {
        setErrorHeader("Room not found.");
      } else {
        setErrorHeader("Connection Error");
      }
    });

    s.on("invalid_password", () => {
      toast.error("Incorrect room password.", { id: "bad_pass" });
      setNeedsAuth(true); // Pop them back to the lobby
    });

    s.on("room_expired", () => {
      setErrorHeader("Room has expired.");
      toast.error("This room's time limit has been reached.");
    });
    s.on("room_full", () => setErrorHeader("Room is full."));

    s.on("me", (u) => {
      setMe(u);
      if (u.expiresAt) {
        setExpiresAt(new Date(u.expiresAt));
      }
      // ask server for the current roster immediately
      s.emit("roster:get");
    });

    // authoritative list from server
    s.on("roster", (users) => setParticipants(users));

    // When someone joins/leaves, re-ask for roster
    s.on("presence:join", (user) => {
      if (user && user.name) {
        toast(`${user.name} joined the room`, { icon: "👋" });
      }
      s.emit("roster:get");
    });
    s.on("presence:leave", (user) => {
      if (user && user.name) {
        toast(`${user.name} left the room`, { icon: "👋" });
      }
      s.emit("roster:get");
    });

    return () => s.disconnect();
  }, [code, fetchingRoom, needsAuth, inputName, inputPassword]);

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("00:00");
        clearInterval(interval);
        return;
      }

      const m = Math.floor((diff / 1000) / 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (errorHeader) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <h2 style={{ marginBottom: 16 }}>{errorHeader}</h2>
          <button className="btn btn--primary" onClick={() => window.location.href = "/"}>Return Home</button>
        </div>
      </div>
    );
  }

  if (fetchingRoom) {
    return (
      <div className="room-shell">
        <div className="card" style={{ padding: 16 }}>Loading room...</div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "var(--bg)" }}>
        <div className="card" style={{ padding: 32, width: 400 }}>
          <h2 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔒</span> Join Private Room
          </h2>
          <p style={{ color: "var(--text-dim)", marginBottom: 24, fontSize: 14 }}>
            This room is password protected.
          </p>
          <form onSubmit={(e) => {
            e.preventDefault();
            setNeedsAuth(false);
          }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Your Name</label>
              <input
                className="input"
                type="text"
                placeholder="Enter your name..."
                required
                value={inputName}
                onChange={e => setInputName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Room Password</label>
              <input
                className="input"
                type="password"
                placeholder="Enter password..."
                required
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
              />
            </div>
            <button className="btn btn--primary" style={{ width: "100%" }} type="submit">Join Room</button>
          </form>
        </div>
      </div>
    );
  }

  if (!me)
    return (
      <div className="room-shell">
        <div className="card" style={{ padding: 16 }}>Connecting…</div>
      </div>
    );

  const participantNames = participants.map((p) =>
    p.id === me.id ? `${p.name} (you)` : p.name
  );
  const visibleNames = participantNames.slice(0, 3);
  const extraCount = Math.max(participantNames.length - visibleNames.length, 0);

  return (
    <>
      <div className="room-shell">
        <div className="room-header-bar">
          <div className="room-header-meta" style={{ flexDirection: "row", alignItems: "center", gap: "12px" }}>
            <div>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
                Room
              </span>
              <br />
              <code>{code}</code>
            </div>
            {timeLeft && (
              <div style={{ marginLeft: 8, background: "var(--bg-elev)", padding: "4px 8px", borderRadius: "16px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                ⏱️ {timeLeft}
              </div>
            )}
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(window.location.href)
                  .then(() => toast.success("Link copied!"))
                  .catch(() => { });
              }}
            >
              Copy link
            </button>
          </div>
          <div className="room-header-actions">
            <button
              className="btn btn--sm btn--primary"
              onClick={async () => {
                if (myScreenStream) {
                  stopScreenShare();
                  toast("Screen share stopped", { icon: "🖥️" });
                } else {
                  await startScreenShare();
                  toast.success("Screen share started");
                }
              }}
            >
              {myScreenStream ? "Stop sharing" : "Share screen"}
            </button>
            <button
              className={`btn btn--sm ${isChatOpen ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              💬 Chat
            </button>
          </div>
        </div>

        <div className="room-layout">
          {/* Left column: editor */}
          <div className="room-main-column">
            <div className="card room-main-card">
              <div className="room-main-header">
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                    Shared code
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    Changes sync live for everyone
                  </div>
                </div>
              </div>
              <div className="room-main-body">
                <Editor docId={code} me={me} />
              </div>
            </div>
          </div>

          {/* Right column: video + screen shares, compact participants inline */}
          <div className="room-sidebar">
            <div className="card" style={{ padding: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginRight: 8, display: "inline-block" }}>Participants</div>
                  <div className="room-participants-inline" style={{ display: "inline-flex" }}>
                    {visibleNames.map((name) => (
                      <span key={name} className="room-participant-pill">
                        {name}
                      </span>
                    ))}
                    {extraCount > 0 && (
                      <span className="room-participant-pill">
                        +{extraCount} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <VideoGrid
                socket={socket}
                me={me}
                participants={participants}
                roomCode={code}
                onRoomReady={setLivekitRoom}
              />
            </div>

            <ScreenSharePanel
              shares={screenShares}
            />
          </div>
        </div>
      </div>

      {/* Chat Sidebar Backdrop (optional, for mobile) */}
      <div
        className={`chat-sidebar-backdrop ${isChatOpen ? "open" : ""}`}
        onClick={() => setIsChatOpen(false)}
      />

      {/* Slide-out Chat Sidebar */}
      <div className={`chat-sidebar ${isChatOpen ? "open" : ""}`}>
        <div className="chat-sidebar-header">
          <h3>Chat</h3>
          <button className="btn btn--ghost btn--sm" onClick={() => setIsChatOpen(false)}>✖</button>
        </div>
        <div className="chat-sidebar-body">
          <Chat socket={socket} me={me} />
        </div>
      </div>
    </>
  );
}
