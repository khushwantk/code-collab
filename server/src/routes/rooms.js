import { Router } from "express";
import { createRoom, getRoom, getActiveRooms } from "../services/rooms.js";
import { AccessToken } from "livekit-server-sdk";

const router = Router();

const LK_API_KEY = process.env.LK_API_KEY || "devkey";
const LK_API_SECRET =
  process.env.LK_API_SECRET || "devsecretdevsecretdevsecret12345";

function resolvePublicLivekitUrl() {
  const raw = process.env.LK_URL || "ws://localhost:7880";
  try {
    const url = new URL(raw);
    // When running in Docker, LK_URL is often set to ws://livekit:7880 so the
    // backend container can talk to the LiveKit container by hostname.
    // That hostname is NOT resolvable from the user's browser, so we rewrite
    // it to localhost for the URL we hand back to the client.
    if (url.hostname === "livekit") {
      url.hostname = "localhost";
    }
    return url.toString();
  } catch {
    return "ws://localhost:7880";
  }
}

const LK_URL = resolvePublicLivekitUrl();

// Create an anonymous room -> returns /task/:code
router.post("/rooms", async (req, res) => {
  const { maxParticipants, duration, isPrivate, password } = req.body || {};
  const code = await createRoom({ maxParticipants, duration, isPrivate, password });
  res.json({ code });
});

// List Active Public Rooms
router.get("/rooms", async (req, res) => {
  const rooms = await getActiveRooms();
  // Filter out any sensitive server-side fields, just in case
  const sanitized = rooms.map(r => ({
    code: r.code,
    members: r.members || 0,
    maxParticipants: r.maxParticipants || 3,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    isPrivate: !!r.isPrivate
  }));
  res.json(sanitized);
});

// Info
router.get("/rooms/:code", async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found" });

  res.json({
    code: room.code,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    isPrivate: !!room.isPrivate
  });
});

// LiveKit JWT token for a participant to join the room
// GET /api/rooms/:code/token?name=SomeName
router.get("/rooms/:code/token", async (req, res) => {
  try {
    const { code } = req.params;
    const participantName = (req.query.name || "Guest") + "-" + Date.now();

    const at = new AccessToken(LK_API_KEY, LK_API_SECRET, {
      identity: participantName,
      ttl: "1h",
    });
    at.addGrant({
      roomJoin: true,
      room: code,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    res.json({ token, url: LK_URL });
  } catch (err) {
    console.error("Token error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
