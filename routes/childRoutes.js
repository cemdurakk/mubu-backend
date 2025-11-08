// 📂 routes/childRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Notification = require("../models/Notification");

/**
 * 🎯 Çocuğun ebeveynine harçlık isteği göndermesi
 * POST /api/child/request-allowance
 */
router.post("/request-allowance", authMiddleware, async (req, res) => {
  try {
    const { amount, note } = req.body;
    const childId = req.user.userId;

    // 1️⃣ Role kontrolü
    if (req.user.role !== "child") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem sadece çocuk kullanıcılar tarafından yapılabilir.",
      });
    }

    // 2️⃣ Tutar kontrolü
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Geçerli bir tutar giriniz.",
      });
    }

    // 3️⃣ Çocuğu bul
    const child = await User.findById(childId);
    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Çocuk hesabı bulunamadı.",
      });
    }

    // 4️⃣ Ebeveyn kontrolü
    if (!child.parentIds || child.parentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Bu çocuk hesabına bağlı ebeveyn bulunamadı.",
      });
    }

    // 5️⃣ Çocuğun ismini ProfileInfo'dan çek
    const ProfileInfo = require("../models/ProfileInfo");
    const profile = await ProfileInfo.findOne({ userId: childId });
    const childName = profile?.name || "Çocuğunuz";

    // 6️⃣ Ebeveyn(ler)e bildirim oluştur
    for (const parentId of child.parentIds) {
      const parentWallet = await Wallet.findOne({ userId: parentId });
      if (!parentWallet) continue;

      await Notification.create({
        userId: parentId,
        type: "allowance_request",
        description: `${childName}, ₺${amount} harçlık talebinde bulundu.${note ? " Not: " + note : ""}`,
        amount,
        relatedUserId: childId,
        to: parentWallet._id,
        status: "pending",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Harçlık isteği ebeveynine gönderildi.",
    });
  } catch (err) {
    console.error("❌ Harçlık isteği hatası:", err);
    return res.status(500).json({
      success: false,
      message: "Harçlık isteği gönderilirken bir hata oluştu.",
      error: err.message,
    });
  }
});

module.exports = router;
