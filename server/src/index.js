import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import { CORS_ORIGIN, PORT } from "./config.js";
import { connectMongo } from "./db/mongo.js";
import roomsRouter from "./routes/rooms.js";
import { setupSignaling } from "./signaling.js";

async function main() {
  await connectMongo();

  const app = express();
  app.use(cors({ origin: "*" }));
  app.use(express.json());
  app.use("/api", roomsRouter);

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true } });
  setupSignaling(io);

  server.listen(PORT, () => console.log(`API & signaling on :${PORT}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
