import { useState, useEffect, useRef, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalScreenTracks,
} from "livekit-client";

/**
 * useScreenSharing
 * ----------------
 * Delegates actual WebRTC to LiveKit.
 * Keeps socket.io events for presence badges (screenshare:start/stop)
 * so the ScreenSharePanel can still show who is sharing.
 */
export function useScreenSharing(socket, me, participants, livekitRoom) {
  const [myScreenStream, setMyScreenStream] = useState(null);
  const [screenShares, setScreenShares] = useState({});
  const screenPubRef = useRef(null);

  // ---- sync remote screen shares from LiveKit ----
  useEffect(() => {
    if (!livekitRoom) return;

    function syncScreenShares() {
      const shares = {};
      for (const rp of livekitRoom.remoteParticipants.values()) {
        const pub = [...rp.videoTrackPublications.values()].find(
          (p) => p.source === Track.Source.ScreenShare && p.track
        );
        if (pub) {
          const matchedParticipant = participants.find((p) =>
            rp.identity.startsWith(p.name)
          );
          const name = matchedParticipant?.name || rp.identity.split("-")[0];
          // Build a MediaStream from the LiveKit track so ScreenSharePanel can use it
          const mediaStream = new MediaStream([pub.track.mediaStreamTrack]);
          shares[rp.identity] = { id: rp.identity, name, stream: mediaStream };
        }
      }
      setScreenShares((prev) => {
        // preserve our local screen share if it exists
        if (me?.id && prev[me.id]) {
          shares[me.id] = prev[me.id];
        }
        return shares;
      });
    }

    livekitRoom
      .on(RoomEvent.TrackSubscribed, syncScreenShares)
      .on(RoomEvent.TrackUnsubscribed, syncScreenShares)
      .on(RoomEvent.ParticipantDisconnected, syncScreenShares);

    syncScreenShares();

    return () => {
      livekitRoom
        .off(RoomEvent.TrackSubscribed, syncScreenShares)
        .off(RoomEvent.TrackUnsubscribed, syncScreenShares)
        .off(RoomEvent.ParticipantDisconnected, syncScreenShares);
    };
  }, [livekitRoom, participants, me?.id]);

  // ---- start screen share via LiveKit ----
  const startScreenShare = useCallback(async () => {
    if (!livekitRoom) return;
    try {
      const [screenTrack] = await createLocalScreenTracks({ audio: true });
      await livekitRoom.localParticipant.publishTrack(screenTrack);
      screenPubRef.current = screenTrack;

      const stream = new MediaStream([screenTrack.mediaStreamTrack]);
      setMyScreenStream(stream);

      // Badge announcement via socket
      socket?.emit("screenshare:start");

      // Stop when the user hits the browser's native "Stop sharing" button
      screenTrack.mediaStreamTrack.onended = () => stopScreenShare();

      // Also show local preview
      setScreenShares((prev) => ({
        ...prev,
        [me?.id]: {
          id: me?.id,
          name: "Your Screen (Preview)",
          stream,
        },
      }));
    } catch (err) {
      console.error("Screen share start failed:", err);
    }
  }, [livekitRoom, socket, me]);

  // ---- stop screen share ----
  const stopScreenShare = useCallback(async () => {
    if (screenPubRef.current) {
      try {
        await livekitRoom?.localParticipant.unpublishTrack(screenPubRef.current);
        screenPubRef.current.stop();
      } catch { }
      screenPubRef.current = null;
    }
    setMyScreenStream(null);
    socket?.emit("screenshare:stop");
    setScreenShares((prev) => {
      const next = { ...prev };
      delete next[me?.id];
      return next;
    });
  }, [livekitRoom, socket, me]);

  return { startScreenShare, stopScreenShare, myScreenStream, screenShares };
}
