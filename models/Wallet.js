const walletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    balance: { type: Number, default: 0 }, // toplam bakiye

    // ✅ Yeni alan: cüzdan ismi
    name: { type: String, required: true, default: "Cüzdanım" },

    // Bu cüzdana bağlı tüm işlemler
    transactions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }
    ],

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);


module.exports = mongoose.model("Wallet", walletSchema);
