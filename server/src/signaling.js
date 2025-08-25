import { randomName } from "./services/names.js";
import { leave } from "./services/rooms.js";
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
  io.on("connection", (socket) => {
    // 1) Get room code from query (?code=XXXXX)
    const raw = socket.handshake?.query?.code;
    const room =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!room) {
      socket.emit("connect_error", "missing_room_code");
      return socket.disconnect(true);
    }

    // 2) Enforce capacity BEFORE joining
    const size = getRoomSockets(io, room).length;
    if (size >= ROOM_MAX_SIZE) {
      socket.emit("room_full");
      return socket.disconnect(true);
    }

    socket.join(room);

    // 3) Identify this user & announce
    const user = { id: socket.id, name: randomName() };
    socket.data.user = user;

    socket.emit("me", user);
    io.to(room).emit("presence:join", user);
    broadcastRoster(io, room);

    // 4) Peer discovery for WebRTC
    socket.on("peers:list", () => {
      const others = getUsersInRoom(io, room).filter((u) => u.id !== socket.id);
      socket.emit("peers", others);
    });

    // 5) WebRTC signaling relay (target by socket id)
    socket.on("signal", ({ to, data }) => {
      io.to(to).emit("signal", { from: socket.id, data });
    });

    // 6) Media badges
    socket.on("media:state", (media) => {
      io.to(room).emit("media:state", {
        from: socket.id,
        media: { audio: !!media?.audio, video: !!media?.video },
      });
    });

    // 7) Chat
    socket.on("chat:send", (text) => {
      io.to(room).emit("chat:message", { from: user, text, ts: Date.now() });
    });

    // 8) Roster on demand (avoid races)
    socket.on("roster:get", () => {
      socket.emit("roster", getUsersInRoom(io, room));
    });

    // ------------------------------------------------------------------
    // --- NEW: Screen Sharing Signaling ---
    // ------------------------------------------------------------------

    // Announce that a user has started sharing their screen
    socket.on("screenshare:start", () => {
      console.log(
        `${user.name} (${user.id}) started screen sharing in ${room}`
      );
      // Announce to everyone else in the room
      socket.to(room).except(socket.id).emit("screenshare:start", {
        from: user.id,
        name: user.name,
      });
    });

    // Announce that a user has stopped sharing
    socket.on("screenshare:stop", () => {
      console.log(
        `${user.name} (${user.id}) stopped screen sharing in ${room}`
      );
      socket.to(room).except(socket.id).emit("screenshare:stop", {
        from: user.id,
      });
    });

    // Relay the WebRTC offer to a specific user
    socket.on("screenshare:offer", ({ to, offer }) => {
      io.to(to).emit("screenshare:offer", {
        from: user.id,
        name: user.name,
        offer,
      });
    });

    // Relay the WebRTC answer back to the sharer
    socket.on("screenshare:answer", ({ to, answer }) => {
      io.to(to).emit("screenshare:answer", {
        from: user.id,
        answer,
      });
    });

    // Relay ICE candidates between the two peers
    socket.on("screenshare:ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("screenshare:ice-candidate", {
        from: user.id,
        candidate,
      });
    });

    // 9) Cleanup
    socket.on("disconnect", async () => {
      io.to(room).emit("presence:leave", user);
      // NEW: Also announce that the disconnected user stopped their screen share
      io.to(room).emit("screenshare:stop", { from: user.id });
      broadcastRoster(io, room);
      await leave(room).catch(() => {});
    });
  });
}
