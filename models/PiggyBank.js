const mongoose = require("mongoose");

const piggyBankSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Kumbara sahibini tutar
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true }, // Hangi cüzdana bağlı

    name: { type: String, required: true }, // Kumbara adı (ör: Kahve, Alışveriş)
    type: { 
      type: String, 
      enum: ["individual", "shared", "goal"], // bireysel, ortak, hedef odaklı
      default: "individual" 
    },

    balance: { type: Number, default: 0 }, // Kumbara içindeki mevcut para
    targetAmount: { type: Number, default: 0 }, // Hedef tutar (goal kumbara için)

    color: { type: String, default: "#7B3EFF" }, // UI için renk kodu
    category: { type: String, default: "general" }, // UI için kategori

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // ortak kumbaralarda diğer kullanıcılar

    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PiggyBank", piggyBankSchema);
