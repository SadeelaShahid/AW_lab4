const express = require("express");
const router = express.Router();
const store = require("../data/store");
const { ApiError } = require("../middleware/errorHandler");

module.exports = (io, broadcastAlert) => {
  // GET /api/v1/orders — list all orders
  router.get("/", (req, res) => {
    res.status(200).json({ success: true, count: store.getAllOrders().length, data: store.getAllOrders() });
  });

  // GET /api/v1/orders/:id — get one order
  router.get("/:id", (req, res, next) => {
    const order = store.getOrderById(req.params.id);
    if (!order) {
      return next(new ApiError(404, "ORDER_NOT_FOUND", `Order '${req.params.id}' not found`));
    }
    res.status(200).json({ success: true, data: order });
  });

  // POST /api/v1/orders — create a new order
  router.post("/", (req, res, next) => {
    const { customerName, items, total } = req.body || {};
    if (!customerName || typeof customerName !== "string") {
      return next(new ApiError(400, "VALIDATION_ERROR", "`customerName` is required"));
    }
    const order = store.createOrder({ customerName, items, total });

    // Real-world touch: creating an order also fires a system alert
    // over SSE, and a WebSocket event so any open dashboards update live.
    broadcastAlert(`New order placed: ${order.id} by ${order.customerName}`);
    io.emit("order:new", order);

    res.status(201).json({ success: true, data: order });
  });

  // PATCH /api/v1/orders/:id/status — update order status
  // (also demonstrates the same status change broadcasting over
  // WebSockets in real time — see src/websocket/socket.js)
  router.patch("/:id/status", (req, res, next) => {
    const { status } = req.body || {};
    if (!status) {
      return next(new ApiError(400, "VALIDATION_ERROR", "`status` is required"));
    }
    const result = store.updateOrderStatus(req.params.id, status);
    if (result === null) {
      return next(new ApiError(404, "ORDER_NOT_FOUND", `Order '${req.params.id}' not found`));
    }
    if (result === "INVALID_STATUS") {
      return next(
        new ApiError(400, "VALIDATION_ERROR", `Invalid status. Must be one of: ${store.ORDER_STATUSES.join(", ")}`)
      );
    }

    // Push the update live to anyone in this order's WebSocket room.
    io.to(result.id).emit("order:statusUpdate", result);
    broadcastAlert(`Order ${result.id} status changed to ${result.status}`);

    res.status(200).json({ success: true, data: result });
  });

  return router;
};
