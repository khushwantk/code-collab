import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils.js";

const server = http.createServer();
const wss = new WebSocketServer({ server });
wss.on("connection", (conn, req) => {
  const params = new URLSearchParams(req.url.replace(/^.*\?/, ""));
  const doc = req.url.split("/").filter(Boolean).at(-1); // last segment
  setupWSConnection(conn, req, { docName: doc, gc: true });
});
server.listen(process.env.PORT || 1234, () => {
  console.log("y-websocket on :" + (process.env.PORT || 1234));
});
