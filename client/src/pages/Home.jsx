import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

function RoomTimer({ expiresAt, onExpire }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();

    const updateTimer = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00");
        if (onExpire) onExpire();
        return false; // Stop interval
      }
      const m = Math.floor((diff / 1000) / 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      return true;
    };

    updateTimer(); // Initial call
    const interval = setInterval(() => {
      if (!updateTimer()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return null;
  return (
    <div style={{ marginLeft: "auto", fontSize: 13, background: "var(--bg)", padding: "2px 8px", borderRadius: 12, border: "1px solid var(--border)" }}>
      ⏱️ {timeLeft}
    </div>
  );
}

export default function Home() {
  const [code, setCode] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(3);
  const [duration, setDuration] = useState(2);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [activeRooms, setActiveRooms] = useState([]);

  const navigate = useNavigate();

  async function createRoom() {
    const res = await fetch(
      (import.meta.env.VITE_API_URL || "http://localhost:8080") + "/api/rooms",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxParticipants,
          duration,
          isPrivate,
          password: isPrivate ? password : ""
        })
      }
    );
    const { code: newCode } = await res.json();
    window.open(`/task/${newCode}`, "_blank");
    setShowModal(false);
    setIsPrivate(false);
    setPassword("");
  }

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || "http://localhost:8080") + "/api/rooms");
      if (res.ok) {
        const data = await res.json();
        const validRooms = data.filter(r => !r.expiresAt || new Date(r.expiresAt).getTime() > Date.now());
        setActiveRooms(validRooms);
      }
    } catch (e) {
      console.error("Failed to fetch active rooms:", e);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, [fetchRooms]);

  function goJoin(e) {
    e.preventDefault();
    if (!code.trim()) return;
    window.open(`/task/${code.trim()}`, "_blank");
  }

  return (
    <div>
      {/* Sticky header with theme switcher */}
      {/* <header className="app-header">
        <div className="header-inner container-max">
          <div className="brand">CodeCollab</div>
          <div style={{ display: "flex", gap: 8 }}>
            <ThemeToggle />
          </div>
        </div>
      </header> */}

      <main className="container-max">
        {/* HERO */}
        <section className="hero card">
          <h1>Collaborative Coding & Video</h1>
          <p>
            Drop complex signups and friction. Launch real-time code environments, live video grids, and multi-channel chat in an instant.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 6,
            }}
          >
            <button className="btn btn--primary" onClick={() => setShowModal(true)}>
              Share anonymously (new room)
            </button>
            <form onSubmit={goJoin} style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Enter room code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ width: 220, textAlign: "center" }}
              />
              <button className="btn btn--success" type="submit">
                Join
              </button>
            </form>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              marginTop: 8,
              flexWrap: "wrap"
            }}
          >
            <span className="badge">Instant Setup</span>
            <span className="badge">Live Video, Audio & Screen Sharing</span>
            <span className="badge">Conflict-Free Sync</span>
            <span className="badge">Pair Programming</span>
            <span className="badge">Self-Destructing Rooms</span>

          </div>
        </section>

        {showModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 9999
          }} onClick={() => setShowModal(false)}>
            <div className="card" style={{ padding: 24, minWidth: 320, background: 'var(--bg)' }} onClick={e => e.stopPropagation()}>
              <h2 style={{ marginBottom: 16 }}>Configure Room</h2>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                  Max Participants (1-10)
                </label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="10"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                  Duration
                </label>
                <select
                  className="input"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer" }}
                >
                  <option value={2}>2 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-dim)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  Private Room (Password Protected)
                </label>
              </div>

              {isPrivate && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                  <label style={{ fontSize: 13, color: "var(--text-dim)" }}>Room Password</label>
                  <input
                    type="text"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a secure password..."
                    required
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn--primary" onClick={createRoom}>Create Room</button>
              </div>
            </div>
          </div>
        )}

        {/* FEATURES */}
        <section className="features">
          <div className="grid grid-3">
            <div className="card feature-card">
              <h3>Live Code Editor</h3>
              <p>
                Instant conflict-free sync between participants with live cursor tracking.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Video & Voice</h3>
              <p>
                WebRTC calling with all basic features and an adaptive participant grid.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Room Controls</h3>
              <p>
                Maximum participant limits and self-destructing countdown timers.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Active Rooms</h3>
              <p>
                Directly see and hop into active rooms from the live gallery grid.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Private Rooms</h3>
              <p>
                Spin up a perfectly locked-down workspace.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Chat Messaging</h3>
              <p>
                Real-time chat alongside your editor, call and screen.
              </p>
            </div>
          </div>
        </section>

        {/* ACTIVE ROOMS */}
        <section className="active-rooms card" style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 16 }}>Active Rooms</h2>
          {activeRooms.length === 0 ? (
            <p style={{ color: "var(--text-dim)" }}>No active public rooms right now. Create one above!</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
              {activeRooms.map((r) => {
                const isFull = r.members >= r.maxParticipants;
                return (
                  <div key={r.code} style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    background: "var(--bg-elev)",
                    opacity: isFull ? 0.6 : 1
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 18, display: "flex", alignItems: "center", gap: 6 }}>
                        {r.code}
                        {r.isPrivate && <span className="badge" style={{ fontSize: 11, padding: "2px 6px" }}>🔒 Private</span>}
                      </span>
                      {isFull ? (
                        <span className="badge" style={{ color: "var(--text)", fontWeight: "bold" }}>FULL</span>
                      ) : r.expiresAt ? (
                        <RoomTimer expiresAt={r.expiresAt} onExpire={fetchRooms} />
                      ) : null}
                    </div>

                    <div style={{ fontSize: 14, color: "var(--text-dim)" }}>
                      👥 {r.members} / {r.maxParticipants} participants
                    </div>

                    <button
                      className="btn btn--primary"
                      onClick={() => window.open(`/task/${r.code}`, "_blank")}
                      disabled={isFull}
                      style={{ marginTop: "auto" }}
                    >
                      {isFull ? "Room Full" : "Join Room"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div>
            © {new Date().getFullYear()} CodeCollab • Built with React, Node,
            WebRTC & Yjs
          </div>
        </footer>
      </main>
    </div>
  );
}
