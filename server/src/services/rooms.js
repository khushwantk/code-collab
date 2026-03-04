import { nanoid } from "nanoid";
import { ROOM_MAX_SIZE } from "../config.js";
import { getDb } from "../db/mongo.js";

export async function createRoom({ maxParticipants = 3, duration = 60, isPrivate = false, password = "" } = {}) {
  const db = getDb();
  const code = nanoid(8);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + duration * 60000);
  await db.collection("rooms").insertOne({
    code,
    createdAt: now,
    expiresAt,
    members: 0,
    maxParticipants,
    isPrivate,
    password
  });
  return code;
}

export async function getRoom(code) {
  const db = getDb();
  return db.collection("rooms").findOne({ code });
}

export async function getActiveRooms() {
  const db = getDb();
  const now = new Date();
  const twoMinsAgo = new Date(now.getTime() - 2 * 60000);

  // Find rooms where:
  // 1) expiresAt is explicitly set in the future OR
  // 2) expiresAt is missing/null BUT it was created very recently (< 2m ago)
  // This smoothly drops all legacy rooms created hours ago before the feature existed.
  return db
    .collection("rooms")
    .find({
      $or: [
        { expiresAt: { $gt: now } },
        { expiresAt: { $in: [null, undefined] }, createdAt: { $gt: twoMinsAgo } }
      ]
    })
    .sort({ createdAt: -1 })
    .toArray();
}

// increment members count for UI syncing (capacity is enforced via Socket IO adapter size)
export async function joinRoom(code) {
  const db = getDb();
  await db
    .collection("rooms")
    .updateOne({ code }, { $inc: { members: 1 } });
}

export async function leave(code) {
  const db = getDb();

  // Decrement the member count and return the updated document
  const res = await db
    .collection("rooms")
    .findOneAndUpdate(
      { code, members: { $gt: 0 } },
      { $inc: { members: -1 } },
      { returnDocument: "after" }
    );

  const room = res.value;
  // If we just dropped the room to 0 participants, proactively schedule its death
  if (room && room.members === 0) {
    const now = new Date();
    const gracePeriod = new Date(now.getTime() + 2 * 60000); // 2 minutes from now

    // Only bring forward the expiration if the current expiresAt is further out
    // (We don't want to accidentally extend a room that was going to expire in 30 seconds!)
    if (!room.expiresAt || room.expiresAt > gracePeriod) {
      await db.collection("rooms").updateOne(
        { code },
        { $set: { expiresAt: gracePeriod } }
      );
    }
  }
}
