const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ Kullanıcının tüm işlemlerini getir
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, notifications });
  } catch (err) {
    console.error("❌ Notification get error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

module.exports = router;
