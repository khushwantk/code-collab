import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  async function createRoom() {
    const res = await fetch(
      (import.meta.env.VITE_API_URL || "http://localhost:8080") + "/api/rooms",
      { method: "POST" }
    );
    const { code } = await res.json();
    // navigate(`/task/${code}`);
    window.open(`/task/${code}`, "_blank");
  }

  function goJoin(e) {
    e.preventDefault();
    if (!code.trim()) return;

    // navigate(`/task/${code}`);
    window.open(`/task/${code}`, "_blank");
  }

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0c0c0f",
        color: "#eee",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 20,
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>
          Collaborative Coding & Video
        </h1>
        <p>
          Share a link anonymously or join by code.
          <br />
          Max 3 people per room.
        </p>

        {/* Share button */}
        <button
          onClick={createRoom}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            background: "#2563eb", // blue-600
            color: "white",
            border: "none",
            fontWeight: 600,
            margin: "0 auto", // center
            width: "auto", // shrink to fit text
          }}
        >
          Share anonymously (new room)
        </button>

        {/* Join form */}
        <form
          onSubmit={goJoin}
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
          }}
        >
          <input
            placeholder="Enter room code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              width: 180,
              minWidth: 100,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #444",
              background: "#1a1a1f",
              color: "#eee",
              textAlign: "center",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              background: "#16a34a", // green-600
              color: "white",
              border: "none",
              fontWeight: 600,
            }}
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
