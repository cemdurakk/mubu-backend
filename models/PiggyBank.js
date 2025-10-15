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
      required: false,
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

    // Bekleyen davetler (henüz kabul edilmemiş kullanıcılar)
    pendingInvites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Kumbara sahibini belirt
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("PiggyBank", PiggyBankSchema);
