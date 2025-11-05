const mongoose = require("mongoose");
const moment = require("moment-timezone");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: [
        "deposit",
        "withdraw",
        "transfer",
        "spend",
        "piggybank_create",
        "piggybank_invite",
        "piggybank_invite_accepted",
        "subscription_purchase",
        "child_added", // ✅ yeni eklendi (ebeveyn çocuğu eklediğinde)
        "child_verified",
        "child_pin_created",
        "child_profile_completed" // 📋 profil tamamlandı
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
