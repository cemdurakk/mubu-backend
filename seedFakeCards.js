// C:\Users\yasar\mubu-backend\seedFakeCards.js

const mongoose = require("mongoose");
const FakeCard = require("./models/FakeCard");
require("dotenv").config();

const seedCards = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await FakeCard.deleteMany();

    const cards = [
      {
        cardNumber: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "28",
        cvv: "123",
        balance: 5000,
        ownerName: "Cem Durak",
        phoneNumber: "+905395274082",
        iban: "TR11000620001000061111111",
      },
      {
        cardNumber: "5500000000000004",
        expiryMonth: "11",
        expiryYear: "27",
        cvv: "456",
        balance: 3000,
        ownerName: "Ayşe Demir",
        phoneNumber: "+905555222222",
        iban: "TR11000620001000062222222",
      },
      {
        cardNumber: "340000000000009",
        expiryMonth: "10",
        expiryYear: "29",
        cvv: "789",
        balance: 10000,
        ownerName: "MUBU Test Kartı",
        phoneNumber: "+905555333333",
        iban: "TR11000620001000063333333",
      },
    ];

    await FakeCard.insertMany(cards);

    console.log("✅ Fake kartlar telefon ve IBAN bilgisiyle yüklendi!");
    process.exit();
  } catch (err) {
    console.error("❌ Fake kart seedleme hatası:", err);
    process.exit(1);
  }
};

seedCards();
