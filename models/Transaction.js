const mongoose = require("mongoose");
const moment = require("moment-timezone");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: ["deposit", "withdraw", "transfer", "spend"],
      required: true,
    },

    amount: { type: Number, required: true },

    from: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },

    description: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    paymentMethod: { type: String, default: null },
    cardLast4: { type: String, default: null },
    secureVerified: { type: Boolean, default: false },

    // 🔹 Türkiye saatine göre createdAt
    createdAt: {
      type: Date,
      default: () => moment().tz("Europe/Istanbul").toDate(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
