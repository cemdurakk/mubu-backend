const mongoose = require("mongoose");
const moment = require("moment-timezone");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

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

      // 💍 Eş (spouse) davet sistemi
      "spouse_invite_sent",
      "spouse_invite_accepted",
      "spouse_invite_joined",

      // 💎 Abonelik
      "subscription_purchase",

      "spouse_invite_sent",
      "spouse_invite_accepted",
      "spouse_invite_declined",
      "spouse_linked", // ✅ yeni eklendi

      "allowance_received" // ✅ BURAYI EKLE
    ],
    required: true,
  },



    // 💬 artık opsiyonel olacak, çünkü davetlerde para yok
    amount: { type: Number, default: 0 },

    from: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },

    description: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "success"], // ✅ success eklendi
      default: "completed",
    },

    paymentMethod: { type: String, default: null },
    cardLast4: { type: String, default: null },
    secureVerified: { type: Boolean, default: false },

    createdAt: {
      type: Date,
      default: () => moment().tz("Europe/Istanbul").toDate(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
