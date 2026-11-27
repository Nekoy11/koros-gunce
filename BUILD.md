# Kurulum ve derleme

## Gereksinimler

| Araç | Sürüm | Not |
|---|---|---|
| Node.js | 20+ (24 ile test edildi) | |
| JDK | **21** | Capacitor 8 / Android Gradle Plugin 8.13 için zorunlu. JDK 8 ile derlenmez. |
| Android SDK | Platform **36**, Build-Tools 36, Platform-Tools | Android Studio ile gelir |
| Gradle | 8.14.3 | Proje içindeki `gradlew` otomatik indirir |

> **Bu bilgisayardaki durum (6 Kasım 2026):** Node 24 mevcut. Yalnızca **Java 8 JRE** kurulu, **JDK 21 yok**, **Android SDK yok**. Bu yüzden APK henüz derlenmedi.

### Eksik araçların kurulumu (Windows)

En kolay yol: **Android Studio** kurun (JDK 21 ve Android SDK birlikte gelir).

```bash
winget install Google.AndroidStudio
```

Android Studio'yu bir kez açıp SDK kurulum sihirbazını tamamlayın (SDK Platform 36 seçili olsun).
Ardından ortam değişkenlerini ayarlayın (yeni terminalde geçerli olur):

```bash
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
```

```bash
setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
```

Alternatif (Android Studio olmadan): `winget install Microsoft.OpenJDK.21` + Android “command line tools” ile `sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools"`.

## Geliştirme

```bash
npm install
```

```bash
npm test
```

```bash
npm run dev
```

`npm run dev` tarayıcıda bir **geliştirme önizlemesi** açar (veriler tarayıcıda sql.js + IndexedDB ile tutulur). Nihai ürün Android uygulamasıdır; Android'de veriler yerel SQLite dosyasında saklanır.

## APK derleme

```bash
npm run build
```

```bash
npx cap sync android
```

Debug APK:

```bash
cd android && gradlew.bat assembleDebug
```

Çıktı: `android/app/build/outputs/apk/debug/app-debug.apk`

Release APK:

```bash
cd android && gradlew.bat assembleRelease
```

Çıktı: `android/app/build/outputs/apk/release/app-release.apk`

Ya da Android Studio ile: `npx cap open android` → *Build → Build Bundle(s) / APK(s) → Build APK(s)*.

### Release imzalama

`android/keystore.properties` yoksa release APK yerel **debug anahtarıyla** imzalanır (kendi telefonunuza kurmak için yeterli, Play Store için değil). Kalıcı bir imza anahtarı için:

```bash
keytool -genkeypair -v -keystore android/koros-gunce-release.jks -alias korosgunce -keyalg RSA -keysize 2048 -validity 10000
```

Sonra `android/keystore.properties.example` dosyasını `android/keystore.properties` olarak kopyalayıp şifreleri girin. **Bu anahtarı ve şifreyi kaybetmeyin**: güncellemeleri aynı anahtarla imzalamanız gerekir. Her iki dosya da `.gitignore` içindedir.

### Klasör yolu uyarısı

Proje yolu Türkçe karakter içeriyor (`Hüseyin Genç`). Android Gradle Plugin Windows'ta ASCII olmayan yolları reddettiği için `android/gradle.properties` içine `android.overridePathCheck=true` eklendi. Yine de derleme sırasında yol kaynaklı garip hatalar görürseniz projeyi `C:\dev\personal-hub` gibi ASCII bir klasöre kopyalayıp orada derleyin.

## Telefona kurulum

1. APK'yı telefona kopyalayın (USB, Drive vb.).
2. Dosya yöneticisinden açın; “Bilinmeyen kaynaklardan yükleme” iznini o uygulama için verin.
3. İlk açılışta para birimi ve başlangıç bakiyesini girin.
4. İlk hatırlatmada bildirim izni istenir. Tam zamanlı bildirim için *Ayarlar → Uygulamalar → Koros Günce → Alarmlar ve hatırlatıcılar* iznini açabilirsiniz.

USB hata ayıklama açıksa: `adb install -r android/app/build/outputs/apk/release/app-release.apk`

## Android izinleri

| İzin | Neden |
|---|---|
| POST_NOTIFICATIONS | Hatırlatma bildirimleri (Android 13+ kullanıcıdan istenir) |
| SCHEDULE_EXACT_ALARM | Bildirimi zamanında göstermek (Android 12+; kullanıcı kapatabilir) |
| RECEIVE_BOOT_COMPLETED | Telefon yeniden başlayınca bekleyen bildirimleri yeniden kurmak |
| WAKE_LOCK | Bildirim tetiklenirken cihazı kısa süre uyandırmak |
| ~~INTERNET~~ | **Kaldırıldı.** Arayüz APK içinden yerel olarak yüklenir. |

Dosya dışa aktarma Android paylaşım menüsüyle, içe aktarma sistem dosya seçicisiyle yapılır; depolama izni gerekmez.
`allowBackup=false`: veritabanı Google bulut yedeğine gönderilmez (yedeği kullanıcı JSON olarak kendisi alır).
