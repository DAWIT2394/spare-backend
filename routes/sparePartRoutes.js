const express = require("express");
const router = express.Router();
const controller = require("../controllers/sparePartController");
const auth = require("../middleware/authMiddleware"); // Must match filename exactly
const role = require("../middleware/roleMiddleware"); // Also check

router.post("/", auth, role("ADMIN"), controller.create);
router.get("/", auth, controller.getAll);
router.put("/:id", auth, role("ADMIN"), controller.update);
router.delete("/:id", auth, role("ADMIN"), controller.remove);

module.exports = router;
