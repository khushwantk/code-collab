import React, { useEffect, useRef, useState } from "react";

// A single video tile for a screen share
function ScreenShareTile({ stream, name }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <>
      {isExpanded && (
        <div
          className="video-tile-backdrop"
          onClick={() => setIsExpanded(false)}
        />
      )}
      <div
        className={`video-tile-container ${isExpanded ? 'expanded' : 'clickable'}`}
        style={!isExpanded ? { position: "relative", cursor: "zoom-in" } : {}}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "var(--bg-elev)",
            borderRadius: isExpanded ? "0" : "var(--radius-lg)",
            aspectRatio: isExpanded ? "auto" : "16/9",
            boxShadow: "var(--shadow)",
          }}
        />
        <div className="video-tile-hud">
          <div className="screenshare-name" style={{ left: 8, bottom: 8, padding: "2px 8px", borderRadius: 6 }}>
            {name}'s Screen
          </div>
          <button
            className="video-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            title={isExpanded ? "Minimize screen" : "Expand screen"}
            aria-label={isExpanded ? "Minimize screen" : "Expand screen"}
          >
            {isExpanded ? "↙️" : "↗️"}
          </button>
        </div>
      </div>
    </>
  );
}

// The panel that contains all active screen shares
export default function ScreenSharePanel({ shares }) {
  const [isSingleColumn, setIsSingleColumn] = useState(false);
  const hasShares = Object.keys(shares).length > 0;

  if (!hasShares) {
    return null; // Don't render anything if there are no shares
  }

  return (
    <div className="card" style={{ padding: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Active Screen Shares</div>

        {/* Grid Toggle Control */}
        <div style={{ display: 'flex', background: 'var(--muted)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
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
        {Object.entries(shares).map(([id, share]) => (
          <ScreenShareTile
            key={id}
            stream={share.stream}
            name={share.name}
          />
        ))}
      </div>
    </div>
  );
}
