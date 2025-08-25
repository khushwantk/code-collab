import { useEffect, useState } from "react";

export default function Chat({ socket, me }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const onMsg = (m) => setMsgs((prev) => [...prev, m]);
    socket.on("chat:message", onMsg);
    return () => socket.off("chat:message", onMsg);
  }, [socket]);

  function send() {
    if (!text.trim()) return;
    socket.emit("chat:message", text.trim());
    setText("");
  }
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="chat">
      <div
        className="msgs"
        style={{
          overflowY: "auto",
          height: 200,
          border: "1px solid #333",
          padding: 8,
        }}
      >
        {msgs.map((m, i) => (
          <div key={i}>
            <b>{m.from.name}</b>: {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type message…Enter to send, Shift+Enter for newline)"
          style={{ flex: 1, resize: "none" }}
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
