import React, { useEffect, useRef, useState } from "react";
import { createMediaStream, createPeer } from "../lib/webrtc.js";

export default function VideoGrid({ socket }) {
  const [meStream, setMeStream] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  const [tiles, setTiles] = useState({});

  const peersRef = useRef(new Map());
  const meVideo = useRef(null);

  // keep refs to original local tracks so we can restore on unmute
  const micTrackRef = useRef(null);
  const camTrackRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const s = await createMediaStream(); // null if blocked
      if (!mounted) return;

      if (s) {
        // cache original local tracks
        micTrackRef.current = s.getAudioTracks()[0] || null;
        camTrackRef.current = s.getVideoTracks()[0] || null;

        // 🔇 start with MIC MUTED, camera on
        s.getAudioTracks().forEach((t) => (t.enabled = false)); // mute mic by default
        s.getVideoTracks().forEach((t) => (t.enabled = true)); // keep cam on

        setMeStream(s);
        setMicOn(false); // reflect muted state
        setCamOn(!!camTrackRef.current); // true if we have a video track

        // self preview
        if (meVideo.current) {
          meVideo.current.srcObject = s;
          meVideo.current.muted = true; // prevent local echo
          meVideo.current.playsInline = true;
          Promise.resolve(meVideo.current.play()).catch(() => {});
        }

        // broadcast initial media state
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

      // existing peers
      socket.emit("peers:list");
      socket.on("peers", (users) =>
        users.forEach((u) => ensurePeer(u.id, true, s))
      );

      // newcomers
      socket.on("presence:join", (user) => {
        if (user?.id && user.id !== socket.id) ensurePeer(user.id, true, s);
      });

      // signaling
      socket.on("signal", async ({ from, data }) => {
        const p = ensurePeer(from, false, s);
        await p.signal(data);
      });

      // peer left
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

      // media badges (ignore self; don't create ghost tiles)
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

        // publish our local stream (if any). If null, pcWrapper.start should set up recvonly.
        pcWrapper.start(streamOrNull);

        // discover senders so we can hard-mute by replacing track
        const pc = pcWrapper.pc;
        let audioSender = null;
        let videoSender = null;
        pc.getSenders().forEach((s) => {
          if (s.track?.kind === "audio") audioSender = s;
          if (s.track?.kind === "video") videoSender = s;
        });

        // If no local stream (recv-only), ensure we can still receive media:
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

      // cleanup
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  // keep self preview alive
  useEffect(() => {
    if (!meStream || !meVideo.current) return;
    if (meVideo.current.srcObject !== meStream)
      meVideo.current.srcObject = meStream;
    meVideo.current.muted = true;
    meVideo.current.playsInline = true;
    Promise.resolve(meVideo.current.play()).catch(() => {});
  }, [meStream]);

  // toggles
  async function toggleMic() {
    if (!meStream) return;
    const next = !micOn;

    // 1) local track UX
    meStream.getAudioTracks().forEach((t) => (t.enabled = next));

    // 2) definitively stop/start sending to peers via replaceTrack
    const newTrack = next ? micTrackRef.current : null;
    for (const [_, entry] of peersRef.current.entries()) {
      if (entry.audioSender) {
        try {
          await entry.audioSender.replaceTrack(newTrack);
        } catch {
          // fallback: if replaceTrack fails, try removing/adding
          try {
            if (!next) {
              entry.pc.removeTrack(entry.audioSender);
              entry.audioSender = null;
            } else if (micTrackRef.current) {
              entry.audioSender = entry.pc.addTrack(
                micTrackRef.current,
                meStream
              );
            }
          } catch {}
        }
      } else if (next && micTrackRef.current) {
        // if we didn't have a sender (recv-only peer), add one now
        try {
          entry.audioSender = entry.pc.addTrack(micTrackRef.current, meStream);
        } catch {}
      }
    }

    setMicOn(next);
    socket.emit("media:state", { audio: next, video: camOn });
  }

  function toggleCam() {
    if (!meStream) return;
    const next = !camOn;
    meStream.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
    socket.emit("media:state", { audio: micOn, video: next });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Controls */}
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

      {/* Camera grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 8,
        }}
      >
        {/* self */}
        <div style={{ position: "relative" }}>
          {meStream ? (
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
            <div
              style={{
                width: "100%",
                aspectRatio: "16/9",
                background: "#121212",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed #333",
                fontSize: 12,
                opacity: 0.8,
              }}
            >
              Camera blocked — receive‑only
            </div>
          )}
          <Badge audio={micOn} video={camOn} label="You" />
        </div>

        {/* peers */}
        {Object.entries(tiles).map(([id, obj]) => (
          <div key={id} style={{ position: "relative" }}>
            <video
              autoPlay
              playsInline
              ref={(el) => {
                if (!el || !obj.stream) return;
                if (el.srcObject !== obj.stream) {
                  el.srcObject = obj.stream;
                  el.playsInline = true;
                  Promise.resolve(el.play()).catch(() => {});
                }
              }}
              style={{
                width: "100%",
                background: "#000",
                borderRadius: 8,
                aspectRatio: "16/9",
              }}
            />
            <Badge
              audio={obj.media?.audio !== false}
              video={obj.media?.video !== false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

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
      }}
    >
      {label ? `${label} • ` : ""}
      {audio ? "🎙️" : "🔇"} {video ? "📹" : "🚫"}
    </div>
  );
}
