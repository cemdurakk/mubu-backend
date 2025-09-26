const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const SubWallet = require("../models/SubWallet");

// ✅ Yeni SubWallet oluştur
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { type } = req.body; // individual | shared | savings
    const userId = req.user.id;

    // Eğer bu tipte zaten SubWallet varsa tekrar oluşturma
    let existing = await SubWallet.findOne({ userId, type });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "SubWallet zaten mevcut",
        subWallet: existing,
      });
    }

    // Yeni SubWallet oluştur
    const subWallet = new SubWallet({
      userId,
      type,
      participants: [userId], // başlangıçta owner katılımcı
    });

    await subWallet.save();

    return res.status(201).json({
      success: true,
      message: "SubWallet başarıyla oluşturuldu",
      subWallet,
    });
  } catch (err) {
    console.error("❌ SubWallet oluşturma hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ✅ Kullanıcının SubWallet’larını listele
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const subWallets = await SubWallet.find({
      $or: [{ userId }, { participants: userId }],
    }).populate("piggyBanks");

    return res.status(200).json({
      success: true,
      subWallets,
    });
  } catch (err) {
    console.error("❌ SubWallet listeleme hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
