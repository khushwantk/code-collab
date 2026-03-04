import { randomName } from "./services/names.js";
import { leave, getRoom, joinRoom } from "./services/rooms.js";
import { ROOM_MAX_SIZE } from "./config.js";

function getRoomSockets(io, room) {
  const ids = io.sockets.adapter.rooms.get(room);
  if (!ids) return [];
  return [...ids].map((id) => io.sockets.sockets.get(id)).filter(Boolean);
}
function getUsersInRoom(io, room) {
  return getRoomSockets(io, room).map((s) => s.data.user);
}
function broadcastRoster(io, room) {
  io.to(room).emit("roster", getUsersInRoom(io, room));
}

export function setupSignaling(io) {
  io.on("connection", async (socket) => {
    // Get room code from query (?code=XXXXX)
    const raw = socket.handshake?.query?.code;
    const room =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!room) {
      socket.emit("connect_error", "missing_room_code");
      return socket.disconnect(true);
    }

    // Fetch the room document to check bounds
    const roomDoc = await getRoom(room);
    if (!roomDoc) {
      socket.emit("connect_error", "room_not_found");
      return socket.disconnect(true);
    }

    // Check expiration
    if (roomDoc.expiresAt && Date.now() > roomDoc.expiresAt.getTime()) {
      socket.emit("room_expired");
      return socket.disconnect(true);
    }

    // Check private room password
    if (roomDoc.isPrivate) {
      if (socket.handshake?.query?.password !== roomDoc.password) {
        socket.emit("invalid_password");
        return socket.disconnect(true);
      }
    }

    // Enforce capacity BEFORE joining
    const size = getRoomSockets(io, room).length;
    const limit = roomDoc.maxParticipants || ROOM_MAX_SIZE;
    if (size >= limit) {
      socket.emit("room_full");
      return socket.disconnect(true);
    }

    socket.join(room);
    joinRoom(room).catch(console.error);

    // Identify this user & announce
    const providedName = socket.handshake?.query?.name;
    const user = { id: socket.id, name: providedName || randomName() };
    socket.data.user = user;

    socket.emit("me", { ...user, expiresAt: roomDoc.expiresAt });
    io.to(room).emit("presence:join", user);
    broadcastRoster(io, room);

    // Schedule auto-disconnect if the room is going to expire
    let expirationTimeout = null;
    if (roomDoc.expiresAt) {
      const timeRemaining = roomDoc.expiresAt.getTime() - Date.now();
      if (timeRemaining > 0) {
        expirationTimeout = setTimeout(() => {
          socket.emit("room_expired");
          socket.disconnect(true);
        }, timeRemaining);
      }
    }

    // Roster on demand (avoid races)
    socket.on("roster:get", () => {
      socket.emit("roster", getUsersInRoom(io, room));
    });

    // Media badges (mic/cam on-off indicators, actual media handled by LiveKit)
    socket.on("media:state", (media) => {
      io.to(room).emit("media:state", {
        from: socket.id,
        media: { audio: !!media?.audio, video: !!media?.video },
      });
    });

    // Chat
    socket.on("chat:send", (text) => {
      io.to(room).emit("chat:message", { from: user, text, ts: Date.now() });
    });

    // Screenshare presence badges (LiveKit handles the actual WebRTC media)
    socket.on("screenshare:start", () => {
      console.log(`${user.name} (${user.id}) started screen sharing in ${room}`);
      socket.to(room).emit("screenshare:start", { from: user.id, name: user.name });
    });

    socket.on("screenshare:stop", () => {
      console.log(`${user.name} (${user.id}) stopped screen sharing in ${room}`);
      socket.to(room).emit("screenshare:stop", { from: user.id });
    });

    // Cleanup
    socket.on("disconnect", async () => {
      if (expirationTimeout) clearTimeout(expirationTimeout);
      io.to(room).emit("presence:leave", user);
      io.to(room).emit("screenshare:stop", { from: user.id });
      broadcastRoster(io, room);
      await leave(room).catch(() => { });
    });
  });
}
