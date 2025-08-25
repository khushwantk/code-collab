import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function Home() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  async function createRoom() {
    const res = await fetch(
      (import.meta.env.VITE_API_URL || "http://localhost:8080") + "/api/rooms",
      { method: "POST" }
    );
    const { code } = await res.json();
    // open new tab
    window.open(`/task/${code}`, "_blank");
  }

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
            Real-time code editing like Google Docs, built-in video calling &
            chat, and anonymous one-click rooms. No accounts needed.
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
            <button className="btn btn--primary" onClick={createRoom}>
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
            }}
          >
            <span className="badge">Max 3 people per room</span>
            <span className="badge">No sign‑up</span>
            <span className="badge">Low‑latency</span>
          </div>
        </section>

        {/* FEATURES */}
        <section className="features">
          <div className="grid grid-3">
            <div className="card feature-card">
              <h3>Live Code Editor</h3>
              <p>
                Real-time collaboration powered by Yjs CRDT, with instant
                conflict‑free sync between participants.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Video & Voice</h3>
              <p>
                WebRTC calling with all basix features like mute/unmute and
                camera toggle, and an adaptive participant grid.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Fast Sharing</h3>
              <p>
                Create a room and share the link in one click. Join by code — no
                accounts, no hassle.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Chat Messaging</h3>
              <p>
                Real-time chat alongside your editor and call to keep
                discussions in context.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Presence & Roles</h3>
              <p>
                Auto‑generated usernames and a live participant list keep
                everyone on the same page.
              </p>
            </div>
            <div className="card feature-card">
              <h3>Responsive UI</h3>
              <p>
                Modern, lightweight design that works across desktops and
                laptops out of the box.
              </p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="howto card">
          <div className="grid">
            <div className="step">
              <div className="step-num">1</div>
              <div>
                <b>Create.</b> Click <i>Share anonymously</i> to spin up a
                unique room.
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div>
                <b>Share.</b> Send the URL or the code to your collaborators.
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div>
                <b>Collaborate.</b> Code together, chat, and talk — all in real
                time.
              </div>
            </div>
          </div>
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
