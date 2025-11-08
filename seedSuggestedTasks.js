const mongoose = require("mongoose");
const SuggestedTask = require("./models/SuggestedTask");
require("dotenv").config();

const tasks = [
  // 🏠 EV İŞLERİ
  { category: "Ev işleri", title: "Odasını topla", description: "Her sabah odanı düzenle", rewardAmount: 15 },
  { category: "Ev işleri", title: "Masayı kur", description: "Akşam yemeği öncesi masayı hazırla", rewardAmount: 10 },
  { category: "Ev işleri", title: "Bulaşıkları yıka", description: "Yemekten sonra bulaşıkları yıka", rewardAmount: 20 },
  { category: "Ev işleri", title: "Toz al", description: "Salon ve odalardaki tozları al", rewardAmount: 10 },
  { category: "Ev işleri", title: "Yerleri süpür", description: "Elektrik süpürgesiyle evi süpür", rewardAmount: 15 },
  { category: "Ev işleri", title: "Camları sil", description: "Pencereleri temizle", rewardAmount: 25 },
  { category: "Ev işleri", title: "Bitkilere su ver", description: "Evdeki bitkilerin suyunu ver", rewardAmount: 10 },
  { category: "Ev işleri", title: "Çamaşırları katla", description: "Katlanmış çamaşırları dolaba yerleştir", rewardAmount: 15 },
  { category: "Ev işleri", title: "Sofrayı topla", description: "Yemekten sonra sofrayı kaldır", rewardAmount: 10 },
  { category: "Ev işleri", title: "Ayakkabıları düzenle", description: "Antredeki ayakkabıları sırala", rewardAmount: 10 },

  // 📚 ÖDEV
  { category: "Ödev", title: "Matematik ödevi yap", description: "Verilen alıştırmaları tamamla", rewardAmount: 20 },
  { category: "Ödev", title: "Fen bilgisi ödevi", description: "Deney raporunu yaz", rewardAmount: 20 },
  { category: "Ödev", title: "İngilizce kelime çalış", description: "10 yeni kelime ezberle", rewardAmount: 10 },
  { category: "Ödev", title: "Türkçe paragraf çöz", description: "5 paragraf sorusu çöz", rewardAmount: 15 },
  { category: "Ödev", title: "Sosyal bilgiler ödevi", description: "Konu özetini deftere yaz", rewardAmount: 10 },
  { category: "Ödev", title: "Resim ödevi", description: "Yeni bir çizim yap", rewardAmount: 10 },
  { category: "Ödev", title: "Yazı pratiği", description: "1 sayfa düzgün yazı yaz", rewardAmount: 10 },
  { category: "Ödev", title: "Bilgisayar ödevi", description: "Sunum dosyasını hazırla", rewardAmount: 25 },
  { category: "Ödev", title: "Günlük tekrar yap", description: "Ders notlarını 15 dk gözden geçir", rewardAmount: 10 },
  { category: "Ödev", title: "Okuma ödevi", description: "Kitaptan 10 sayfa oku", rewardAmount: 15 },

  // 🌙 UYKU
  { category: "Uyku", title: "Erken uyu", description: "Saat 22:00’den önce yatağa git", rewardAmount: 10 },
  { category: "Uyku", title: "Alarm kur", description: "Sabah için alarm ayarla", rewardAmount: 5 },
  { category: "Uyku", title: "Ekranı kapat", description: "Yatmadan 30 dk önce ekranı bırak", rewardAmount: 10 },
  { category: "Uyku", title: "Odasını havalandır", description: "Yatmadan önce odanı havalandır", rewardAmount: 10 },
  { category: "Uyku", title: "Sabah erken kalk", description: "Alarm çalınca kalk", rewardAmount: 15 },
  { category: "Uyku", title: "Yatak topla", description: "Sabah yatağını düzelt", rewardAmount: 5 },
  { category: "Uyku", title: "Gece lambasını kapat", description: "Uyumadan ışığı kapat", rewardAmount: 5 },
  { category: "Uyku", title: "Rahat pijama giy", description: "Uygun pijama giyip hazırlan", rewardAmount: 5 },
  { category: "Uyku", title: "Diş fırçala", description: "Uyumadan önce dişlerini fırçala", rewardAmount: 10 },
  { category: "Uyku", title: "Uyku günlüğü yaz", description: "Bugünü kısaca deftere yaz", rewardAmount: 15 },

  // 🏃‍♂️ SPOR
  { category: "Spor", title: "Sabah koşusu yap", description: "10 dakika koş", rewardAmount: 20 },
  { category: "Spor", title: "Esneme hareketleri yap", description: "5 dk esneme rutini uygula", rewardAmount: 10 },
  { category: "Spor", title: "Bisiklet sür", description: "30 dk bisiklete bin", rewardAmount: 25 },
  { category: "Spor", title: "Top oyna", description: "Arkadaşlarınla oyun oyna", rewardAmount: 10 },
  { category: "Spor", title: "Merdiven çık", description: "Asansör yerine merdiven kullan", rewardAmount: 5 },
  { category: "Spor", title: "Şınav çek", description: "10 şınav çek", rewardAmount: 10 },
  { category: "Spor", title: "Mekik çek", description: "20 mekik çek", rewardAmount: 10 },
  { category: "Spor", title: "Dans et", description: "Sevdiğin müzikle dans et", rewardAmount: 10 },
  { category: "Spor", title: "Yürüyüş yap", description: "20 dk yürüyüş yap", rewardAmount: 15 },
  { category: "Spor", title: "Su iç", description: "Gün boyunca 6 bardak su iç", rewardAmount: 5 },

  // 📖 DERS
  { category: "Ders", title: "Tarih konusunu tekrar et", description: "Ders kitabındaki konuyu oku", rewardAmount: 15 },
  { category: "Ders", title: "Fen deneyi izle", description: "YouTube’dan deney videosu izle", rewardAmount: 10 },
  { category: "Ders", title: "Defteri düzenle", description: "Notlarını tarih sırasına koy", rewardAmount: 10 },
  { category: "Ders", title: "Soru çöz", description: "10 soru çöz ve kontrol et", rewardAmount: 20 },
  { category: "Ders", title: "Grup çalışması yap", description: "Arkadaşlarınla ders tekrarı yap", rewardAmount: 15 },
  { category: "Ders", title: "Özet çıkar", description: "Konu özetini deftere yaz", rewardAmount: 10 },
  { category: "Ders", title: "Yeni konu dinle", description: "Öğretmen videosunu izle", rewardAmount: 10 },
  { category: "Ders", title: "Konu testi çöz", description: "10 test sorusu çöz", rewardAmount: 15 },
  { category: "Ders", title: "Konu anlat", description: "Ailene konuyu anlat", rewardAmount: 15 },
  { category: "Ders", title: "Okuma yap", description: "Günde 20 sayfa kitap oku", rewardAmount: 20 },

  // 🧼 KİŞİSEL BAKIM
  { category: "Kişisel bakım", title: "Diş fırçala", description: "Sabah ve akşam dişlerini fırçala", rewardAmount: 5 },
  { category: "Kişisel bakım", title: "El yıka", description: "Yemekten önce ellerini yıka", rewardAmount: 5 },
  { category: "Kişisel bakım", title: "Tırnak kes", description: "Tırnaklarını düzenli kes", rewardAmount: 10 },
  { category: "Kişisel bakım", title: "Saç tara", description: "Sabah saçını tara", rewardAmount: 5 },
  { category: "Kişisel bakım", title: "Yüzünü yıka", description: "Sabah yüzünü temizle", rewardAmount: 5 },
  { category: "Kişisel bakım", title: "Parfüm kullan", description: "Dışarı çıkmadan parfüm sık", rewardAmount: 5 },
  { category: "Kişisel bakım", title: "Giyimini düzenle", description: "Kıyafetlerini ütüle ve hazırla", rewardAmount: 10 },
  { category: "Kişisel bakım", title: "Duş al", description: "Günde bir kez duş al", rewardAmount: 15 },
  { category: "Kişisel bakım", title: "Yüz kremi sür", description: "Cildini nemlendir", rewardAmount: 5 },
  { category: "Kişisel bakım", title: "Temiz havlu kullan", description: "Duş sonrası temiz havlu kullan", rewardAmount: 5 },

  // 🐶 HAYVAN BAKIMI
  { category: "Hayvan bakımı", title: "Mama ver", description: "Evcil hayvanına mama koy", rewardAmount: 10 },
  { category: "Hayvan bakımı", title: "Su kabını doldur", description: "Taze su koy", rewardAmount: 5 },
  { category: "Hayvan bakımı", title: "Gezdir", description: "Köpeği dışarı çıkar", rewardAmount: 15 },
  { category: "Hayvan bakımı", title: "Kum kabını temizle", description: "Kedinin kumunu değiştir", rewardAmount: 10 },
  { category: "Hayvan bakımı", title: "Tüy fırçala", description: "Hayvanın tüylerini tara", rewardAmount: 10 },
  { category: "Hayvan bakımı", title: "Oyun oyna", description: "Hayvanla 15 dk vakit geçir", rewardAmount: 10 },
  { category: "Hayvan bakımı", title: "Veteriner randevusu", description: "Günü hatırlat", rewardAmount: 5 },
  { category: "Hayvan bakımı", title: "Mama kabını yıka", description: "Mama kabını temizle", rewardAmount: 5 },
  { category: "Hayvan bakımı", title: "Fotoğraf çek", description: "Hayvanla bir fotoğraf çek", rewardAmount: 5 },
  { category: "Hayvan bakımı", title: "Küçük ödül ver", description: "Sevdiği ödül mamasını ver", rewardAmount: 5 },

  // 👨‍👩‍👧 AİLE ZAMANI
  { category: "Aile zamanı", title: "Aile filmi izle", description: "Birlikte film izleyin", rewardAmount: 10 },
  { category: "Aile zamanı", title: "Oyun oynayın", description: "Ailece masa oyunu oynayın", rewardAmount: 10 },
  { category: "Aile zamanı", title: "Sohbet et", description: "Aileyle 15 dk sohbet et", rewardAmount: 5 },
  { category: "Aile zamanı", title: "Fotoğraf albümü yap", description: "Eski fotoğrafları düzenle", rewardAmount: 15 },
  { category: "Aile zamanı", title: "Birlikte yemek yap", description: "Ailece yemek hazırlayın", rewardAmount: 20 },
  { category: "Aile zamanı", title: "Parka gidin", description: "Ailece yürüyüş yapın", rewardAmount: 15 },
  { category: "Aile zamanı", title: "Kardeşine yardım et", description: "Kardeşinin ödevine yardım et", rewardAmount: 10 },
  { category: "Aile zamanı", title: "Evi süsleyin", description: "Birlikte dekorasyon yapın", rewardAmount: 10 },
  { category: "Aile zamanı", title: "Kahvaltı hazırla", description: "Aile için kahvaltı hazırla", rewardAmount: 20 },
  { category: "Aile zamanı", title: "Teşekkür et", description: "Ailene teşekkür et", rewardAmount: 5 },

  // 🙌 YARDIM
  { category: "Yardım", title: "Çöpleri çıkar", description: "Çöp torbasını dışarı bırak", rewardAmount: 10 },
  { category: "Yardım", title: "Su getir", description: "Birine su getir", rewardAmount: 5 },
  { category: "Yardım", title: "Alışverişe yardım et", description: "Poşetleri taşı", rewardAmount: 10 },
  { category: "Yardım", title: "Büyükanneni ara", description: "Hâl hatır sor", rewardAmount: 5 },
  { category: "Yardım", title: "Yemek servisi yap", description: "Aileye servis yap", rewardAmount: 10 },
  { category: "Yardım", title: "Evcil hayvana yardım et", description: "Mama taşı", rewardAmount: 5 },
  { category: "Yardım", title: "Kardeşinin çantasını hazırla", description: "Okul çantasına yardım et", rewardAmount: 10 },
  { category: "Yardım", title: "Çiçek sula", description: "Bahçedeki çiçekleri sula", rewardAmount: 10 },
  { category: "Yardım", title: "Komşuya yardım et", description: "Kapı önünü temizle", rewardAmount: 10 },
  { category: "Yardım", title: "Masanın tozunu al", description: "Yemek masasını sil", rewardAmount: 5 },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await SuggestedTask.deleteMany();
    await SuggestedTask.insertMany(tasks);
    console.log(`✅ ${tasks.length} adet önerilen görev başarıyla eklendi.`);
    process.exit();
  } catch (err) {
    console.error("❌ Seed hatası:", err);
    process.exit(1);
  }
};

seed();
