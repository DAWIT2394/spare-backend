const express = require("express");
const router = express.Router();
const controller = require("../controllers/stockController");
const auth = require("../middleware/authMiddleware");

router.post("/in", auth, controller.stockIn);
router.post("/out", auth, controller.stockOut);

module.exports = router;
