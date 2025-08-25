import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy the Socket.IO engine + namespaces to the Node server
      "/socket.io": {
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
      // (optional) if you call REST without VITE_API_URL:
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
