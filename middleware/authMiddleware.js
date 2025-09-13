const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token bulunamadı" });
    }

    // 📌 Token decode
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 📌 Kullanıcı DB'den alınıyor
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Geçersiz kullanıcı" });
    }

    // 📌 Token içindeki deviceId ile DB’deki deviceId karşılaştır
    if (decoded.deviceId !== user.deviceId) {
      return res.status(401).json({ message: "Bu cihaz için token geçersiz" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Auth middleware hatası:", err);
    return res.status(401).json({ message: "Token geçersiz veya süresi dolmuş" });
  }
};
