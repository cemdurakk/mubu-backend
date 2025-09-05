require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB bağlantısı
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error(err));

// Routes import
const authRoutes = require("./routes/auth");
const smsRoutes = require("./routes/sms");

app.use("/api/auth", authRoutes);
app.use("/api/sms", smsRoutes);

// Test endpoint
app.get("/", (req, res) => {
  res.send("MUBU Backend Çalışıyor 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
