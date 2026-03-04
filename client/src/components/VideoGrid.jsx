import React, { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
} from "livekit-client";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function VideoPlaceholder({ name }) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "var(--muted)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "var(--bg)",
          border: "2px solid var(--text)",
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

function VideoTile({ track, audioTrack, name, audioOn, videoOn, muted }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && track) {
      track.attach(videoRef.current);
    }
    return () => {
      if (track) {
        try {
          track.detach();
        } catch { }
      }
    };
  }, [track]);

  // Attach remote audio tracks to a hidden <audio> element so we can hear others.
  useEffect(() => {
    if (audioRef.current && audioTrack && !muted) {
      audioTrack.attach(audioRef.current);
    }
    return () => {
      if (audioTrack) {
        try {
          audioTrack.detach();
        } catch { }
      }
    };
  }, [audioTrack, muted]);

  return (
    <>
      {/* Backdrop for expanded view */}
      {isExpanded && (
        <div
          className="video-tile-backdrop"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* The actual tile container */}
      <div
        className={`video-tile-container ${isExpanded ? 'expanded' : 'clickable'}`}
        style={!isExpanded ? { position: "relative", cursor: "pointer" } : {}}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        {track && videoOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              background: "var(--bg-elev)",
              borderRadius: isExpanded ? "0" : "var(--radius-lg)",
              aspectRatio: isExpanded ? "auto" : "16/9",
              boxShadow: "var(--shadow)",
            }}
          />
        ) : (
          <VideoPlaceholder name={name} />
        )}

        {/* Hidden audio element for remote participants */}
        {!muted && audioTrack && (
          <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
        )}

        {/* HUD Overlay layer */}
        <div className="video-tile-hud">
          <Badge audio={audioOn} video={videoOn} label={name} />
          <button
            className="video-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            title={isExpanded ? "Minimize video" : "Expand video"}
            aria-label={isExpanded ? "Minimize video" : "Expand video"}
          >
            {isExpanded ? "↙️" : "↗️"}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * VideoGrid — LiveKit-powered video/audio grid.
 *
 * Props:
 *   socket      — socket.io instance for media:state badges
 *   me          — { id, name } from the signaling server
 *   participants — roster from the signaling server
 *   roomCode    — the room code used to fetch a LiveKit token
 *   onRoomReady — callback(room) fired once the LiveKit Room is connected,
 *                 so the parent can wire screen-sharing
 */
