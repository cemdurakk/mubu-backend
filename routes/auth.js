const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ProfileInfo = require("../models/ProfileInfo"); 
const { sendSms } = require("../services/smsService");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 haneli kod
}

function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      phone: user.phone,
      role: user.role,       // ✅ rol bilgisi token’a eklendi
      deviceId: user.deviceId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}


// 📌 Register endpoint (güncellenmiş)
router.post("/register", async (req, res) => {
  try {
    const { phone, password, fullName } = req.body;  // fullName eklendi ✅

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

    // 📌 Aynı anda ProfileInfo dokümanı oluştur
    const profile = new ProfileInfo({
      userId: user._id,
      name: fullName || "", // register'dan gelen ad-soyad
    });
    await profile.save();

    // SMS gönder
    await sendSms(phone, `MUBU doğrulama kodunuz: ${code}`);

    res.json({ message: "Kayıt başarılı, doğrulama kodu gönderildi", userId: user._id });
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

router.post("/complete-profile", async (req, res) => {
  try {
    const { phone, dob, tcNo, email, city, district, securityQuestion, securityAnswer } = req.body;

    // Kullanıcıyı bul
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Profil daha önce oluşturulmuş mu kontrol et
    let profile = await ProfileInfo.findOne({ userId: user._id });

    if (profile) {
      profile.dob = dob;
      profile.tcNo = tcNo;
      profile.email = email;
      profile.city = city;
      profile.district = district;
      await profile.save();
    } else {
      profile = new ProfileInfo({
        userId: user._id,
        dob,
        tcNo,
        email,
        city,
        district,
      });
      await profile.save();
    }

    // Güvenlik sorusu & cevap kaydet (bcrypt ile hashle)
    if (securityQuestion && securityAnswer) {
      user.securityQuestion = securityQuestion;
      user.securityAnswer = await bcrypt.hash(securityAnswer, 10);
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



// 📌 Login (şifre ile giriş)
router.post("/login", async (req, res) => {
  try {
    const { phone, password, deviceId } = req.body;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ status: "error", message: "Kullanıcı bulunamadı" });
    }

    // ✅ Önce şifreyi kontrol et
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "Şifre hatalı" });
    }

    // ✅ Cihaz kontrolü
    if (user.deviceId && user.deviceId !== deviceId) {
      return res.json({
        status: "deviceVerification",
        message: "Farklı cihazdan giriş yapılıyor. Doğrulama gerekli."
      });
    }

    // ✅ Eğer verified değilse → verify ekranı
    if (!user.verified) {
      return res.json({ status: "verify", message: "Doğrulama kodu gerekli" });
    }

    // ✅ Eğer PIN oluşturulmadıysa → createPin ekranı
    if (!user.pinCreated) {
      return res.json({ status: "createPin", message: "PIN oluşturmanız gerekiyor" });
    }

    // ✅ Eğer profil tamamlanmadıysa → profileInfo ekranı
    if (!user.profileCompleted) {
      return res.json({ status: "profileInfo", message: "Profil bilgilerini doldurmanız gerekiyor" });
    }

    // ✅ İlk login tamamlandıysa → PIN login
    if (user.firstLoginCompleted) {
      return res.json({ status: "loginPin", message: "PIN ile giriş yapmalısınız" });
    }

    // ✅ İlk login değilse → direkt home
    user.firstLoginCompleted = true;
    user.deviceId = deviceId; // 📌 cihaz kaydedilir
    await user.save();

    const token = generateToken(user);

    return res.json({
      status: "home",
      message: "Giriş başarılı",
      token,
      user: { phone: user.phone },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Sunucu hatası" });
  }
});



// 📌 Login (PIN ile giriş)
router.post("/login-pin", async (req, res) => {
  try {
    const { phone, pin } = req.body;
    const user = await User.findOne({ phone });

    if (!user || !user.pin) {
      return res.status(400).json({ status: "error", message: "Kullanıcı veya PIN bulunamadı" });
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "PIN hatalı" });
    }

    const token = generateToken(user);

    return res.json({
      status: "home",
      message: "PIN ile giriş başarılı",
      token,
      user: { phone: user.phone },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Sunucu hatası" });
  }
});

// 📌 Cihaz doğrulama endpoint
router.post("/verify-device", async (req, res) => {
  try {
    const { phone, deviceId, tcNo, dob, securityQuestion, securityAnswer } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Profil bilgilerini kontrol et
    const profile = await ProfileInfo.findOne({ userId: user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profil bulunamadı" });
    }

    if (profile.tcNo !== tcNo) {
      return res.status(400).json({ success: false, message: "TC Kimlik No hatalı" });
    }

    if (profile.dob !== dob) {
      return res.status(400).json({ success: false, message: "Doğum tarihi hatalı" });
    }

    // Güvenlik sorusu & cevabı kontrol
    if (user.securityQuestion !== securityQuestion) {
      return res.status(400).json({ success: false, message: "Güvenlik sorusu hatalı" });
    }

    const isAnswerMatch = await bcrypt.compare(securityAnswer, user.securityAnswer || "");
    if (!isAnswerMatch) {
      return res.status(400).json({ success: false, message: "Güvenlik cevabı hatalı" });
    }

    // ✅ Doğruysa cihaz kaydet
    user.deviceId = deviceId;
    await user.save();

    const token = generateToken(user);

    return res.json({
      success: true,
      message: "Cihaz doğrulama başarılı, cihaz değiştirildi.",
      token,
      user: {
        phone: user.phone,
        verified: user.verified,
        pinCreated: user.pinCreated,
        profileCompleted: user.profileCompleted,
        firstLoginCompleted: user.firstLoginCompleted,
      },
    });
  } catch (err) {
    console.error("❌ Cihaz doğrulama hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// 📌 Token doğrulama
router.get("/me", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

  res.json({
    success: true,
    user: {
      phone: user.phone,
      verified: user.verified,
      pinCreated: user.pinCreated,
      profileCompleted: user.profileCompleted,
      firstLoginCompleted: user.firstLoginCompleted,
      role: user.role, // ✅ eklendi
    },
  });
});





module.exports = router;
