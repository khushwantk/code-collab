import React, { useEffect, useRef } from "react";

export default function FullScreenViewer({ share, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && share?.stream) {
      videoRef.current.srcObject = share.stream;
    }
  }, [share]);

  if (!share) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        <video ref={videoRef} autoPlay playsInline style={styles.video} />
        <button style={styles.closeButton} onClick={onClose}>
          &times;
        </button>
        <div style={styles.nameTag}>{share.name}'s Screen</div>
      </div>
    </div>
  );
}

// Styles object for the component
const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  container: {
    position: "relative", // This is crucial for positioning the close button
    width: "90vw",
    height: "90vh",
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: "15px",
    right: "15px",
    color: "red", // Set color to red
    background: "none",
    border: "none",
    fontSize: "36px",
    fontWeight: "bold",
    cursor: "pointer",
    lineHeight: "1",
    padding: 0,
    zIndex: 10, // Ensure it's above the video element
  },
  nameTag: {
    position: "absolute",
    bottom: "10px",
    left: "10px",
    color: "white",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: "5px 10px",
    borderRadius: "5px",
    fontSize: "14px",
  },
};
