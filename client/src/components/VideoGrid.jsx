import React, { useEffect, useRef, useState } from "react";
import { createMediaStream, createPeer } from "../lib/webrtc.js";

function VideoPlaceholder({ name }) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "#1c1c1c",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "#333",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          fontWeight: "bold",
        }}
      >
        {initial}
      </div>
    </div>
  );
}

export default function VideoGrid({ socket, me, participants }) {
  const [meStream, setMeStream] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [tiles, setTiles] = useState({});
  const peersRef = useRef(new Map());
  const meVideo = useRef(null);
  const micTrackRef = useRef(null);
  const camTrackRef = useRef(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await createMediaStream();
      if (!mounted) return;
      if (s) {
        micTrackRef.current = s.getAudioTracks()[0] || null;
        camTrackRef.current = s.getVideoTracks()[0] || null;
        s.getAudioTracks().forEach((t) => (t.enabled = false));
        s.getVideoTracks().forEach((t) => (t.enabled = true));
        setMeStream(s);
        setMicOn(false);
        setCamOn(!!camTrackRef.current);
        if (meVideo.current) {
          meVideo.current.srcObject = s;
          meVideo.current.muted = true;
          meVideo.current.playsInline = true;
          Promise.resolve(meVideo.current.play()).catch(() => {});
        }
        socket.emit("media:state", {
          audio: false,
          video: !!camTrackRef.current,
        });
      } else {
        setMeStream(null);
        setMicOn(false);
        setCamOn(false);
        socket.emit("media:state", { audio: false, video: false });
      }
      socket.emit("peers:list");
      socket.on("peers", (users) =>
        users.forEach((u) => ensurePeer(u.id, true, s))
      );
      socket.on("presence:join", (user) => {
        if (user?.id && user.id !== socket.id) ensurePeer(user.id, true, s);
      });
      socket.on("signal", async ({ from, data }) => {
        const p = ensurePeer(from, false, s);
        await p.signal(data);
      });
      socket.on("presence:leave", (user) => {
        if (!user?.id) return;
        const entry = peersRef.current.get(user.id);
        if (entry?.pc) entry.pc.close();
        peersRef.current.delete(user.id);
        setTiles((prev) => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
      });
      socket.on("media:state", ({ from, media }) => {
        if (!from || from === socket.id) return;
        setTiles((prev) => {
          const cur = prev[from];
          if (!cur) return prev;
          return { ...prev, [from]: { ...cur, media } };
        });
      });
      function ensurePeer(remoteId, initiator, streamOrNull) {
        let entry = peersRef.current.get(remoteId);
        if (entry?.pcWrapper) return entry.pcWrapper;
        const pcWrapper = createPeer(
          initiator,
          (data) => socket.emit("signal", { to: remoteId, data }),
          (remoteStream) => {
            setTiles((prev) => ({
              ...prev,
              [remoteId]: {
                ...(prev[remoteId] || {}),
                stream: remoteStream,
                media: prev[remoteId]?.media || { audio: true, video: true },
              },
            }));
          }
        );
        pcWrapper.start(streamOrNull);
        const pc = pcWrapper.pc;
        let audioSender = null;
        let videoSender = null;
        pc.getSenders().forEach((s) => {
          if (s.track?.kind === "audio") audioSender = s;
          if (s.track?.kind === "video") videoSender = s;
        });
        if (!audioSender && !streamOrNull) {
          try {
            pc.addTransceiver("audio", { direction: "recvonly" });
          } catch {}
        }
        if (!videoSender && !streamOrNull) {
          try {
            pc.addTransceiver("video", { direction: "recvonly" });
          } catch {}
        }
        peersRef.current.set(remoteId, {
          pc,
          pcWrapper,
          audioSender,
          videoSender,
        });
        return pcWrapper;
      }
      return () => {
        mounted = false;
        socket.off("peers");
        socket.off("presence:join");
        socket.off("signal");
        socket.off("presence:leave");
        socket.off("media:state");
        for (const { pc } of peersRef.current.values()) pc.close();
        peersRef.current.clear();
        if (meStream) meStream.getTracks().forEach((t) => t.stop());
      };
    })();
  }, [socket]);
  useEffect(() => {
    if (!meStream || !meVideo.current) return;
    if (meVideo.current.srcObject !== meStream)
      meVideo.current.srcObject = meStream;
    meVideo.current.muted = true;
    meVideo.current.playsInline = true;
    Promise.resolve(meVideo.current.play()).catch(() => {});
  }, [meStream]);

  async function toggleMic() {
    if (!micTrackRef.current) return; // Can't toggle if there's no mic
    const next = !micOn;

    // For local preview, enable/disable the track on the stream
    if (meStream) {
      meStream.getAudioTracks().forEach((t) => (t.enabled = next));
    }

    const newTrack = next ? micTrackRef.current : null;
    for (const [_, entry] of peersRef.current.entries()) {
      const sender = entry.audioSender;
      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (e) {
          console.error(e);
        }
      } else if (next) {
        // If there was no sender, create one
        try {
          entry.audioSender = entry.pc.addTrack(micTrackRef.current, meStream);
        } catch (e) {
          console.error(e);
        }
      }
    }
    setMicOn(next);
    socket.emit("media:state", { audio: next, video: camOn });
  }

  async function toggleCam() {
    if (!camTrackRef.current) return; // Can't toggle if there's no camera
    const next = !camOn;

    // For local preview, we use React state, but we also toggle the track
    if (meStream) {
      meStream.getVideoTracks().forEach((t) => (t.enabled = next));
    }

    const newTrack = next ? camTrackRef.current : null;
    for (const [_, entry] of peersRef.current.entries()) {
      const sender = entry.videoSender;
      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (e) {
          console.error(e);
        }
      } else if (next) {
        // If there was no sender, create one
        try {
          entry.videoSender = entry.pc.addTrack(camTrackRef.current, meStream);
        } catch (e) {
          console.error(e);
        }
      }
    }
    setCamOn(next);
    socket.emit("media:state", { audio: micOn, video: next });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button onClick={toggleMic}>{micOn ? "Mute Mic" : "Unmute Mic"}</button>
        <button onClick={toggleCam}>
          {camOn ? "Stop Video" : "Start Video"}
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 8,
        }}
      >
        <div style={{ position: "relative" }}>
          {meStream && camOn ? (
            <video
              ref={meVideo}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                background: "#000",
                borderRadius: 8,
                aspectRatio: "16/9",
              }}
            />
          ) : (
            <VideoPlaceholder name={me?.name} />
          )}
          <Badge audio={micOn} video={camOn} label="You" />
        </div>
        {Object.entries(tiles).map(([id, obj]) => {
          const peer = participants.find((p) => p.id === id);
          const isVideoOn = obj.media?.video !== false && obj.stream;
          return (
            <div key={id} style={{ position: "relative" }}>
              {isVideoOn ? (
                <video
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && obj.stream && el.srcObject !== obj.stream) {
                      el.srcObject = obj.stream;
                    }
                  }}
                  style={{
                    width: "100%",
                    background: "#000",
                    borderRadius: 8,
                    aspectRatio: "16/9",
                  }}
                />
              ) : (
                <VideoPlaceholder name={peer?.name} />
              )}
              <Badge
                audio={obj.media?.audio !== false}
                video={obj.media?.video !== false}
                label={peer?.name}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ... (The Badge component is the same)
function Badge({ audio, video, label }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        bottom: 8,
        padding: "2px 8px",
        background: "rgba(0,0,0,0.6)",
        borderRadius: 6,
        fontSize: 12,
        color: "white",
      }}
    >
      {label && <span>{label} • </span>}
      <span>{audio ? "🎙️" : "🔇"}</span>{" "}
      <span style={{ marginLeft: 4 }}>{video ? "📹" : "🚫"}</span>
    </div>
  );
}
