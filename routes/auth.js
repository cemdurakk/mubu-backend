const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ProfileInfo = require("../models/ProfileInfo"); 
const { sendSms } = require("../services/smsService");

const router = express.Router();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 haneli kod
}

// 📌 Register endpoint
router.post("/register", async (req, res) => {
  try {
    const { phone, password } = req.body;

    let user = await User.findOne({ phone });

    if (user) {
      if (!user.verified) {
        return res.status(400).json({
          message: "Bu numara zaten kayıtlı, doğrulama kodunu tekrar göndermek ister misiniz?",
          pending: true,
        });
      }
      return res.status(400).json({ message: "Bu numara zaten kayıtlı" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = generateCode();

    user = new User({
      phone,
      password: hashedPassword,
      verified: false,
      verificationCode: code,
      verificationExpires: Date.now() + 5 * 60 * 1000, // 5 dakika
    });

    await user.save();

    await sendSms(phone, `MUBU doğrulama kodunuz: ${code}`);

    res.json({ message: "Kayıt başarılı, doğrulama kodu gönderildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// 📌 Doğrulama endpoint
router.post("/verify", async (req, res) => {
  try {
    const { phone, code } = req.body;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ message: "Kullanıcı bulunamadı" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Kullanıcı zaten doğrulanmış" });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Kod hatalı" });
    }

    if (user.verificationExpires < Date.now()) {
      return res.status(400).json({ message: "Kodun süresi dolmuş" });
    }

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ message: "Doğrulama başarılı" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// 📌 Kod yeniden gönderme endpoint
router.post("/resend-code", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ message: "Kullanıcı bulunamadı" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Kullanıcı zaten doğrulanmış" });
    }

    const code = generateCode();
    user.verificationCode = code;
    user.verificationExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    await sendSms(phone, `MUBU yeni doğrulama kodunuz: ${code}`);

    res.json({ message: "Yeni doğrulama kodu gönderildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// PIN oluşturma
router.post("/create-pin", async (req, res) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    // bcrypt ile PIN hashle
    const hashedPin = await bcrypt.hash(pin, 10);

    const user = await User.findOneAndUpdate(
      { phone },
      { pin: hashedPin, pinCreated: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    res.json({ success: true, message: "PIN başarıyla oluşturuldu", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📌 Profil tamamlama
router.post("/complete-profile", async (req, res) => {
  try {
    const { phone, name, dob, tcNo, email, city, district } = req.body;

    // Kullanıcıyı bul
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Profil daha önce oluşturulmuş mu kontrol et
    let profile = await ProfileInfo.findOne({ userId: user._id });

    if (profile) {
      // Güncelle
      profile.name = name;
      profile.dob = dob;
      profile.tcNo = tcNo;
      profile.email = email;
      profile.city = city;
      profile.district = district;
      await profile.save();
    } else {
      // Yeni oluştur
      profile = new ProfileInfo({
        userId: user._id,
        name,
        dob,
        tcNo,
        email,
        city,
        district,
      });
      await profile.save();
    }

    // User tablosunu güncelle → profil tamamlandı
    user.profileCompleted = true;
    await user.save();

    res.json({
      success: true,
      message: "Profil bilgileri kaydedildi",
      profile,
    });
  } catch (err) {
    console.error("❌ Profil kaydetme hatası:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
