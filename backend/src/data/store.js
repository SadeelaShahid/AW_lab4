const { v4: uuidv4 } = require("uuid");

/**
 * Shared in-memory "database". REST, JSON-RPC, WebSockets and SSE
 * all read/write this same data, so an order cancelled via JSON-RPC
 * is instantly reflected in REST GETs and triggers a WebSocket
 * status-update event to anyone tracking that order.
 */

const ORDER_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED"
];

const catalog = [
  { id: "p1", name: "Wireless Mouse", price: 19.99, category: "Electronics" },
  { id: "p2", name: "Mechanical Keyboard", price: 59.99, category: "Electronics" },
  { id: "p3", name: "Running Shoes", price: 74.5, category: "Footwear" }
];

let orders = [
  {
    id: "order-1001",
    customerName: "Ali Raza",
    items: [{ productId: "p1", name: "Wireless Mouse", qty: 2, price: 19.99 }],
    total: 39.98,
    status: "PREPARING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "order-1002",
    customerName: "Sadeela Shahid",
    items: [{ productId: "p3", name: "Running Shoes", qty: 1, price: 74.5 }],
    total: 74.5,
    status: "OUT_FOR_DELIVERY",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const getCatalog = () => catalog;

const getAllOrders = () => orders;

const getOrderById = (id) => orders.find((o) => o.id === id);

const createOrder = (data) => {
  const newOrder = {
    id: `order-${uuidv4().slice(0, 8)}`,
    customerName: data.customerName,
    items: data.items || [],
    total: data.total || 0,
    status: "PLACED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  orders.push(newOrder);
  return newOrder;
};

const updateOrderStatus = (id, status) => {
  const order = getOrderById(id);
  if (!order) return null;
  if (!ORDER_STATUSES.includes(status)) return "INVALID_STATUS";
  order.status = status;
  order.updatedAt = new Date().toISOString();
  return order;
};

const cancelOrder = (id) => {
  const order = getOrderById(id);
  if (!order) return null;
  if (order.status === "DELIVERED") return "ALREADY_DELIVERED";
  if (order.status === "CANCELLED") return order; // idempotent no-op
  order.status = "CANCELLED";
  order.updatedAt = new Date().toISOString();
  return order;
};

module.exports = {
  ORDER_STATUSES,
  getCatalog,
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder
};
