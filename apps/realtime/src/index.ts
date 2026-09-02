/**
 * /apps/realtime — Socket.io Real-time Server (Phase 4 — Full implementation)
 *
 * Responsibilities:
 *  - Accept connections from RN clients and the Next.js API server
 *  - Scope message delivery to conversation rooms only
 *  - Handle typing indicators, status updates
 */

import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@chatbot/shared-types";

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:8081").split(",");

// ─── HTTP server ──────────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime(), connections: io.engine.clientsCount }));
    return;
  }

  // Internal endpoint: API server calls this to emit a message to a room
  // POST /emit-message  body: { conversationId, message }
  if (req.method === "POST" && req.url === "/emit-message") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const secret = req.headers["x-realtime-secret"];
        if (secret !== (process.env.REALTIME_SECRET ?? "dev-secret-change-in-production")) {
          res.writeHead(401);
          res.end("Unauthorized");
          return;
        }
        const { conversationId, message } = JSON.parse(body);
        io.to(conversationId).emit("new_message", message);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("Bad Request");
      }
    });
    return;
  }

  // Internal endpoint: broadcast message status update (read receipt)
  // POST /emit-status  body: { conversationId, messageId, status }
  if (req.method === "POST" && req.url === "/emit-status") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const secret = req.headers["x-realtime-secret"];
        if (secret !== (process.env.REALTIME_SECRET ?? "dev-secret-change-in-production")) {
          res.writeHead(401);
          res.end("Unauthorized");
          return;
        }
        const { conversationId, messageId, status } = JSON.parse(body);
        io.to(conversationId).emit("message_status_update", { messageId, status });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("Bad Request");
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// ─── Socket.io ────────────────────────────────────────────────────────────────

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log(`[realtime] ✅ Client connected: ${socket.id}`);

  // ── Room management ─────────────────────────────────────────────────────────
  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`[realtime] 📥 ${socket.id} → room "${conversationId}" (${io.sockets.adapter.rooms.get(conversationId)?.size ?? 0} members)`);
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(conversationId);
    console.log(`[realtime] 📤 ${socket.id} ← room "${conversationId}"`);
  });

  // ── Typing indicators ───────────────────────────────────────────────────────
  socket.on("typing_start", (conversationId) => {
    // Broadcast to everyone else in the room
    socket.to(conversationId).emit("user_typing", {
      userId: socket.handshake.query.userId as string ?? socket.id,
      conversationId,
    });
  });

  socket.on("typing_stop", (conversationId) => {
    socket.to(conversationId).emit("user_stopped_typing", {
      userId: socket.handshake.query.userId as string ?? socket.id,
      conversationId,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[realtime] ❌ Client disconnected: ${socket.id} (${reason})`);
  });

  socket.on("error", (err) => {
    console.error(`[realtime] Socket error: ${err.message}`);
    socket.emit("error", { code: "SOCKET_ERROR", message: err.message });
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`\n[realtime] 🚀 Socket.io server running`);
  console.log(`[realtime]    http://localhost:${PORT}/health`);
  console.log(`[realtime]    Allowed origins: ${ALLOWED_ORIGINS.join(", ")}\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[realtime] Shutting down...");
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
});
