const express = require("express");
const router = express.Router();
const store = require("../data/store");

// GET /api/v1/catalog — list all products
router.get("/", (req, res) => {
  res.status(200).json({ success: true, count: store.getCatalog().length, data: store.getCatalog() });
});

module.exports = router;
