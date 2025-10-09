const express = require("express");
const router = express.Router();
const ProfileInfo = require("../models/ProfileInfo");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../services/cloudinary");
const bcrypt = require("bcryptjs");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // ProfileInfo kaydı yoksa otomatik oluştur
    let profile = await ProfileInfo.findOne({ userId });
    if (!profile) {
      profile = new ProfileInfo({
        userId,
        name: user.name || "",
        email: "",
        dob: "",
        city: "",
        district: "",
        avatar: "",
        tcNo: "", // ✅ yeni alan
      });
      await profile.save();
    }

    res.json({
      success: true,
      profile: {
        name: profile.name || user.name || "",
        email: profile.email || "",
        dob: profile.dob || "",
        phone: user.phone || "",
        city: profile.city || "",
        district: profile.district || "",
        inviteID: user.inviteID || "",
        avatar: profile.avatar || "",
        tcNo: profile.tcNo || "", // ✅ eklendi
      },
    });
  } catch (err) {
    console.error("❌ Profil getirme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// ✅ Profil bilgilerini güncelle
router.put("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, email, dob, city, district, tcNo } = req.body;

    let profile = await ProfileInfo.findOne({ userId });
    if (!profile) {
      profile = new ProfileInfo({ userId });
    }

    profile.name = name || profile.name;
    profile.email = email || profile.email;
    profile.dob = dob || profile.dob;
    profile.city = city || profile.city;
    profile.district = district || profile.district;
    profile.tcNo = tcNo || profile.tcNo;

    await profile.save();

    res.json({ success: true, message: "Profil güncellendi", profile });
  } catch (err) {
    console.error("❌ Profil güncelleme hatası:", err);
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


// routes/profile.js içinde
router.delete("/avatar", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const profile = await ProfileInfo.findOne({ userId });

    if (!profile) return res.status(404).json({ success: false, message: "Profil bulunamadı" });

    // Cloudinary’den silmek istersen:
    // const publicId = extractPublicId(profile.avatar);
    // await cloudinary.uploader.destroy(publicId);

    profile.avatar = "";
    await profile.save();

    res.json({ success: true, message: "Profil fotoğrafı kaldırıldı" });
  } catch (err) {
    console.error("❌ Avatar delete error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// 🔹 Parola değiştirme
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // 🔒 Eski parolayı kontrol et
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Mevcut parola hatalı" });
    }

    // 🔐 Yeni parolayı hashle
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    user.password = hashed;

    await user.save();

    res.json({ success: true, message: "Parola başarıyla güncellendi" });
  } catch (err) {
    console.error("❌ Change password error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



module.exports = router;
