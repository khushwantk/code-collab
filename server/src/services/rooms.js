import { nanoid } from "nanoid";
import { ROOM_MAX_SIZE } from "../config.js";
import { getDb } from "../db/mongo.js";

export async function createRoom() {
  const db = getDb();
  const code = nanoid(8);
  const now = new Date();
  await db.collection("rooms").insertOne({ code, createdAt: now, members: 0 });
  return code;
}

export async function getRoom(code) {
  const db = getDb();
  return db.collection("rooms").findOne({ code });
}

// atomically reserve a seat (<= max)
export async function tryJoin(code) {
  const db = getDb();
  const res = await db
    .collection("rooms")
    .findOneAndUpdate(
      { code, members: { $lt: ROOM_MAX_SIZE } },
      { $inc: { members: 1 } },
      { returnDocument: "after" }
    );
  return res.value; // null if full or not found
}

export async function leave(code) {
  const db = getDb();
  await db
    .collection("rooms")
    .updateOne({ code, members: { $gt: 0 } }, { $inc: { members: -1 } });
}
