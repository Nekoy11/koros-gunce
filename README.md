# Koros Günce

Kişisel yaşam ve finans yönetimi için **çevrimdışı** Android uygulaması.
React + TypeScript arayüz, Capacitor 8 ile yerel Android uygulaması, verileri cihazdaki **SQLite** veritabanında saklar.
Sunucu, hesap veya internet gerekmez; uygulamanın internet izni yoktur.

## Modüller

| Modül | Özellikler |
|---|---|
| Ana Sayfa | Bakiye, bugünkü harcama, aylık gelir/gider, hızlı ekleme, ruh hâli, gecikmiş/bugünkü/yaklaşan görevler, son 7 gün grafiği, aylık grafik, bütçe durumu, bugünün günlüğü, son notlar |
| Finans | Başlangıç bakiyesi, gelir/gider ekleme-düzenleme-silme, otomatik bakiye, gün gün gruplanmış geçmiş ve günlük toplamlar, arama, filtre (tarih, tür, kategori, tutar aralığı), sık kullanılan isimlerle hızlı giriş |
| Kategoriler | 10 varsayılan gider + 5 gelir kategorisi, ekleme/düzenleme/silme (silinen kategorinin işlemleri “Diğer”e taşınır) |
| Günlük | Aynı güne birden fazla kayıt, başlık, uzun metin, etiketler, tarih değiştirme, arama, sıralama, otomatik kayıt (Kaydediliyor… / Kaydedildi / Kayıt başarısız), çökme taslağı |
| Takvim | Aylık görünüm; harcama tutarı, günlük, hatırlatma, gelir ve ruh hâli göstergeleri; gün detayı (harcama, gelir, günlük, ruh hâli, hatırlatma, gün toplamı, gün sonu bakiye) |
| İstatistikler | Tarih aralığı (7 gün, bu ay, 3 ay, bu yıl, özel); günlük/haftalık/aylık harcama, kategori dağılımı, gelir-gider karşılaştırması, ruh hâli dağılımı; günlük ortalama, en çok harcanan gün ve kategori, önceki aya göre değişim |
| Bütçe | Aylık toplam ve kategori limitleri, ilerleme çubuğu, eşik uyarısı (%70/80/90), aşım bildirimi |
| Ruh hâli | 5 seviye + kısa not, günde bir kayıt, aylık dağılım |
| Önemli notlar | Başlık, içerik, kategori/etiket, sabitleme, arama, oluşturma/düzenleme tarihi, otomatik kayıt |
| Hatırlatmalar | Başlık, açıklama, tarih, saat, tamamlama; yerel Android bildirimleri; izin açıklaması |
| Arama | Tüm kayıtlarda Türkçe karakter ve büyük/küçük harf duyarsız arama |
| Ayarlar | Koyu/açık tema, para birimi, bildirimler, bütçe eşiği, JSON yedek/geri yükleme, Excel raporu, otomatik güvenlik yedekleri, veritabanı istatistikleri, bütünlük kontrolü, optimizasyon, tüm verileri silme |

## Belgeler

- [BUILD.md](BUILD.md) — kurulum, geliştirme ve APK derleme
- [docs/DATABASE.md](docs/DATABASE.md) — veritabanı şeması ve veri kuralları
- [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) — test sonuçları ve tamamlanmayan işler

## Proje yapısı

```
src/
  db/          SQL sürücüleri (Android SQLite, sql.js), migration sistemi, merkezi erişim katmanı
  data/        Depolar (repository): transactions, categories, diary, notes, reminders, moods, budgets, search, backup, settings
  services/    Bildirimler, dosya paylaşımı, Excel, yedekleme akışları
  state/       Navigasyon, Android geri tuşu, ayarlar, otomatik kayıt, veri değişim olayları
  sheets/      Uygulama genelinde kullanılan ekleme/düzenleme pencereleri
  screens/     Ekranlar
  ui/          Ortak bileşenler, grafikler
tests/         Vitest testleri (gerçek SQLite motoru sql.js ile)
android/       Android Studio projesi
```
