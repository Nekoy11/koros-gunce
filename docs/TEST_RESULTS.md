# Test sonuçları — 6 Kasım 2026

## Özet

| Kontrol | Sonuç |
|---|---|
| TypeScript tip kontrolü (`tsc -b`, strict) | ✅ Hatasız |
| Otomatik testler (`npm test`, 40 test) | ✅ 40 / 40 geçti |
| Üretim derlemesi (`vite build`) | ✅ Başarılı |
| Android projesi (`cap add/sync android`) | ✅ Oluşturuldu, 7 eklenti bağlandı |
| **APK derlemesi** | ✅ 7 Kasım 2026: `app-release.apk` (12,9 MB, debug anahtarıyla imzalı), JDK 21 + SDK 36. INTERNET izni yok. |
| **Gerçek Android cihaz testi** | ❌ **Henüz yapılmadı**: APK telefona kurulup denenmeli. |

## Otomatik testler (gerçek SQLite motoru ile)

Testler `sql.js` (WebAssembly SQLite) üzerinde, uygulamanın gerçek migration'ları ve depolarıyla çalışır. Android'deki SQLite eklentisi aynı SQL'i çalıştırır, fakat eklentinin kendisi bu testlerde yer almaz.

### İstenen senaryolar

| Senaryo | Test | Sonuç |
|---|---|---|
| 5.000 TL başlangıç bakiyesi | finance › zorunlu senaryo | ✅ 500.000 kuruş |
| 50 TL harcama + 30 TL harcama → 4.920 TL | finance › zorunlu senaryo | ✅ 492.000 kuruş |
| 500 TL gelir → 5.420 TL | finance › zorunlu senaryo | ✅ 542.000 kuruş |
| Eski harcamanın düzenlenmesi (tutar + tarih) | finance › zorunlu senaryo | ✅ bakiye ve gün sonu bakiye güncellendi |
| Harcamanın silinmesi | finance › zorunlu senaryo | ✅ bakiye yeniden hesaplandı |
| Günlük kaydı oluşturma (aynı güne 3 kayıt), otomatik kayıt, tarih değiştirme, silme, arama | records › Günlük | ✅ |
| Uygulama kapatılıp açıldığında kayıtların korunması | records › Kalıcılık | ✅ (veritabanı dosyası yeniden açılarak) |
| JSON yedeği alma ve geri yükleme | backup › JSON | ✅ tüm tablolar birebir |
| Excel dosyasının açılabilir olması | backup › Excel | ✅ dosya yazılıp tekrar okundu; 5 sayfa, doğru tutarlar |

### Ek testler

- Aynı işlem iki kez kaydedilmez (aynı id ile tekrar ekleme yok sayılır).
- 1000 küçük işlemde kuruş hassasiyeti; negatif bakiyeye izin.
- Başlangıç bakiyesi düzenlenince diğer işlemler korunur.
- Günlük özet (Kola 50 + Kahve 30 + Toka 3 = 83 TL), kategori dağılımı, tutar/kategori/metin filtreleri.
- Kategori silinince işlemler “Diğer”e taşınır; “Diğer” silinemez; gider gelir kategorisiyle kaydedilemez.
- Bütçe: %80 uyarısı, aşım, önceki ayın harcamasının sayılmaması.
- Notlar sabitleme; hatırlatmalarda benzersiz bildirim id, sıralama, tamamlama, gecikme hesabı, geçersiz saat reddi.
- Ruh hâli: günde tek kayıt, düzenleme, dağılım, geçersiz değer reddi.
- Türkçe arama: `sut`→`Süt`, `isik`/`ışık`→`IŞIK`, `İSTANBUL`→`İstanbul`, `cicek`→`Çiçek`, `%` gibi özel karakterler güvenli.
- Bozuk yedekler reddedilir (JSON değil, yanlış format, yeni sürüm, ondalıklı tutar, olmayan kategori, geçersiz tarih, tekrarlanan id) ve veritabanı değişmez.
- Geri yükleme ortasında hata → tamamı geri alınır, eski veriler aynen kalır.
- Tutar ayrıştırma: `50`, `50,5`, `1.250,75`, `1250.75`, `5.000`, `3 TL`, `1 000` doğru; `0`, `-5`, `abc`, `10,999`, `1,234,5`, `1e5` reddedilir.
- Tüm verileri silme, şema sürümü, bütünlük kontrolü.

### İkinci inceleme (7 Kasım 2026) — düzeltilen mantık hataları

