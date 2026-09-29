const express = require("express");
const router = express.Router();
const store = require("../data/store");

/**
 * JSON-RPC 2.0 endpoint — POST /rpc
 *
 * Request shape:
 *   { "jsonrpc": "2.0", "method": "cancelOrder", "params": { "orderId": "order-1001" }, "id": 1 }
 *
 * Success response:
 *   { "jsonrpc": "2.0", "result": { ... }, "id": 1 }
 *
 * Error response (standard JSON-RPC error codes):
 *   { "jsonrpc": "2.0", "error": { "code": -32602, "message": "..." }, "id": 1 }
 *
 * Why JSON-RPC here (vs REST) for actions like cancelOrder: it's an
 * ACTION/COMMAND ("do this thing"), not a resource to GET/PUT — RPC
 * fits verb-shaped operations more naturally than REST's noun-shaped
 * URLs, and a single /rpc endpoint can expose many such methods
 * without inventing a new URL per action.
 */

// Standard JSON-RPC 2.0 error codes
const JSONRPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: "Parse error" },
  INVALID_REQUEST: { code: -32600, message: "Invalid Request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  INVALID_PARAMS: { code: -32602, message: "Invalid params" },
  INTERNAL_ERROR: { code: -32603, message: "Internal error" }
};

function rpcError(id, errorDef, data = null) {
  return {
    jsonrpc: "2.0",
    error: { code: errorDef.code, message: errorDef.message, data },
    id: id ?? null
  };
}

function rpcSuccess(id, result) {
  return { jsonrpc: "2.0", result, id };
}

module.exports = (io, broadcastAlert) => {
  // Method registry: each method receives (params) and returns a result,
  // or throws { errorDef, data } to signal a JSON-RPC error.
  const methods = {
    cancelOrder: (params) => {
      const orderId = params && params.orderId;
      if (!orderId || typeof orderId !== "string") {
        throw { errorDef: JSONRPC_ERRORS.INVALID_PARAMS, data: "`orderId` (string) is required" };
      }
      const result = store.cancelOrder(orderId);
      if (result === null) {
        throw { errorDef: JSONRPC_ERRORS.INVALID_PARAMS, data: `Order '${orderId}' not found` };
      }
      if (result === "ALREADY_DELIVERED") {
        throw { errorDef: JSONRPC_ERRORS.INVALID_PARAMS, data: `Order '${orderId}' is already delivered and cannot be cancelled` };
      }

      io.to(result.id).emit("order:statusUpdate", result);
      broadcastAlert(`Order ${result.id} was cancelled via JSON-RPC`);

      return result;
    },

    getOrderStatus: (params) => {
      const orderId = params && params.orderId;
      if (!orderId || typeof orderId !== "string") {
        throw { errorDef: JSONRPC_ERRORS.INVALID_PARAMS, data: "`orderId` (string) is required" };
      }
      const order = store.getOrderById(orderId);
      if (!order) {
        throw { errorDef: JSONRPC_ERRORS.INVALID_PARAMS, data: `Order '${orderId}' not found` };
      }
      return { orderId: order.id, status: order.status };
    },

    listMethods: () => Object.keys(methods)
  };

  router.post("/", (req, res) => {
    const body = req.body;

    if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return res.status(400).json(rpcError(body ? body.id : null, JSONRPC_ERRORS.INVALID_REQUEST));
    }

    const { method, params, id } = body;
    const fn = methods[method];

    if (!fn) {
      return res.status(404).json(rpcError(id, JSONRPC_ERRORS.METHOD_NOT_FOUND, `Unknown method '${method}'`));
    }

    try {
      const result = fn(params);
      // Notifications (no "id") get no response body per spec, but we
      // still return 200 for simplicity in this lab context.
      return res.status(200).json(rpcSuccess(id ?? null, result));
    } catch (err) {
      if (err && err.errorDef) {
        return res.status(200).json(rpcError(id, err.errorDef, err.data));
      }
      console.error(err);
      return res.status(200).json(rpcError(id, JSONRPC_ERRORS.INTERNAL_ERROR));
    }
  });

  return router;
};
