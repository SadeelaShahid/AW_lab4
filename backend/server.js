const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");

const ordersRouterFactory = require("./src/routes/orders");
const catalogRouter = require("./src/routes/catalog");
const rpcRouterFactory = require("./src/rpc/rpc");
const { router: sseRouter, broadcastAlert } = require("./src/sse/events");
const initSocket = require("./src/websocket/socket");
const { errorHandler, notFoundHandler } = require("./src/middleware/errorHandler");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Allow the deployed frontend (Vercel/Netlify) to call this backend
// (Render/Railway) from a different origin. In production, set
// FRONTEND_URL to lock this down instead of "*".
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "*", methods: ["GET", "POST"] }
});

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Order Tracking & Live Support System API",
    protocols: {
      rest_orders: "/api/v1/orders",
      rest_catalog: "/api/v1/catalog",
      json_rpc: "/rpc (POST)",
      sse_alerts: "/events",
      websocket: "Socket.io on the same server/port"
    }
  });
});

// 1. REST — resource management (orders + catalog)
app.use("/api/v1/orders", ordersRouterFactory(io, broadcastAlert));
app.use("/api/v1/catalog", catalogRouter);

// 2. JSON-RPC 2.0 — action-based methods (cancelOrder, getOrderStatus, ...)
app.use("/rpc", rpcRouterFactory(io, broadcastAlert));

// 3. Server-Sent Events — live system alerts
app.use("/events", sseRouter);

// 4. WebSockets — real-time order status + 1-on-1 support chat
initSocket(io);

app.use(notFoundHandler);
app.use(errorHandler);

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`   REST orders:   http://localhost:${PORT}/api/v1/orders`);
  console.log(`   REST catalog:  http://localhost:${PORT}/api/v1/catalog`);
  console.log(`   JSON-RPC:      http://localhost:${PORT}/rpc (POST)`);
  console.log(`   SSE alerts:    http://localhost:${PORT}/events`);
  console.log(`   WebSocket:     ws://localhost:${PORT} (Socket.io)`);
});

module.exports = { app, server, io };
