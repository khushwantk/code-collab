import { useState, useEffect, useRef, useCallback } from "react";

// STUN servers help browsers find a connection path.
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useScreenSharing(socket, me, participants) {
  const [myScreenStream, setMyScreenStream] = useState(null);
  const [screenShares, setScreenShares] = useState({});
  const peersRef = useRef({}); // Stores peer connections: { socketId: RTCPeerConnection }

  // Function to start screen share
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      setMyScreenStream(stream);
      setScreenShares((prev) => ({
        ...prev,
        [me.id]: { id: me.id, name: "Your Screen (Preview)", stream: stream },
      }));

      socket.emit("screenshare:start", { name: me.name });
      stream.getVideoTracks()[0].onended = stopScreenShare;
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  // Function to stop screen share
  const stopScreenShare = useCallback(() => {
    myScreenStream?.getTracks().forEach((track) => track.stop());
    setMyScreenStream(null);
    socket.emit("screenshare:stop");
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    setScreenShares({}); // Clear all shares when you stop your own
  }, [myScreenStream, socket]);

  // When I start sharing, send an offer to all other participants
  useEffect(() => {
    if (myScreenStream && me) {
      const otherParticipants = participants.filter((p) => p.id !== me.id);
      otherParticipants.forEach((participant) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current[participant.id] = pc;

        myScreenStream.getTracks().forEach((track) => {
          pc.addTrack(track, myScreenStream);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("screenshare:ice-candidate", {
              to: participant.id,
              candidate: event.candidate,
            });
          }
        };

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("screenshare:offer", {
              to: participant.id,
              offer: pc.localDescription,
            });
          });
      });
    }
  }, [myScreenStream, participants, me, socket]);

  // Effect to handle all incoming signaling events
  useEffect(() => {
    if (!socket) return;

    // A sharer sends me an offer
    socket.on("screenshare:offer", ({ from, name, offer }) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current[from] = pc;

      pc.ontrack = (event) => {
        setScreenShares((prev) => ({
          ...prev,
          [from]: { id: from, name, stream: event.streams[0] },
        }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("screenshare:ice-candidate", {
            to: from,
            candidate: event.candidate,
          });
        }
      };

      pc.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => {
          socket.emit("screenshare:answer", {
            to: from,
            answer: pc.localDescription,
          });
        });
    });

    // A viewer sends an answer back to me (the sharer)
    socket.on("screenshare:answer", ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Handling ICE candidates for connection establishment
    socket.on("screenshare:ice-candidate", ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // When a user stops sharing their screen
    socket.on("screenshare:stop", ({ from }) => {
      peersRef.current[from]?.close();
      delete peersRef.current[from];
      setScreenShares((prev) => {
        const next = { ...prev };
        delete next[from];
        return next;
      });
    });

    return () => {
      socket.off("screenshare:offer");
      socket.off("screenshare:answer");
      socket.off("screenshare:ice-candidate");
      socket.off("screenshare:stop");
    };
  }, [socket]);

  return { startScreenShare, stopScreenShare, myScreenStream, screenShares };
}
