const express = require("express");
const router = express.Router();

/**
 * Server-Sent Events — GET /events
 *
 * A one-way, long-lived HTTP connection the server keeps open and
 * writes `data: ...\n\n` chunks to whenever there's a new system
 * alert (new order placed, status changed, order cancelled, etc).
 * Unlike WebSockets this is one-directional (server -> client only)
 * and works over plain HTTP, which is exactly what a "live alerts
 * feed" needs — no need for a full duplex channel just to push
 * notifications.
 */

// Every connected SSE client's `res` object, so we can broadcast to all of them.
const clients = new Set();

function sseHandler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // Needed so this also works cleanly when the frontend is on a
    // different origin (Vercel/Netlify) than the backend (Render/Railway).
    "Access-Control-Allow-Origin": "*"
  });
  res.flushHeaders();

  // Initial "connected" event so the client knows the stream is live.
  res.write(`event: connected\ndata: ${JSON.stringify({ message: "Connected to live alerts" })}\n\n`);

  clients.add(res);

  // Heartbeat to keep the connection alive through proxies/load balancers.
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

// Called from anywhere in the app (order created, status changed, cancelled...)
// to push a live alert to every connected browser tab.
function broadcastAlert(message) {
  const payload = JSON.stringify({ message, timestamp: new Date().toISOString() });
  clients.forEach((res) => {
    res.write(`event: alert\ndata: ${payload}\n\n`);
  });
}

router.get("/", sseHandler);

module.exports = { router, broadcastAlert };
