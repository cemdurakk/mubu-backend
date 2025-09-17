const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    // İşlemin sahibi kullanıcı
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // İşlem tipi: para yükleme, para çekme, transfer, harcama
    type: {
      type: String,
      enum: ["deposit", "withdraw", "transfer", "spend"], // yükle, çek, transfer, harcama
      required: true,
    },

    // İşlemdeki tutar
    amount: { type: Number, required: true },

    // Kaynak & hedef cüzdan/kullanıcı (özellikle transfer için)
    from: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },

    // Açıklama (ör: “Market harcaması”, “Cem’den Muzo’ya transfer”)
    description: { type: String, default: "" },

    // İşlemin durumu
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    // 🔹 Ödeme bilgileri (opsiyonel, gerçek ödeme entegrasyonu için)
    paymentMethod: { type: String, default: null }, // "fake-card", "wallet", "stripe", vs.
    cardLast4: { type: String, default: null },     // son 4 hane
    secureVerified: { type: Boolean, default: false }, // 3D Secure geçti mi?

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
