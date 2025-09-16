const express = require("express");
const router = express.Router();
const ProfileInfo = require("../models/ProfileInfo");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary"); // ✅ eksikti
const cloudinary = require("../services/cloudinary");

// ✅ Kullanıcının profilini getir
router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await ProfileInfo.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profil bulunamadı" });
    }

    res.json({ success: true, profile });
  } catch (err) {
    console.error("❌ Profil getirme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// ✅ Kullanıcının profilini güncelle
router.put("/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, dob, tcNo, email, city, district } = req.body;

    let profile = await ProfileInfo.findOne({ userId });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profil bulunamadı" });
    }

    profile.name = name || profile.name;
    profile.dob = dob || profile.dob;
    profile.tcNo = tcNo || profile.tcNo;
    profile.email = email || profile.email;
    profile.city = city || profile.city;
    profile.district = district || profile.district;

    await profile.save();

    res.json({ success: true, message: "Profil güncellendi", profile });
  } catch (err) {
    console.error("❌ Profil güncelleme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// ✅ Cloudinary storage ayarı
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "mubu/avatars", // Cloudinary içinde klasör
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage: storage });

// ✅ Avatar yükleme
router.post(
  "/:userId/avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!req.file || !req.file.path) {
        return res.status(400).json({ success: false, message: "Dosya yüklenmedi" });
      }

      const profile = await ProfileInfo.findOne({ userId });
      if (!profile) {
        return res.status(404).json({ success: false, message: "Profil bulunamadı" });
      }

      profile.avatar = req.file.path; // ✅ Cloudinary URL
      await profile.save();

      res.json({
        success: true,
        message: "Avatar yüklendi",
        avatarUrl: profile.avatar,
      });
    } catch (err) {
      console.error("❌ Avatar yükleme hatası:", err);
      res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
  }
);

module.exports = router;
