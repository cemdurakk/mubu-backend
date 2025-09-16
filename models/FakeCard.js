const mongoose = require("mongoose");

const fakeCardSchema = new mongoose.Schema(
  {
    cardNumber: { type: String, required: true, unique: true }, // 16 haneli numara
    expiryMonth: { type: String, required: true }, // MM
    expiryYear: { type: String, required: true },  // YY
    cvv: { type: String, required: true }, // 3 hane
    balance: { type: Number, default: 10000 }, // Sahte kart bakiyesi
    ownerName: { type: String, default: "MUBU Kullanıcısı" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FakeCard", fakeCardSchema);
