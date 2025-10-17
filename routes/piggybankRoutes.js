const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const PiggyBank = require("../models/PiggyBank");
const SubWallet = require("../models/SubWallet");
const mongoose = require("mongoose");

// ✅ Yeni kumbara oluştur (davet destekli)
// ✅ Yeni kumbara oluştur (sadece owner için SubWallet oluşturur)
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { type, name, targetAmount, currentAmount, category, color, invitedUsers = [] } = req.body;
    const userId = req.user.userId;

    if (!type) {
      return res.status(400).json({ success: false, error: "Kumbara türü (type) gerekli" });
    }

    // 🎯 Kullanıcının sadece kendi SubWallet'ını oluştur
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

    // 🎯 Kumbara oluştur
    const piggyBank = new PiggyBank({
      subWalletId: subWallet._id,
      name,
      targetAmount: type === "savings" ? targetAmount || 0 : 0,
      currentAmount: currentAmount || 0,
      category,
      color,
      participants: [userId], // sadece kurucu katılımcı
      pendingInvites: [],
      owner: userId,
    });

    // 🔹 Davetliler varsa pendingInvites’e ekle
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

    // 📨 Davet bildirimi gönder
    if (piggyBank.pendingInvites.length > 0) {
      const Notification = require("../models/Notification");
      const ProfileInfo = require("../models/ProfileInfo");
      const inviterProfile = await ProfileInfo.findOne({ userId });
      const inviterName = inviterProfile?.name || "Bir kullanıcı";

      for (const invitedUserId of piggyBank.pendingInvites) {
        await Notification.create({
          userId: invitedUserId,
          type: "piggybank_invite",
          amount: 0,
          description: `${inviterName} kullanıcısı tarafından "${piggyBank.name}" adlı kumbaraya davet edildiniz.`,
          status: "completed",
        });
      }
    }

    // 🎯 Sadece kurucunun SubWallet'ına ekle
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
    const subWallets = await SubWallet.find({ participants: userId })
      .populate({
        path: "piggyBanks",
        populate: {
          path: "subWalletId",
          select: "type", // sadece type alanını getir
        },
      });


    // Tüm kumbaraları birleştir
    let piggyBanks = [];
    subWallets.forEach(sw => {
      piggyBanks = piggyBanks.concat(sw.piggyBanks);
    });

    // Kullanılan toplam bakiye (targetAmount’ların toplamı)
    const usedBalance = piggyBanks.reduce((sum, p) => sum + (p.currentAmount || 0), 0);

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



// 📩 Kullanıcı davet et
router.post("/invite", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId, inviteID } = req.body;
    const inviterId = req.user.userId;
    
    if (!piggyBankId || !inviteID) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const User = require("../models/User");
    const ProfileInfo = require("../models/ProfileInfo");
    const Notification = require("../models/Notification");

    // Davet edilen kullanıcıyı bul
    const invitedUser = await User.findOne({ inviteID });
    if (!invitedUser) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    if (invitedUser._id.toString() === inviterId) {
      return res.status(400).json({ success: false, message: "Kendini davet edemezsin" });
    }

    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    const alreadyParticipant = piggyBank.participants.includes(invitedUser._id);
    const alreadyInvited = piggyBank.pendingInvites.includes(invitedUser._id);
    if (alreadyParticipant || alreadyInvited) {
      return res.status(400).json({ success: false, message: "Bu kullanıcı zaten eklendi veya davetli" });
    }

    piggyBank.pendingInvites.push(invitedUser._id);
    await piggyBank.save();

    // 📨 Davet eden kullanıcının adını al
    const inviterProfile = await ProfileInfo.findOne({ userId: inviterId });
    const inviterName = inviterProfile?.name || "Bir kullanıcı";

    // 📩 Davet edilen kişiye bildirim oluştur
    try {
      await Notification.create({
        userId: invitedUser._id,
        type: "piggybank_invite",
        amount: 0,
        description: `${inviterName} kullanıcısı tarafından "${piggyBank.name}" adlı kumbaraya davet edildiniz.`,
        status: "completed",
      });
      console.log("✅ Davet bildirimi başarıyla oluşturuldu!");
    } catch (notifyErr) {
      console.error("❌ Notification create error:", notifyErr.message);
    }

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
// ✅ Daveti kabul et (kabul eden için SubWallet ekler)
router.post("/accept-invite", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId } = req.body;
    const userId = req.user.userId;

    if (!piggyBankId) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const PiggyBank = require("../models/PiggyBank");
    const ProfileInfo = require("../models/ProfileInfo");
    const Notification = require("../models/Notification");

    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    // ❌ Kullanıcı davetli değilse reddet
    if (!piggyBank.pendingInvites.includes(userId)) {
      return res.status(400).json({ success: false, message: "Bu kumbara için davet bulunamadı" });
    }

    // ✅ Katılımcı listelerine ekle
    piggyBank.pendingInvites = piggyBank.pendingInvites.filter(id => id.toString() !== userId);
    piggyBank.participants.push(userId);
    await piggyBank.save();

    // ✅ Kullanıcının kendi SubWallet'ını oluştur veya bul
    const ownerSubWallet = await SubWallet.findById(piggyBank.subWalletId);
    const type = ownerSubWallet ? ownerSubWallet.type : "shared";

    let userSubWallet = await SubWallet.findOne({ userId, type });
    if (!userSubWallet) {
      userSubWallet = new SubWallet({
        userId,
        type,
        participants: [userId],
        piggyBanks: [],
      });
      await userSubWallet.save();
    }

    // ✅ Kabul edilen kumbara'yı kullanıcının subWallet'ına da ekle
    if (!userSubWallet.piggyBanks.includes(piggyBank._id)) {
      userSubWallet.piggyBanks.push(piggyBank._id);
      await userSubWallet.save();
    }

    // 📨 Bildirim gönder
    const accepterProfile = await ProfileInfo.findOne({ userId });
    const accepterName = accepterProfile?.name || "Bir kullanıcı";

    await Notification.create({
      userId: piggyBank.owner,
      type: "piggybank_invite_accepted",
      amount: 0,
      description: `"${piggyBank.name}" adlı kumbaraya davet ettiğiniz ${accepterName} kullanıcısı davetinizi kabul etti.`,
      status: "completed",
    });

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
    const mongoose = require("mongoose");
    const userId = new mongoose.Types.ObjectId(req.user.userId); // 🔥 string → ObjectId

    // Kullanıcının davet edildiği tüm kumbaraları bul
    const pendingPiggyBanks = await PiggyBank.find({
      pendingInvites: userId
    })
      .populate("subWalletId", "type")
      .populate("owner", "phone inviteID")
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
        .populate({
          path: "participants",
          select: "phone inviteID profileInfoId",
          populate: {
            path: "profileInfoId",
            select: "name avatar"
          }
        })
        .populate({
          path: "pendingInvites",
          select: "phone inviteID profileInfoId",
          populate: {
            path: "profileInfoId",
            select: "name avatar"
          }
        });

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


