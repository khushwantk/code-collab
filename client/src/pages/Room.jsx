import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "../components/Editor.jsx";
import VideoGrid from "../components/VideoGrid.jsx";
import Chat from "../components/Chat.jsx";
import { connectRoom } from "../lib/socket.js";
import "../styles.css";

export default function Room() {
  const { code } = useParams();
  const [socket, setSocket] = useState(null);
  const [me, setMe] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const s = connectRoom(code);
    setSocket(s);

    s.on("connect_error", (err) => {
      if (err?.message === "room_full") setFull(true);
    });

    // NEW: handle our custom event from the server rooms flow
    s.on("room_full", () => setFull(true));

    s.on("me", (u) => {
      setMe(u);
      // 🔁 ask server for the current roster immediately
      s.emit("roster:get");
      // also kick off video dialing list
      s.emit("peers:list");
    });

    // 🔄 authoritative list from server
    s.on("roster", (users) => setParticipants(users));

    // When someone joins/leaves, optionally re-ask for roster
    s.on("presence:join", () => s.emit("roster:get"));
    s.on("presence:leave", () => s.emit("roster:get"));

    return () => s.disconnect();
  }, [code]);

  if (full)
    return (
      <div style={{ padding: 16 }}>Room is full. Please try another code.</div>
    );
  if (!socket || !me) return <div style={{ padding: 16 }}>Connecting…</div>;

  return (
    <div className="container container--editor-left">
      {/* Left: Editor */}
      <div className="card" style={{ minHeight: "70vh" }}>
        <div style={{ padding: 8, borderBottom: "1px solid #222" }}>
          <b>Room:</b> <code>{code}</code>
        </div>
        <div style={{ height: "calc(100% - 40px)" }}>
          <Editor docId={code} me={me} />
        </div>
      </div>

      {/* Right: Participants + Video + Chat */}
      <div
        style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12 }}
      >
        <div className="card" style={{ padding: 8 }}>
          <b>Participants</b>
          <ul style={{ margin: 8, paddingLeft: 18 }}>
            {participants.map((p) => (
              <li
                key={p.id}
                style={{
                  color: p.id === me.id ? "limegreen" : "inherit",
                  fontWeight: p.id === me.id ? "bold" : "normal",
                }}
              >
                {p.name}
                {p.id === me.id ? " (you)" : ""}
              </li>
            ))}
          </ul>
        </div>

        <div className="card" style={{ padding: 8 }}>
          <VideoGrid socket={socket} />
        </div>

        <div className="card" style={{ padding: 8 }}>
          <Chat socket={socket} me={me} />
        </div>
      </div>
    </div>
  );
}
