const mongoose = require("mongoose");
const moment = require("moment-timezone");

const allowanceHistorySchema = new mongoose.Schema(
  {
    // 👶 Harçlığı alan çocuk
    childId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // 👨‍👩‍👧 Harçlığı gönderen ebeveyn
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // 💸 Tutar
    amount: { type: Number, required: true, min: 0 },

    // 🏦 Hangi cüzdandan gönderildi
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet" },

    // 🗓 Gönderim tarihi
    sentAt: {
      type: Date,
      default: () => moment.tz("Europe/Istanbul").toDate(),
    },

    // 📝 Açıklama (opsiyonel)
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AllowanceHistory", allowanceHistorySchema);
