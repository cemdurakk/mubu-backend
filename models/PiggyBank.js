const mongoose = require("mongoose");

const PiggyBankSchema = new mongoose.Schema(
  {
    // Hangi alt cüzdana bağlı
    subWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubWallet",
      required: true,
    },

    // Kumbara adı
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Hedef tutar (kullanıcı belirler)
    targetAmount: {
      type: Number,
      default: 0,
    },

    // Şu anki biriken miktar
    currentAmount: {
      type: Number,
      default: 0,
    },

    // Kategori (seçilebilir, esnek olacak)
    category: {
      type: String,
      default: null,
    },

    // Renk (frontend’den seçilecek)
    color: {
      type: String,
      default: "#7E57C2", // mor default
    },

    // Katılımcılar (özellikle ortak & birikim için)
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Davet edilen kullanıcılar
    invitations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("PiggyBank", PiggyBankSchema);
