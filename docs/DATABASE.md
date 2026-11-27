# Veritabanı

Android'de `@capacitor-community/sqlite` ile uygulamanın özel klasöründe `personal_hubSQLite.db` dosyası.
Tüm erişim `src/db/database.ts` üzerinden yapılır; ekranlar SQL içermez, `src/data/*` depolarını çağırır.

## Temel kurallar

- **Para:** Tüm tutarlar `INTEGER` **kuruş** olarak saklanır (`50,25 TL` → `5025`). Toplamlar SQLite'ın tam sayı `SUM`'ı ile hesaplanır; kayan nokta kullanılmaz. Ekranda gösterim de tam sayı aritmetiğiyle yapılır.
- **Tarihler:** Takvim tarihleri yerel saatle `YYYY-MM-DD` metin (saat dilimi kayması olmaz). Zaman damgaları (`created_at`, `updated_at`) ISO-8601 UTC.
- **Bakiye:** Saklanmaz, her seferinde hesaplanır: `başlangıç + Σgelir − Σgider`, **bugüne kadar tarihli** işlemlerle. İleri tarihli (planlanan) işlemler mevcut bakiyeyi değiştirmez; Finans ekranında ayrıca gösterilir ve tarihi gelince otomatik dahil olur. Eski bir işlemin düzenlenmesi/silinmesi tüm özetlere anında yansır.
- **Gün sonu bakiye:** `başlangıç + Σ(gelir − gider) [tarih ≤ gün]`.
- **Tekrar kaydı önleme:** Her ekleme penceresi açıldığında bir UUID üretir; `INSERT OR IGNORE` ile aynı işlem (çift dokunma, tekrar deneme) ikinci kez yazılmaz. Aynı gün aynı isimli iki ayrı harcama (iki kahve) ise bilerek serbesttir.
- **İşlemler (transaction):** Her yazma tek bir SQLite işleminde yapılır; hata olursa geri alınır. Yazma ve okumalar bir kuyrukta sıralanır.
- **Arama:** Her kayıtta `search_text` sütunu vardır: Türkçe küçük harfe çevrilmiş ve aksanları sadeleştirilmiş metin (`Süt Işık İstanbul` → `sut isik istanbul`). Arama terimi aynı şekilde normalize edilip `LIKE` ile aranır.
- **Sürüm yönetimi:** `PRAGMA user_version` + `src/db/migrations.ts`. Her migration kendi işleminde atomik çalışır. Yeni sürüm = listeye yeni migration eklemek; yayımlanmış migration değiştirilmez.

## Tablolar (şema v1)

### transactions
| Sütun | Tür | Not |
|---|---|---|
| id | TEXT PK | UUID (başlangıç bakiyesi için `opening`) |
| type | TEXT | `opening` \| `income` \| `expense` |
| amount_kurus | INTEGER | `> 0` (başlangıç için `≥ 0`) |
| title | TEXT NOT NULL | Ürün / gelir adı |
| category_id | INTEGER FK → categories | `ON DELETE RESTRICT`; başlangıçta NULL |
| date | TEXT | YYYY-MM-DD |
| description | TEXT | isteğe bağlı |
| search_text | TEXT | normalize arama metni |
| created_at, updated_at | TEXT | ISO |

İndeksler: `date`, `(type, date)`, `category_id`; kısmi benzersiz indeks `type WHERE type='opening'` → tek başlangıç bakiyesi.

### categories
`id, name, kind (expense|income), color, icon, is_system, sort_order, created_at, updated_at` — `(kind, name NOCASE)` benzersiz. `is_system=1` olan “Diğer” / “Diğer Gelir” silinemez; silinen kategorinin işlemleri bunlara taşınır.

### diary_entries
`id (UUID), date, title, content, tags (JSON dizi), search_text, created_at, updated_at` — indeks: `date`. Aynı tarihte birden fazla kayıt olabilir.

### important_notes
`id, title, content, category, pinned (0/1), search_text, created_at, updated_at` — indeks: `(pinned, updated_at)`.

### reminders
`id, title, description, due_date, due_time (HH:MM | NULL), completed, completed_at, notification_id (benzersiz int), search_text, created_at, updated_at` — indeks: `(completed, due_date, due_time)`. Saat yoksa bildirim 09:00'da.

### mood_entries
`date PK, mood (1–5), note, created_at, updated_at` — günde tek kayıt.

### budget_goals
`id, category_id (NULL = aylık toplam limit) FK ON DELETE CASCADE, amount_kurus, created_at, updated_at` — kategori başına bir limit, tek bir genel limit (kısmi benzersiz indeksler).

### app_settings
`key PK, value (JSON)` — `theme, currency, notificationsEnabled, onboarded, budgetWarnPercent` + iç anahtar `seeded`.

## Yedek dosyası (JSON)

```json
{
  "format": "personal-hub-backup",
  "formatVersion": 1,
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-11-06T19:00:00.000Z",
  "data": {
    "categories": [], "transactions": [], "diary_entries": [], "important_notes": [],
    "reminders": [], "mood_entries": [], "budget_goals": [], "settings": {}
  }
}
```

Geri yükleme akışı (`src/services/backupService.ts`):
1. Dosya JSON olarak ayrıştırılır, ardından **her kayıt alan alan doğrulanır** (tür, tarih biçimi, tam sayı tutar, kategori referansı ve türü, tekrarlanan id, tek başlangıç bakiyesi…). Hata varsa veritabanına hiç dokunulmaz.
2. Kullanıcıya özet gösterilip onay alınır.
3. Mevcut verilerin **otomatik güvenlik yedeği** uygulama klasörüne yazılır (son 5 tanesi saklanır; Ayarlar'dan geri yüklenebilir).
4. Tüm silme + ekleme **tek bir SQLite işleminde** yapılır; herhangi bir hata tümünü geri alır.
5. Bildirimler yeniden kurulur.

## Excel raporu

Sayfalar: **Gelirler, Giderler, Günlük Özet, Kategoriler, Aylık Rapor** (ay sonu bakiyesi dahil). Başlıklar, sütun genişlikleri, para biçimi (`#,##0.00`) ve otomatik filtre ayarlıdır.
