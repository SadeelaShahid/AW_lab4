/**
 * WebSocket layer (Socket.io).
 *
 * Two things happen here:
 *
 * 1. ORDER STATUS ROOMS
 *    Each order gets its own room named after its id (e.g. "order-1001").
 *    A client (customer tracking their order) joins that room with
 *    "order:track", and the server emits "order:statusUpdate" into that
 *    room whenever the status changes (from REST PATCH or JSON-RPC
 *    cancelOrder) — see src/routes/orders.js and src/rpc/rpc.js.
 *
 * 2. 1-ON-1 SUPPORT CHAT
 *    A chat room is identified by orderId too (so support + customer
 *    chatting about order-1001 share room "chat:order-1001"). Both
 *    sides join with "chat:join", then send with "chat:message", and
 *    everyone else in that same room receives "chat:message" back.
 *
 * EVENTS SUMMARY (also documented in README.md):
 *   Client -> Server:
 *     - "order:track"   { orderId }                 join an order's status room
 *     - "chat:join"      { orderId, role, name }     join a 1-on-1 support chat room
 *     - "chat:message"   { orderId, sender, text }   send a chat message
 *     - "chat:typing"    { orderId, sender }         (optional) typing indicator
 *
 *   Server -> Client:
 *     - "order:statusUpdate" <order object>          order's status changed
 *     - "order:new"           <order object>          a brand-new order was placed
 *     - "chat:message"        { sender, text, timestamp }  a chat message to render
 *     - "chat:userJoined"     { role, name }          someone joined the chat room
 *     - "chat:typing"         { sender }              someone is typing
 */

function initSocket(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // --- Order status tracking room ---
    socket.on("order:track", ({ orderId }) => {
      if (!orderId) return;
      socket.join(orderId);
      socket.emit("order:tracking", { orderId, message: `Now tracking ${orderId}` });
    });

    // --- 1-on-1 support chat ---
    socket.on("chat:join", ({ orderId, role, name }) => {
      if (!orderId) return;
      const room = `chat:${orderId}`;
      socket.join(room);
      socket.data.chatRoom = room;
      socket.data.role = role;
      socket.data.name = name;
      socket.to(room).emit("chat:userJoined", { role, name });
    });

    socket.on("chat:message", ({ orderId, sender, text }) => {
      if (!orderId || !text) return;
      const room = `chat:${orderId}`;
      const payload = { sender, text, timestamp: new Date().toISOString() };
      // Broadcast to everyone in the room, including the sender, so
      // both the customer and support agent see a consistent transcript.
      io.to(room).emit("chat:message", payload);
    });

    socket.on("chat:typing", ({ orderId, sender }) => {
      if (!orderId) return;
      socket.to(`chat:${orderId}`).emit("chat:typing", { sender });
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = initSocket;
