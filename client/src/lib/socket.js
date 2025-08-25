import { io } from "socket.io-client";

export function connectRoom(code) {
  if (!code) throw new Error("connectRoom: missing code");
  // Direct to backend in dev. If you prefer the Vite proxy, you can switch base to "".
  const base = "http://localhost:8080";
  return io(base, {
    withCredentials: true,
    // let engine choose; polling fallback is robust in dev
    transports: ["websocket", "polling"],
    query: { code }, // 👈 pass room code here
    reconnectionDelayMax: 2000,
  });
}
