import React, { useEffect, useRef } from "react";

// A single video tile for a screen share
function ScreenShareTile({ stream, name, onClick }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="screenshare-tile" onClick={onClick}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%" }}
      />
      <div className="screenshare-name">{name}</div>
    </div>
  );
}

// The panel that contains all active screen shares
export default function ScreenSharePanel({ shares, onSelect }) {
  const hasShares = Object.keys(shares).length > 0;

  if (!hasShares) {
    return null; // Don't render anything if there are no shares
  }

  return (
    <div className="card screenshare-panel">
      <b>Active Screen Shares</b>
      <div className="screenshare-grid">
        {Object.entries(shares).map(([id, share]) => (
          <ScreenShareTile
            key={id}
            stream={share.stream}
            name={share.name}
            onClick={() => onSelect(share)}
          />
        ))}
      </div>
    </div>
  );
}
