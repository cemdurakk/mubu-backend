const express = require("express");
const router = express.Router();
const ProfileInfo = require("../models/ProfileInfo");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../services/cloudinary");

// ✅ Profil getirme (kullanıcı kendi profiline erişir)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const profile = await ProfileInfo.findOne({ userId });
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    res.json({
      success: true,
      profile: {
        name: profile?.name || user.name,
        email: profile?.email || null,
        dob: profile?.dob || null,
        phone: user.phone,
        city: profile?.city || null,
        district: profile?.district || null,
        school: profile?.school || null,
        avatar: profile?.avatar || null,
        inviteID: user.inviteID,
      },
    });
  } catch (err) {
    console.error("❌ Profil getirme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// ✅ Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "mubu/avatars",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage });

// ✅ Avatar yükleme
router.post("/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file || !req.file.path) {
      return res.status(400).json({ success: false, message: "Dosya yüklenmedi" });
    }

    const profile = await ProfileInfo.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profil bulunamadı" });
    }

    profile.avatar = req.file.path;
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
});

module.exports = router;
