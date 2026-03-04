import { io } from "socket.io-client";

export function connectRoom(code, name, password) {
  if (!code) throw new Error("connectRoom: missing code");
  const base = import.meta.env.VITE_API_URL || "http://localhost:8080";
  const query = { code };
  if (name) query.name = name;
  if (password) query.password = password;

  return io(base, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    query,
    reconnectionDelayMax: 2000,
  });
}
