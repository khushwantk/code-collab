import { MongoClient } from "mongodb";
import { MONGO_URL, DB_NAME } from "../config.js";

let client, db;
export async function connectMongo() {
  if (db) return db;
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  await db.collection("rooms").createIndex({ code: 1 }, { unique: true });
  // Rooms auto-expire after 24 hours
  await db.collection("rooms").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 86400 }
  );
  return db;
}
export function getDb() {
  return db;
}