// ✅ Kullanıcının daha önce davet ettiği kullanıcıları getir (isim dahil)
router.get("/invited-users", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const User = require("../models/User");
    const ProfileInfo = require("../models/ProfileInfo");

    // Kullanıcının sahip olduğu tüm kumbaraları bul
    const myPiggyBanks = await PiggyBank.find({ owner: userId }).populate(
      "pendingInvites",
      "inviteID phone"
    );

    // Tüm davet edilen kullanıcıları topla (benzersiz)
    const invitedSet = new Set();
    const invitedUsers = [];

    for (const pb of myPiggyBanks) {
      for (const u of pb.pendingInvites) {
        if (!invitedSet.has(u._id.toString())) {
          invitedSet.add(u._id.toString());

          // 🔹 Kullanıcının profil adını çek
          const profile = await ProfileInfo.findOne({ userId: u._id });

          invitedUsers.push({
            _id: u._id,
            inviteID: u.inviteID,
            phone: u.phone,
            name: profile?.name || "İsimsiz Kullanıcı",
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      users: invitedUsers,
    });
  } catch (err) {
    console.error("❌ invited-users hatası:", err);
    return res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});



// 🗑 Davet edilen kullanıcıyı kaldır
router.delete("/delete-invited/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId: invitedUserId } = req.params;
    const ownerId = req.user.userId;

    // Kullanıcının sahip olduğu kumbaraları getir
    const myPiggyBanks = await PiggyBank.find({ owner: ownerId });

    let updatedCount = 0;
    for (const pb of myPiggyBanks) {
      const before = pb.pendingInvites.length;
      pb.pendingInvites = pb.pendingInvites.filter((id) => id.toString() !== invitedUserId);
      if (pb.pendingInvites.length !== before) {
        updatedCount++;
        await pb.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: updatedCount > 0 ? "Davet başarıyla silindi" : "Bu kullanıcı zaten listede değil",
    });
  } catch (err) {
    console.error("❌ delete-invited hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
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


// ✅ Belirli bir kumbara detayını getir
router.get("/detail/:piggyBankId", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId } = req.params;

    // ObjectId kontrolü
    if (!mongoose.Types.ObjectId.isValid(piggyBankId)) {
      return res.status(400).json({ success: false, message: "Geçersiz kumbara ID" });
    }

    const piggyBank = await PiggyBank.findById(piggyBankId)
      .populate("subWalletId", "type")
      .populate({
        path: "participants",
        select: "phone inviteID profileInfoId",
        populate: {
          path: "profileInfoId",
          select: "name avatar",
        },
      })
      .populate({
        path: "owner",
        select: "phone inviteID profileInfoId",
        populate: {
          path: "profileInfoId",
          select: "name avatar",
        },
      });

    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    return res.status(200).json({
      success: true,
      piggybank: piggyBank,
    });
  } catch (err) {
    console.error("❌ Kumbara detay hatası:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



module.exports = router;
