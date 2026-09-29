# Order Tracking & Live Support System — Lab Assignment 04

## 📖 Introduction

This is my submission for **Lab Assignment 04: Real-time Order Tracking & Live Support System**. The goal was to build one full-stack app that demonstrates **four different communication protocols** working together on the same data:

| Protocol | Used for | Endpoint |
|---|---|---|
| **REST** | Managing orders & catalog (resources) | `/api/v1/orders`, `/api/v1/catalog` |
| **WebSockets (Socket.io)** | Real-time order status updates + 1-on-1 customer/support chat | Socket.io on the same server |
| **JSON-RPC 2.0** | Action-style operations like cancelling an order | `/rpc` (POST) |
| **Server-Sent Events (SSE)** | One-way live system alert feed | `/events` |

All four protocols read and write the **same in-memory order data**, so an order cancelled through JSON-RPC instantly shows up in a REST `GET`, triggers a WebSocket status update to anyone tracking that order, and fires an SSE alert to every open browser tab.

---

## 🗂️ Project structure

```
order-tracking-system/
├── backend/
│   ├── server.js                  # Wires REST + JSON-RPC + SSE + WebSockets together
│   ├── src/
│   │   ├── data/store.js          # Shared in-memory orders & catalog data
│   │   ├── routes/orders.js       # REST: GET/POST orders, PATCH status
│   │   ├── routes/catalog.js      # REST: GET catalog
│   │   ├── rpc/rpc.js             # JSON-RPC 2.0 endpoint (/rpc)
│   │   ├── sse/events.js          # SSE endpoint (/events) + broadcastAlert()
│   │   ├── websocket/socket.js    # Socket.io: tracking rooms + support chat
│   │   └── middleware/errorHandler.js
│   └── package.json
├── frontend/
│   └── index.html                 # Single-page demo UI for all 4 protocols
└── README.md
```

---

## 🛠️ Local setup & running

**Requirements:** Node.js v18+ and npm.

### 1. Backend

```bash
cd backend
npm install
npm start
```

You should see:
```
🚀 Server running at http://localhost:4000
   REST orders:   http://localhost:4000/api/v1/orders
   REST catalog:  http://localhost:4000/api/v1/catalog
   JSON-RPC:      http://localhost:4000/rpc (POST)
   SSE alerts:    http://localhost:4000/events
   WebSocket:     ws://localhost:4000 (Socket.io)
```

### 2. Frontend

The frontend is a single static HTML file — no build step needed.

- **Easiest:** just open `frontend/index.html` directly in your browser.
- **Or** serve it locally: `npx serve frontend` (or any static file server).

At the top of the page there's a **Backend URL** box — it defaults to `http://localhost:4000`. If your backend runs elsewhere (e.g. after deployment), change this box and click **Connect**.

---

## 1️⃣ REST API — Orders & Catalog

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/orders` | List all orders |
| GET | `/api/v1/orders/:id` | Get one order |
| POST | `/api/v1/orders` | Create a new order |
| PATCH | `/api/v1/orders/:id/status` | Update an order's status |
| GET | `/api/v1/catalog` | List products |

All responses use the same envelope: `{ success, data }` or `{ success: false, error: { code, message, details } }`.

```bash
curl http://localhost:4000/api/v1/orders

curl -X POST http://localhost:4000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Ali","total":49.99}'

curl -X PATCH http://localhost:4000/api/v1/orders/order-1001/status \
  -H "Content-Type: application/json" \
  -d '{"status":"OUT_FOR_DELIVERY"}'
