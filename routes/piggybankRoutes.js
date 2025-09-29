const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const PiggyBank = require("../models/PiggyBank");
const SubWallet = require("../models/SubWallet");


// ✅ Yeni kumbara oluştur
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { type, name, targetAmount, category, color } = req.body;
    const userId = req.user.userId; // ✅ doğru alan bu

    if (!type) {
      return res.status(400).json({ success: false, error: "Kumbara türü (type) gerekli" });
    }

    // 🔹 Kullanıcıya ait ilgili SubWallet var mı kontrol et
    let subWallet = await SubWallet.findOne({ userId, type });

    // 🔹 Yoksa yeni oluştur
    if (!subWallet) {
      subWallet = new SubWallet({
        userId,
        type,
        participants: [userId],
        piggyBanks: [],
      });
      await subWallet.save();
    }

    // 🔹 Yeni kumbara oluştur
    const piggyBank = new PiggyBank({
      subWalletId: subWallet._id,
      name,
      targetAmount,
      category,
      color,
      participants: [userId],
    });
    await piggyBank.save();

    // 🔹 SubWallet içine ekle
    subWallet.piggyBanks.push(piggyBank._id);
    await subWallet.save();

    return res.status(201).json({
      success: true,
      message: "Kumbara başarıyla oluşturuldu",
      piggyBank,
      subWallet,
    });
  } catch (err) {
    console.error("❌ Kumbara oluşturma hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});



// ✅ Kullanıcının tüm kumbaralarını getir
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Kullanıcının bulunduğu tüm subWallet’ları getiriyoruz
    const subWallets = await SubWallet.find({ participants: userId }).populate("piggyBanks");

    let piggyBanks = [];
    subWallets.forEach(sw => {
      piggyBanks = piggyBanks.concat(sw.piggyBanks);
    });

    // Tarihe göre sırala
    piggyBanks.sort((a, b) => b.createdAt - a.createdAt);

    // ✅ Kullanılmış bakiye = currentAmount toplamı
    const usedBalance = piggyBanks.reduce((sum, p) => sum + (p.currentAmount || 0), 0);

    return res.status(200).json({
      success: true,
      piggyBanks,
      usedBalance, // ✅ eklendi
    });
  } catch (err) {
    console.error("❌ Tüm kumbaraları listeleme hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});



// ✅ Belirli bir SubWallet’ın kumbaralarını getir
router.get("/:subWalletId", authMiddleware, async (req, res) => {
  try {
    const { subWalletId } = req.params;

    const piggyBanks = await PiggyBank.find({ subWalletId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      piggyBanks,
    });
  } catch (err) {
    console.error("❌ Belirli subWallet kumbaraları listeleme hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});


module.exports = router;
