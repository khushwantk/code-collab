import { io } from "socket.io-client";

export function connectRoom(code) {
  if (!code) throw new Error("connectRoom: missing code");
  // Direct to backend in dev.
  const base = "http://localhost:8080";
  return io(base, {
    withCredentials: true,

    transports: ["websocket", "polling"],
    query: { code },
    reconnectionDelayMax: 2000,
  });
}
