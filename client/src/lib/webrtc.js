// Minimal mesh: each client calls others; signaling is via socket.io 'signal'
export async function createMediaStream(
  constraints = { audio: true, video: true }
) {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    // No permission or no devices -> receive-only mode
    // return null;
  }
}

export function createPeer(isInitiator, onSignal, onStream) {
  const pc = new RTCPeerConnection();

  pc.onicecandidate = (e) =>
    e.candidate && onSignal({ candidate: e.candidate });

  pc.ontrack = (e) => onStream(e.streams[0]);

  async function signal({ sdp, candidate }) {
    if (sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      if (sdp.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        onSignal({ sdp: pc.localDescription });
      }
    } else if (candidate) {
      await pc.addIceCandidate(candidate);
    }
  }

  async function start(streamOrNull) {
    if (streamOrNull) {
      // Normal case: publish local tracks
      streamOrNull.getTracks().forEach((t) => pc.addTrack(t, streamOrNull));
    } else {
      // Receive-only: make sure we negotiate receiving A/V
      // (won't show a local preview, but remote tracks will arrive)
      try {
        pc.addTransceiver("video", { direction: "recvonly" });
      } catch {}
      try {
        pc.addTransceiver("audio", { direction: "recvonly" });
      } catch {}
    }

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      onSignal({ sdp: pc.localDescription });
    }
  }

  return { pc, signal, start };
}
