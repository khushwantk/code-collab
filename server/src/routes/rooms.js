import { Router } from "express";
import { createRoom, getRoom, tryJoin } from "../services/rooms.js";

const router = Router();

// Create an anonymous room -> returns /task/:code
router.post("/rooms", async (req, res) => {
  const code = await createRoom();
  res.json({ code });
});

// Info
router.get("/rooms/:code", async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "Not found" });
  res.json({ code: room.code, members: room.members });
});

export default router;
