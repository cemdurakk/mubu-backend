const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const PiggyBank = require("../models/PiggyBank");
const SubWallet = require("../models/SubWallet");

// ✅ Yeni kumbara oluştur
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { subWalletId, type, name, targetAmount, category, color } = req.body;
    const userId = req.user.id;

    let subWallet;

    if (subWalletId) {
      // Eğer subWalletId gönderildiyse → direkt kullan
      subWallet = await SubWallet.findById(subWalletId);
      if (!subWallet) {
        return res.status(404).json({ success: false, error: "SubWallet bulunamadı" });
      }
    } else if (type) {
      // Eğer type gönderildiyse → önce o kullanıcıya ait SubWallet var mı kontrol et
      subWallet = await SubWallet.findOne({ userId, type });

      // Yoksa yeni SubWallet oluştur
      if (!subWallet) {
        subWallet = new SubWallet({
          userId,
          type,
          participants: [userId],
        });
        await subWallet.save();
      }
    } else {
      return res.status(400).json({ success: false, error: "subWalletId veya type gerekli" });
    }

    // ✅ Yeni kumbara oluştur
    const piggyBank = new PiggyBank({
      subWalletId: subWallet._id,
      name,
      targetAmount,
      category,
      color,
      participants: [userId], // başlangıçta sadece owner
    });

    await piggyBank.save();

    // ✅ SubWallet içine ekle
    subWallet.piggyBanks.push(piggyBank._id);
    await subWallet.save();

    return res.status(201).json({
      success: true,
      message: "Kumbara başarıyla oluşturuldu",
      piggyBank,
      subWallet, // hangi subWallet altında oluşturulduğunu da döndürelim
    });
  } catch (err) {
    console.error("❌ Kumbara oluşturma hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ✅ Kullanıcının tüm kumbaralarını getir
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const subWallets = await SubWallet.find({ participants: userId }).populate("piggyBanks");

    let piggyBanks = [];
    subWallets.forEach(sw => {
      piggyBanks = piggyBanks.concat(sw.piggyBanks);
    });

    piggyBanks.sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({
      success: true,
      piggyBanks,
    });
  } catch (err) {
    console.error("❌ Tüm kumbaraları listeleme hatası:", err);
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
