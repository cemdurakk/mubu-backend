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

    // İşlemin durumu (ileride ödeme altyapısı için lazım olacak)
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
