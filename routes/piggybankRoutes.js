const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const PiggyBank = require("../models/PiggyBank");
const SubWallet = require("../models/SubWallet");

// ✅ Yeni kumbara oluştur
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { subWalletId, name, targetAmount, category, color } = req.body;
    const userId = req.user.id;

    // İlgili SubWallet var mı kontrol et
    const subWallet = await SubWallet.findById(subWalletId);
    if (!subWallet) {
      return res.status(404).json({ success: false, error: "SubWallet bulunamadı" });
    }

    // Kumbara oluştur
    const piggyBank = new PiggyBank({
      subWalletId,
      name,
      targetAmount,
      category,
      color,
      participants: [userId], // başlangıçta sadece owner
    });

    await piggyBank.save();

    // SubWallet içine ekle
    subWallet.piggyBanks.push(piggyBank._id);
    await subWallet.save();

    return res.status(201).json({
      success: true,
      message: "Kumbara başarıyla oluşturuldu",
      piggyBank,
    });
  } catch (err) {
    console.error("❌ Kumbara oluşturma hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ✅ Belirli bir SubWallet’ın kumbaralarını listele
router.get("/:subWalletId", authMiddleware, async (req, res) => {
  try {
    const { subWalletId } = req.params;

    const piggyBanks = await PiggyBank.find({ subWalletId });

    return res.status(200).json({
      success: true,
      piggyBanks,
    });
  } catch (err) {
    console.error("❌ Kumbara listeleme hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
