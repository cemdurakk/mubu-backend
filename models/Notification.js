// 📂 models/Notification.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const notificationSchema = new mongoose.Schema(
  {
    // 📌 Bildirim hangi kullanıcıya ait
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // 📄 Bildirim tipi
    type: {
      type: String,
      enum: [
        // 💰 Finansal işlemler
        "deposit",
        "withdraw",
        "transfer",
        "spend",

        // 🐷 Kumbaralar
        "piggybank_create",
        "piggybank_invite",
        "piggybank_invite_accepted",

        // 👨‍👩‍👧‍👦 Aile yönetimi
        "child_added",
        "child_verified",
        "child_pin_created",
        "child_profile_completed",
        "child_code_sent",
        "child_account_created",
        "allowance_sent",
        "allowance_received",

        // 💍 Eş (spouse) davet sistemi
        "spouse_invite_sent",
        "spouse_invite_accepted",
        "spouse_invite_declined",
        "spouse_invite_joined",
        "spouse_linked",

        // 💎 Abonelik
        "subscription_purchase",

        // ✅ Görev sistemi
        "task_created",
        "task_assigned",
        "task_completed",
        "allowance_request",
        "piggybank_deposit", // ✅ yeni eklendi
        "piggybank_withdraw",
        "piggybank_create_child",
      ],
      required: true,
    },

    // 💬 Açıklama
    description: { type: String, default: "" },

    // 💸 İlgili tutar (görev ödülü, harçlık, işlem miktarı)
    amount: { type: Number, default: 0 },

    // 🔗 İlişkili varlıklar
    relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },

    // 📊 Durum
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "success"],
      default: "completed",
    },

    // 🧾 Ödeme detayları (yalnızca finansal işlemler için)
    paymentMethod: { type: String, default: null },
    cardLast4: { type: String, default: null },
    secureVerified: { type: Boolean, default: false },

    // 🕓 Tarih
    createdAt: {
      type: Date,
      default: () => moment().tz("Europe/Istanbul").toDate(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
