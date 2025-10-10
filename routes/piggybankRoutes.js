const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const PiggyBank = require("../models/PiggyBank");
const SubWallet = require("../models/SubWallet");


// ✅ Yeni kumbara oluştur (davet destekli)
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { type, name, targetAmount, category, color, invitedUsers = [] } = req.body;
    const userId = req.user.userId;

    if (!type) {
      return res.status(400).json({ success: false, error: "Kumbara türü (type) gerekli" });
    }

    // Kullanıcının subWallet’ını bul/oluştur
    let subWallet = await SubWallet.findOne({ userId, type });
    if (!subWallet) {
      subWallet = new SubWallet({
        userId,
        type,
        participants: [userId],
        piggyBanks: [],
      });
      await subWallet.save();
    }

    // Yeni kumbara oluştur
    const piggyBank = new PiggyBank({
      subWalletId: subWallet._id,
      name,
      targetAmount,
      currentAmount: targetAmount,
      category,
      color,
      participants: [userId],
      pendingInvites: [], // ✅ başlat
    });

    // ✅ Eğer davet listesi geldiyse kullanıcıları pending'e ekle
    if (Array.isArray(invitedUsers) && invitedUsers.length > 0) {
      const User = require("../models/User");
      const validUsers = [];

      for (const inviteID of invitedUsers) {
        const user = await User.findOne({ inviteID });
        if (user && user._id.toString() !== userId) {
          validUsers.push(user._id);
        }
      }

      piggyBank.pendingInvites = validUsers;
    }

    await piggyBank.save();

    // SubWallet’a ekle
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



// ✅ Kullanıcının tüm kumbaralarını getir
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;  // ✅ doğru alan

    // Kullanıcının bulunduğu tüm subWallet’ları getir
    const subWallets = await SubWallet.find({ participants: userId }).populate("piggyBanks");

    // Tüm kumbaraları birleştir
    let piggyBanks = [];
    subWallets.forEach(sw => {
      piggyBanks = piggyBanks.concat(sw.piggyBanks);
    });

    // Kullanılan toplam bakiye (targetAmount’ların toplamı)
    const usedBalance = piggyBanks.reduce((sum, p) => sum + (p.targetAmount || 0), 0);

    // Tarihe göre sırala (son eklenenler önce gelsin)
    piggyBanks.sort((a, b) => b.createdAt - a.createdAt);

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


// 📩 Kullanıcı davet et
router.post("/invite", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId, inviteID } = req.body;
    const inviterId = req.user.userId;

    if (!piggyBankId || !inviteID) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    // Davet edilen kullanıcıyı bul
    const invitedUser = await require("../models/User").findOne({ inviteID });
    if (!invitedUser) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Kendi kendini davet etmeye çalışıyor mu?
    if (invitedUser._id.toString() === inviterId) {
      return res.status(400).json({ success: false, message: "Kendini davet edemezsin" });
    }

    // Kumbara'yı bul
    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    // Zaten katılımcı mı veya davetli mi?
    const alreadyParticipant = piggyBank.participants.includes(invitedUser._id);
    const alreadyInvited = piggyBank.pendingInvites.includes(invitedUser._id);
    if (alreadyParticipant || alreadyInvited) {
      return res.status(400).json({ success: false, message: "Bu kullanıcı zaten eklendi veya davetli" });
    }

    // Davet edilen kullanıcıyı pending listesine ekle
    piggyBank.pendingInvites.push(invitedUser._id);
    await piggyBank.save();

    // Bildirim oluştur (isteğe bağlı Notification modeliyle)
    // await Notification.create({
    //   userId: invitedUser._id,
    //   type: "invite",
    //   message: `Bir kumbara daveti aldın: ${piggyBank.name}`,
    // });

    return res.status(200).json({
      success: true,
      message: `${inviteID} kullanıcı ID'sine sahip kullanıcı davet edildi.`,
    });
  } catch (err) {
    console.error("❌ Davet hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// ✅ Daveti kabul et
router.post("/accept-invite", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId } = req.body;
    const userId = req.user.userId;

    if (!piggyBankId) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    // Kumbara'yı bul
    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    // Kullanıcı gerçekten davetli mi?
    if (!piggyBank.pendingInvites.includes(userId)) {
      return res.status(400).json({ success: false, message: "Bu kumbara için davet bulunamadı" });
    }

    // Pending'den çıkar, participants listesine ekle
    piggyBank.pendingInvites = piggyBank.pendingInvites.filter(
      (id) => id.toString() !== userId
    );
    piggyBank.participants.push(userId);
    await piggyBank.save();

    // Bildirim gönder (isteğe bağlı)
    // await Notification.create({
    //   userId: piggyBank.owner,
    //   type: "inviteAccepted",
    //   message: `Davetin kabul edildi: ${piggyBank.name}`,
    // });

    return res.status(200).json({
      success: true,
      message: "Davet başarıyla kabul edildi",
    });
  } catch (err) {
    console.error("❌ Davet kabul hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// ✅ Kullanıcının bekleyen davetlerini getir
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Kullanıcının davet edildiği tüm kumbaraları bul
    const pendingPiggyBanks = await PiggyBank.find({
      pendingInvites: userId
    })
      .populate("subWalletId", "type")
      .populate("owner", "phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      pendingInvites: pendingPiggyBanks.map(pb => ({
        _id: pb._id,
        name: pb.name,
        type: pb.subWalletId?.type,
        owner: pb.owner,
        createdAt: pb.createdAt,
      })),
    });
  } catch (err) {
    console.error("❌ Bekleyen davetleri getirme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// 🚫 Daveti reddet
router.post("/decline-invite", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId } = req.body;
    const userId = req.user.userId;

    if (!piggyBankId) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    // Kullanıcı gerçekten davetli mi kontrol et
    if (!piggyBank.pendingInvites.includes(userId)) {
      return res.status(400).json({ success: false, message: "Bu kumbara için davet bulunamadı" });
    }

    // Pending listesinden çıkar
    piggyBank.pendingInvites = piggyBank.pendingInvites.filter(
      id => id.toString() !== userId
    );
    await piggyBank.save();

    // (İsteğe bağlı) Bildirim oluşturulabilir

    return res.status(200).json({
      success: true,
      message: "Davet reddedildi",
    });
  } catch (err) {
    console.error("❌ Davet reddetme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// 👥 Kumbara katılımcılarını getir
router.get("/participants/:piggyBankId", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId } = req.params;

    const piggyBank = await PiggyBank.findById(piggyBankId)
      .populate("participants", "phone name inviteID")
      .populate("pendingInvites", "phone name inviteID");

    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    res.status(200).json({
      success: true,
      participants: piggyBank.participants,
      pendingInvites: piggyBank.pendingInvites,
    });
  } catch (err) {
    console.error("❌ Katılımcı listesi hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// 🔍 Kullanıcıyı inviteID ile ara
router.get("/search-user/:inviteID", async (req, res) => {
  try {
    const { inviteID } = req.params;

    const User = require("../models/User");
    const ProfileInfo = require("../models/ProfileInfo");

    // Kullanıcıyı davet koduna göre bul
    const user = await User.findOne({ inviteID });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    // Profil bilgisini al (isim gibi)
    const profile = await ProfileInfo.findOne({ userId: user._id });

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: profile?.name || "İsimsiz Kullanıcı",
        phone: user.phone,
        inviteID: user.inviteID,
      },
    });
  } catch (err) {
    console.error("❌ search-user hatası:", err);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});




module.exports = router;
