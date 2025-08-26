import { useEffect, useRef, useState } from "react";

export default function Chat({ socket, me }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  //Add a ref for the hidden file input
  const fileInputRef = useRef(null);
  const [enlargedImage, setEnlargedImage] = useState(null);

  const INBOUND_EVENTS = ["chat:message", "chat:send", "message"];
  const HISTORY_EVENTS = ["chat:history", "message:history"];

  const mkCid = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function normalizeMessage(m) {
    if (m == null) return null;

    // Check if the message is in the server's wrapped format.
    // The 'text' property can contain either text OR the image payload.
    if (m.from && m.text && typeof m.text === "object") {
      // It is! Let's combine the 'from' and 'text' objects into one,
      // creating the flat structure we originally expected.
      m = { ...m.from, ...m.text, ts: m.ts };
    }

    if (typeof m === "string") {
      return {
        id: null,
        name: "Someone",
        text: m,
        image: null,
        ts: Date.now(),
        cid: mkCid(),
      };
    }

    const id = m.id ?? m.from?.id ?? m.senderId ?? null;
    const name = m.name ?? m.from?.name ?? m.fromName ?? "Someone";
    const ts = m.ts ?? m.time ?? Date.now();
    const cid = m.cid ?? `${id ?? "x"}-${ts}`;

    // Now that 'm' is unwrapped, the rest of the logic will work perfectly.
    if (m.image && typeof m.image === "string") {
      return { id, name, ts, cid, image: m.image, text: "" };
    }

    let text = m.text ?? m.message ?? "";
    if (typeof text === "object" && text !== null) {
      text = text.text ?? JSON.stringify(text);
    }

    if (typeof text !== "string") {
      text = String(text);
    }

    return { id, name, text, image: null, ts, cid };
  }

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight + 1;
  }, [msgs]);

  useEffect(() => {
    if (!socket) return;
    const onAnyMessage = (m) => {
      console.log("1. Received RAW message from socket:", m);
      const n = normalizeMessage(m);
      console.log("2. Message object AFTER normalization:", n);
      if (!n) return;
      setMsgs((prev) =>
        prev.some((x) => x.cid === n.cid) ? prev : [...prev, n]
      );
    };
    const onHistory = (items = []) => {
      const list = items
        .map(normalizeMessage)
        .filter(Boolean)
        .sort((a, b) => a.ts - b.ts);
      setMsgs(list);
    };
    INBOUND_EVENTS.forEach((ev) => socket.on(ev, onAnyMessage));
    HISTORY_EVENTS.forEach((ev) => socket.on(ev, onHistory));
    return () => {
      INBOUND_EVENTS.forEach((ev) => socket.off(ev, onAnyMessage));
      HISTORY_EVENTS.forEach((ev) => socket.off(ev, onHistory));
    };
  }, [socket]);

  function send() {
    const t = text.trim();
    if (!t) return;
    const payload = {
      id: socket?.id ?? null,
      name: me?.name || "You",
      text: t,
      ts: Date.now(),
      cid: mkCid(),
    };
    try {
      socket.emit("chat:send", payload);
      socket.emit("chat:message", payload);
    } catch {}
    setText("");
    inputRef.current?.focus();
  }

  // NEW: Function to handle file selection and sending
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Optional: Add validation for file size and type
    if (file.size > 1024 * 1024) {
      // 1MB limit
      alert("File is too large! Please select a file smaller than 1MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageAsBase64 = e.target.result;
      const payload = {
        id: socket?.id ?? null,
        name: me?.name || "You",
        image: imageAsBase64, // Send the base64 string
        ts: Date.now(),
        cid: mkCid(),
      };
      try {
        socket.emit("chat:send", payload);
        socket.emit("chat:message", payload);
      } catch {}
    };
    reader.readAsDataURL(file);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const myId = socket?.id;

  return (
    <div className="chat">
      {enlargedImage && (
        <div style={styles.modalOverlay} onClick={() => setEnlargedImage(null)}>
          <img
            src={enlargedImage}
            alt="Enlarged view"
            style={styles.enlargedImage}
            onClick={(e) => e.stopPropagation()} // Prevents modal from closing when clicking the image
          />
        </div>
      )}

      <div
        ref={listRef}
        className="card"
        style={{
          overflowY: "auto",
          height: 220,
          padding: 10,
          borderRadius: 12,
          background: "var(--bg-elev)",
          border: "1px solid var(--border)",
        }}
      >
        {msgs.map((m) => {
          const isMe = m.id && myId && m.id === myId;
          const messageRowStyle = {
            display: "flex",
            justifyContent: isMe ? "flex-end" : "flex-start",
            marginBottom: "10px",
          };
          const messageBubbleStyle = {
            padding: m.image ? "5px" : "10px 15px", // Less padding for images
            borderRadius: "20px",
            maxWidth: "70%",
            background: isMe
              ? "var(--primary, #007bff)"
              : "var(--bg-elev, #e9e9eb)",
            color: isMe ? "white" : "var(--text, black)",
            overflow: "hidden", // Ensures image corners are rounded
          };

          return (
            <div key={m.cid} style={messageRowStyle}>
              <div style={messageBubbleStyle}>
                {!isMe && (
                  <b
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "0.85em",
                      color: "var(--text-muted, #6c757d)",
                    }}
                  >
                    {m.name}
                  </b>
                )}

                {/* NEW: Conditional rendering for text vs. image */}
                {m.image ? (
                  <img
                    src={m.image}
                    alt="user upload"
                    style={{
                      maxWidth: "100%",
                      display: "block",
                      cursor: "pointer",
                    }}
                    onClick={() => setEnlargedImage(m.image)}
                  />
                ) : (
                  m.text
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area with upload button */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          ref={inputRef}
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          style={{ flex: 1 }}
        />
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: "none" }}
          accept="image/*"
        />
        {/* Upload button */}
        <button className="btn" onClick={() => fileInputRef.current.click()}>
          📎
        </button>
        <button className="btn btn--primary" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  enlargedImage: {
    maxWidth: "90%",
    maxHeight: "90%",
    objectFit: "contain",
    boxShadow: "0 0 25px rgba(0,0,0,0.5)",
  },
};
