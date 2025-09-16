const mongoose = require("mongoose");

const threeDSecureSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true }, // UUID benzeri benzersiz ID
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cardNumber: { type: String, required: true }, // hangi kartla işlem yapılıyor
    amount: { type: Number, required: true }, // yükleme tutarı
    code: { type: String, required: true }, // 6 haneli doğrulama kodu
    status: { type: String, enum: ["pending", "verified", "failed"], default: "pending" },
    expiresAt: { type: Date, required: true }, // süreli oturum
  },
  { timestamps: true }
);

module.exports = mongoose.model("ThreeDSecureSession", threeDSecureSessionSchema);