```

---

## 2️⃣ WebSockets (Socket.io) — Real-time Tracking & Support Chat

Two features share the same Socket.io connection:

### A. Real-time order status updates
The client joins a room named after the order id. Whenever that order's status changes (via REST `PATCH` or JSON-RPC `cancelOrder`), the server emits the update into that room.

### B. 1-on-1 customer ↔ support chat
Chat rooms are named `chat:<orderId>`, so a customer and a support agent both chatting "about order-1001" land in the same room and see each other's messages, but no one tracking a different order sees them.

### Events reference

**Client → Server**
| Event | Payload | Purpose |
|---|---|---|
| `order:track` | `{ orderId }` | Join an order's status-update room |
| `chat:join` | `{ orderId, role, name }` | Join the support chat room for an order |
| `chat:message` | `{ orderId, sender, text }` | Send a chat message |
| `chat:typing` | `{ orderId, sender }` | (optional) typing indicator |

**Server → Client**
| Event | Payload | Purpose |
|---|---|---|
| `order:statusUpdate` | full order object | An order's status just changed |
| `order:new` | full order object | A brand-new order was placed |
| `chat:message` | `{ sender, text, timestamp }` | A chat message to render |
| `chat:userJoined` | `{ role, name }` | Someone joined the chat room |
| `chat:typing` | `{ sender }` | Someone is typing |

### How to test it (two browser tabs)

1. Open `frontend/index.html` in **two tabs**.
2. In both, enter the same Order ID (e.g. `order-1001`) under "WebSockets".
3. In tab 1, pick role **customer**; in tab 2, pick role **support agent**. Click "Track order + Join chat" in both.
4. Type a message in either tab — it appears live in both.
5. In another tab, `PATCH` that order's status via REST (or cancel it via JSON-RPC) — both tabs update their "Live status" instantly.

---

## 3️⃣ JSON-RPC 2.0 — `/rpc`

A single POST endpoint that dispatches by `method` name, following the [JSON-RPC 2.0 spec](https://www.jsonrpc.org/specification).

**Why JSON-RPC for actions like cancelling an order?** Cancelling isn't really "GET/PUT/DELETE a resource" — it's a command ("do this thing to this order"), which fits an action/method-based protocol more naturally than forcing it into a REST URL.

### Available methods
- `cancelOrder` — params: `{ orderId }`
- `getOrderStatus` — params: `{ orderId }`
- `listMethods` — no params, returns all available method names

### Request/response shape

```bash
curl -X POST http://localhost:4000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"cancelOrder","params":{"orderId":"order-1001"},"id":1}'
```

Success:
```json
{ "jsonrpc": "2.0", "result": { "id": "order-1001", "status": "CANCELLED", ... }, "id": 1 }
```

Error (unknown method, missing params, etc. — using standard JSON-RPC error codes):
```json
{ "jsonrpc": "2.0", "error": { "code": -32602, "message": "Invalid params", "data": "..." }, "id": 1 }
```

---

## 4️⃣ Server-Sent Events — `/events`

A one-way, long-lived HTTP stream. The server pushes an `alert` event whenever something happens system-wide: a new order is placed, a status changes, or an order is cancelled.

```bash
curl -N http://localhost:4000/events
```

```
event: connected
data: {"message":"Connected to live alerts"}

event: alert
data: {"message":"New order placed: order-abc123 by Ali","timestamp":"..."}
```

In the frontend, this feeds the **"Live Alerts"** panel — open the page, then create/cancel/update an order from another tab (or curl) and watch the alert appear instantly without refreshing.

---

## ☁️ Live Deployment

### Backend → Render (or Railway)

1. Push this repo to GitHub (see below).
2. On [render.com](https://render.com), create a **New Web Service**, connect your GitHub repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variable:** `FRONTEND_URL` = your deployed frontend URL (set this *after* deploying the frontend, to lock down CORS — or leave unset to allow all origins during testing)
4. Deploy. Render gives you a URL like `https://your-app.onrender.com`.

*(Railway steps are nearly identical: New Project → Deploy from GitHub repo → set root directory to `backend` → it auto-detects `npm start`.)*

### Frontend → Vercel (or Netlify)

1. On [vercel.com](https://vercel.com), **Import Project** from the same GitHub repo.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Other / static
   - **Build Command:** (leave empty — it's a static HTML file)
   - **Output Directory:** `.`
3. Deploy. Vercel gives you a URL like `https://your-app.vercel.app`.
4. Open the deployed frontend, paste your **Render/Railway backend URL** into the "Backend URL" box at the top, and click **Connect**.

*(Netlify: drag-and-drop the `frontend` folder into Netlify's dashboard, or connect the GitHub repo with the publish directory set to `frontend`.)*

### After both are deployed
Update the backend's `FRONTEND_URL` environment variable to your real Vercel/Netlify URL and redeploy, so CORS is locked to just your frontend instead of `*`.

---

## ✅ Design notes

- **Shared state:** all four protocols operate on the same `src/data/store.js` in-memory data, which is what makes the "cancel via JSON-RPC → see it update live via WebSocket + SSE + REST" flow work.
- **Standardized REST errors:** same `{ success: false, error: { code, message, details } }` shape as Lab 03, via `errorHandler.js`.
- **Standard JSON-RPC error codes** (`-32601` method not found, `-32602` invalid params, etc.) are used rather than inventing custom ones, to stay spec-compliant.
- **SSE heartbeats:** a comment line is sent every 25s to keep the connection alive through proxies/load balancers on Render/Railway.