| Hata | Düzeltme | Test |
|---|---|---|
| İleri tarihli işlem bugünkü bakiyeyi düşürüyordu | Bakiye bugüne kadarki işlemlerle hesaplanır; planlananlar ayrı gösterilir | regressions › ileri tarihli |
| Başlangıç bakiyesi "0,00" kabul edilmiyordu | `parseAmountAllowZero` | regressions › 0,00 |
| Kurulum öncesi alınmış yedek geri yüklenince karşılama ekranı dönüyor, "Başla" geri yüklenen başlangıç bakiyesini eziyordu | Geri yükleme uygulamayı "kurulmuş" işaretler | regressions › yedek |
| Dosya seçici iptal edilince (eski WebView) Ayarlar'daki tüm işlemler kilitleniyordu | Odak dönüşünde zaman aşımı | — (cihazda doğrulanmalı) |
| Aynı ekran türü yeniden açılınca eski ekranın durumu kullanılabiliyordu (yığın anahtarı tür+sıra idi) | Her açılışa benzersiz anahtar | — |
| Android geri tuşu dinleyicisi her gezinmede yeniden kuruluyordu; hızlı basışta çift geri | Tek dinleyici + ref | — (cihazda doğrulanmalı) |
| Uygulama gece yarısını geçince "bugün" eski kalıyordu | Gün değişince / uygulamaya dönünce tüm ekranlar yenilenir | — |
| Günlük listesi 1000, notlar 500 kayıtta sessizce kesiliyordu | "Daha fazla göster" sayfalama | — |
| Yeni telefonda karşılama ekranından yedek yüklenemiyordu | "Yedekten geri yükle" düğmesi | — |
| Dışa aktarılan dosyalar önbellekte birikiyordu | Her dışa aktarımda eski dosyalar silinir | — |

## Arayüz kontrolü (tarayıcı önizlemesi, 375×812 telefon boyutu)

Geliştirme önizlemesinde (sql.js + IndexedDB) elle denendi:
- İlk açılış ekranı → 5.000 başlangıç → Ana Sayfa 5.000,00 ₺.
- Ana Sayfa'dan “Harcama” ile Kola 50 → 4.950,00 ₺; Kahve 30; “Gelir” ile Harçlık 500 → **5.420,00 ₺**.
- Sayfa yenilendikten sonra kayıtlar duruyor; Finans ekranında “Bugün” grubunda 3 işlem ve günlük toplamlar doğru.
- Kola düzenleme penceresi doğru değerlerle açılıyor; silme onay penceresi → bakiye 5.470,00 ₺.
- Günlük editöründe yazarken “Kaydediliyor… → Kaydedildi” göstergesi.
- Takvim gün hücresinde harcama tutarı; İstatistiklerde günlük ortalama (30 ₺ / 6 gün = 5,00 ₺), kategori dağılımı.
- Açık/koyu tema geçişi; konsolda hata yok.

Bu kontroller Android dışı bir tarayıcıda yapıldı; Android geri tuşu, bildirimler, paylaşım menüsü, dosya seçici, klavye davranışı ve güvenli alan boşlukları **telefonda test edilmedi**.

## Tamamlanmayan / doğrulanmayan işler

1. APK derlendi ancak **telefonda denenmedi**.
2. **Gerçek cihaz testi yapılmadı**; özellikle: yerel bildirimlerin zamanlaması (Doze/pil optimizasyonu), yeniden başlatma sonrası bildirimler, paylaşım menüsü ile yedek kaydetme, dosya seçici ile geri yükleme, internet izni kaldırılmış hâlde WebView'in açılması, kenardan kenara ekranda güvenli alan boşlukları.
3. Android 7.0–7.1 (API 24–25) cihazlarda uygulama ikonu Capacitor'un varsayılan PNG ikonudur (Android 8+ için özel uyarlanabilir ikon eklendi).
4. Uygulama kilidi (PIN / parmak izi) yok — bkz. öneriler.
5. Tekrarlayan işlemler (aylık kira, abonelik) ve tekrarlayan hatırlatmalar yok.
6. Para birimi değişimi yalnızca gösterimi değiştirir; çoklu para birimi / kur dönüşümü yok (istenen tek bakiye modeline uygun).
7. `xlsx` (SheetJS 0.18.5, npm sürümü) için `npm audit` yüksek önem uyarısı veriyor; bu açıklar **dosya okuma** ile ilgilidir. Uygulama Excel'i yalnızca **yazar**, hiçbir xlsx dosyası okumaz.
