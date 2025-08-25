import "dotenv/config";

export const PORT = process.env.PORT || 8080;
export const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
export const DB_NAME = process.env.DB_NAME || "codecollab";
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
export const ROOM_MAX_SIZE = Number(process.env.ROOM_MAX_SIZE || 3);
export const YWS_URL = process.env.YWS_URL || "ws://localhost:1234"; // y-websocket URL
