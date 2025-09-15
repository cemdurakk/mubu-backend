// C:\Users\yasar\mubu-backend\middleware\authorizeRoles.js

module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Bu işlemi yapmaya yetkin yok" });
      }
      next();
    } catch (err) {
      console.error("❌ Role kontrol hatası:", err);
      return res.status(403).json({ message: "Yetki reddedildi" });
    }
  };
};