export default function VideoGrid({ socket, me, participants, roomCode, onRoomReady }) {
  const [room] = useState(
    () => new Room({ adaptiveStream: true, dynacast: true })
  );
  const [tiles, setTiles] = useState([]);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isSingleColumn, setIsSingleColumn] = useState(false);
  const localAudPubRef = useRef(null);
  const localVidPubRef = useRef(null);

  useEffect(() => {
    if (!roomCode || !me?.name) return;
    let mounted = true;

    function buildTile(rp) {
      const vidPub = [...rp.videoTrackPublications.values()].find(
        (p) => p.source === Track.Source.Camera && p.track
      );
      const audPub = [...rp.audioTrackPublications.values()].find(
        (p) => p.source === Track.Source.Microphone
      );
      // Match name from the roster if possible
      const match = participants.find((p) => rp.identity.startsWith(p.name));
      return {
        sid: rp.identity,
        name: match?.name || rp.identity.split("-")[0],
        videoTrack: vidPub?.isMuted ? null : (vidPub?.track ?? null),
        audioTrack: audPub?.track ?? null,
        micOn: audPub ? !audPub.isMuted : false,
        camOn: vidPub ? !vidPub.isMuted : false,
        isLocal: false,
      };
    }

    function syncTiles() {
      if (!mounted) return;
      const list = [];

      // Local participant tile
      const lp = room.localParticipant;
      const localVidPub = [...lp.videoTrackPublications.values()].find(
        (p) => p.source === Track.Source.Camera
      );
      const localAudPub = [...lp.audioTrackPublications.values()].find(
        (p) => p.source === Track.Source.Microphone
      );
      list.push({
        sid: "local",
        name: me.name + " (you)",
        videoTrack: localVidPub?.isMuted ? null : (localVidPub?.track ?? null),
        audioTrack: null, // never play own audio back
        micOn: localAudPub ? !localAudPub.isMuted : false,
        camOn: localVidPub ? !localVidPub.isMuted : false,
        isLocal: true,
      });

      // Remote participant tiles
      for (const rp of room.remoteParticipants.values()) {
        list.push(buildTile(rp));
      }

      setTiles(list);
      setMicOn(list[0]?.micOn ?? false);
      setCamOn(list[0]?.camOn ?? false);
    }

    async function connect() {
      try {
        const res = await fetch(
          `${API_BASE}/api/rooms/${roomCode}/token?name=${encodeURIComponent(me.name)}`
        );
        const { token, url } = await res.json();

        room
          .on(RoomEvent.TrackSubscribed, syncTiles)
          .on(RoomEvent.TrackUnsubscribed, syncTiles)
          .on(RoomEvent.TrackMuted, syncTiles)
          .on(RoomEvent.TrackUnmuted, syncTiles)
          .on(RoomEvent.ParticipantConnected, syncTiles)
          .on(RoomEvent.ParticipantDisconnected, syncTiles)
          .on(RoomEvent.LocalTrackPublished, syncTiles)
          .on(RoomEvent.LocalTrackUnpublished, syncTiles);

        await room.connect(url, token, {
          autoSubscribe: true,
          // Help debug ICE / PC creation by surfacing detailed errors
          // and using the browser's default RTC config.
          rtcConfig: { iceTransportPolicy: "all" },
        });
        if (!mounted) return;
        setConnected(true);
        onRoomReady?.(room);

        // Publish local camera + mic, both muted initially
        const tracks = await createLocalTracks({ audio: true, video: true });
        for (const track of tracks) {
          const pub = await room.localParticipant.publishTrack(track);
          await pub.mute();
          if (track.kind === "audio") localAudPubRef.current = pub;
          if (track.kind === "video") localVidPubRef.current = pub;
        }
        syncTiles();
      } catch (err) {
        console.error("LiveKit connect error (no media?):", err);
        if (mounted) setConnected(false);
      }
    }

    connect();

    return () => {
      mounted = false;
      room.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, me?.name]);

  async function toggleMic() {
    const pub = localAudPubRef.current;
    if (!pub) return;
    // Ensure browser audio context is started after a user gesture
    try {
      await room.startAudio();
    } catch { }
    const next = !micOn;
    if (next) {
      await pub.unmute();
      toast.success("Mic unmuted");
    } else {
      await pub.mute();
      toast("Mic muted", { icon: "🔇" });
    }
    setMicOn(next);
    socket?.emit("media:state", { audio: next, video: camOn });
  }

  async function toggleCam() {
    const pub = localVidPubRef.current;
    if (!pub) return;
    // Ensure browser audio context is started after a user gesture
    try {
      await room.startAudio();
    } catch { }
    const next = !camOn;
    if (next) {
      await pub.unmute();
      toast.success("Video started");
    } else {
      await pub.mute();
      toast("Video stopped", { icon: "🚫" });
    }
    setCamOn(next);
    socket?.emit("media:state", { audio: micOn, video: next });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <button className={`btn btn--sm ${micOn ? 'btn--ghost' : 'btn--primary'}`} onClick={toggleMic} disabled={!connected}>
          {micOn ? "🔇 Mute Mic" : "🎙️ Unmute Mic"}
        </button>
        <button className={`btn btn--sm ${camOn ? 'btn--ghost' : 'btn--primary'}`} onClick={toggleCam} disabled={!connected}>
          {camOn ? "🚫 Stop Video" : "📹 Start Video"}
        </button>
        {/* Grid Toggle Control */}
        <div style={{ display: 'flex', marginLeft: 'auto', background: 'var(--muted)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          <button
            className={`btn btn--sm grid-toggle-btn ${!isSingleColumn ? 'active' : ''}`}
            onClick={() => setIsSingleColumn(false)}
            title="Auto Grid View"
            aria-label="Auto Grid View"
          >
            🔳
          </button>
          <button
            className={`btn btn--sm grid-toggle-btn ${isSingleColumn ? 'active' : ''}`}
            onClick={() => setIsSingleColumn(true)}
            title="Single Column View"
            aria-label="Single Column View"
          >
            🔲
          </button>
        </div>

      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isSingleColumn ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {tiles.length === 0 && <VideoPlaceholder name={me?.name} />}
        {tiles.map((tile) => (
          <VideoTile
            key={tile.sid}
            track={tile.videoTrack}
            audioTrack={tile.audioTrack}
            name={tile.name}
            audioOn={tile.micOn}
            videoOn={tile.camOn}
            muted={tile.isLocal}
          />
        ))}
      </div>
    </div>
  );
}
