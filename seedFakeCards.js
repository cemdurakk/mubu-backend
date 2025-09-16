const mongoose = require("mongoose");
const FakeCard = require("./models/FakeCard");
require("dotenv").config();

const seedCards = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Önce eski kartları temizle
    await FakeCard.deleteMany();

    // Sahte kart listesi
    const cards = [
      {
        cardNumber: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "28",
        cvv: "123",
        balance: 5000,
        ownerName: "Ahmet Yılmaz",
      },
      {
        cardNumber: "5500000000000004",
        expiryMonth: "11",
        expiryYear: "27",
        cvv: "456",
        balance: 3000,
        ownerName: "Ayşe Demir",
      },
      {
        cardNumber: "340000000000009",
        expiryMonth: "10",
        expiryYear: "29",
        cvv: "789",
        balance: 10000,
        ownerName: "MUBU Test Kartı",
      },
    ];

    await FakeCard.insertMany(cards);

    console.log("✅ Fake kartlar başarıyla yüklendi!");
    process.exit();
  } catch (err) {
    console.error("❌ Fake kart seedleme hatası:", err);
    process.exit(1);
  }
};

seedCards();
