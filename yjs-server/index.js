import http from "http";
import { WebSocketServer } from "ws";
import { setupWSConnection, setPersistence } from "y-websocket/bin/utils";
import { LeveldbPersistence } from "y-leveldb";

const PERSISTENCE_DIR = process.env.YJS_PERSIST_DIR || "./yjs-db";
const ldb = new LeveldbPersistence(PERSISTENCE_DIR);

// Wire LevelDB persistence so docs survive restarts
setPersistence({
  provider: ldb,
  bindState: async (docName, ydoc) => {
    const persistedYdoc = await ldb.getYDoc(docName);
    const newUpdates = persistedYdoc.store.clients;
    if (newUpdates.size > 0) {
      // Apply persisted state into the in-memory doc
      const Y = await import("yjs");
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
    }
    ydoc.on("update", (update) => {
      ldb.storeUpdate(docName, update);
    });
  },
  writeState: async (_docName, _ydoc) => {
    // Incremental updates already handled in bindState
  },
});

console.log(`Persisting Yjs docs to: ${PERSISTENCE_DIR}`);

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (conn, req) => {
  const doc = req.url.split("/").filter(Boolean).at(-1);
  setupWSConnection(conn, req, { docName: doc, gc: true });
});

server.listen(process.env.PORT || 1234, () => {
  console.log("y-websocket on :" + (process.env.PORT || 1234));
});
