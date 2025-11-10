const mongoose = require("mongoose");
const moment = require("moment-timezone");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // 🔹 İşlem türü (ana cüzdan veya kumbara)
    type: {
      type: String,
      enum: [
        "deposit", // ana cüzdana para yükleme
        "withdraw", // ana cüzdandan para çekme
        "transfer", // kullanıcılar arası veya cüzdan arası
        "spend", // harcama işlemi
        "piggybank_create", // yeni kumbara oluşturma
        "piggybank_deposit", // kumbaraya para ekleme
        "piggybank_withdraw", // kumbaradan para çekme
        "piggybank_delete",// kumbara silme
        "piggybank_create_child",
        "allowance_sent"
      ],
      required: true,
    },

    amount: { type: Number, required: true },

    // 🔹 Kaynak ve hedef cüzdanlar
    from: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },

    // 🔹 Kumbara ilişkileri
    piggyBankId: { type: mongoose.Schema.Types.ObjectId, ref: "PiggyBank", default: null },
    piggyBankName: { type: String, default: null },
    subWalletType: {
      type: String,
      enum: ["individual", "shared", "savings", null],
      default: null,
    },

    // 🔹 Ortak kumbaralarda işlemi başlatan kişi
    initiator: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // 🔹 Genel bilgiler
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    // 🔹 Ödeme detayları (sadece deposit/withdraw için)
    paymentMethod: { type: String, default: null },
    cardLast4: { type: String, default: null },
    secureVerified: { type: Boolean, default: false },

    // 🔹 Türkiye saatine göre oluşturulma tarihi
    createdAt: {
      type: Date,
      default: () => moment().tz("Europe/Istanbul").toDate(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
