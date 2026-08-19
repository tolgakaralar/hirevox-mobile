# Handoff: HireVox Mobil — Aday Mülakat Akışı

## Overview
HireVox web platformundaki aday mülakat akışının (login → consent → prep → intro → question → evaluating → result) mobil arayüz tasarımı. Hedef: `tolgakaralar/hirevox-mobile` (React Native / Expo, Expo Router, aday tarafı; İK/admin kapsam dışı — bkz. `docs/superpowers/specs/2026-08-12-mobile-interview-app-design.md`).

Tasarım, kullanıcının paylaştığı web ekran görüntülerinden **birebir** türetildi: aynı renkler, aynı tipografi ölçeği, aynı kart mantığı — yalnızca mobil ölçüye uyarlandı ve mobil-özel iki ek getirildi (kamera PiP kutusu, cihaz seçicilerinin "Ön kamera / Telefon mikrofonu" olarak sadeleşmesi).

## About the Design Files
Bu paketteki dosyalar **HTML ile üretilmiş tasarım referanslarıdır** — hedeflenen görünüm ve davranışı gösteren prototiplerdir, doğrudan kopyalanacak üretim kodu değildir. Görev, bu tasarımları hedef kod tabanının kendi ortamında (React Native / Expo, `StyleSheet`, Expo Router) mevcut desenlerle **yeniden inşa etmektir**. Kod tabanında henüz UI katmanı yok; spec'teki mimari kararlar (Expo Router, React Context + useReducer, ekran isimleri) esas alınmalı.

HTML'deki `div` → `View`, metin düğümleri → `Text`, `input` → `TextInput`, tıklanabilir bloklar → `Pressable`. Kaydırılabilir ekranlar (Consent, Prep) → `ScrollView`. Kamera yer tutucuları → `expo-camera` `CameraView`.

## Fidelity
**High-fidelity.** Renk, tipografi, boşluk ve etkileşimler nihai. Piksel değerleri aşağıda birebir verildi; iOS 402×874pt referans genişliğinde ölçüldü, tüm yatay ölçüler esnek (flex) kabul edilmeli.

## Design Tokens

### Renkler
| Token | Hex | Kullanım |
|---|---|---|
| `bg` | `#F3ECE3` | Ekran arka planı |
| `surface` | `#FAF5EA` | Kart yüzeyi |
| `surfaceAlt` | `#F5EEE1` | Input / seçici dolgusu |
| `quoteBg` | `#F1E8D7` | Soru bloğu dolgusu |
| `border` | `#E5DBCB` | Kutu kenarı |
| `borderInput` | `#E3D8C7` | Input kenarı |
| `textStrong` | `#3D3226` | Soru metni |
| `heading` | `#4A3B2C` | Başlıklar |
| `headingAlt` | `#5A4A38` | Kutu içi başlıklar |
| `body` | `#6E5D4C` | Gövde metni |
| `muted` | `#8A7A69` | İkincil / yardımcı metin |
| `mutedSoft` | `#9A8977` | Dipnot |
| `primary` | `#C97B34` | Ana buton, ilerleme, sayaç |
| `primaryDisabledBg` | `#DED3C2` | Devre dışı buton |
| `primaryDisabledFg` | `#A0907C` | Devre dışı buton metni |
| `danger` | `#B23A2E` | "Cevabı Gönder" / "Konuşmayı Bitir" |
| `recording` | `#C4392C` | Kayıt noktası + "Kayıt yapılıyor..." |
| `errorBg` | `#F7DDD9` | Hata bandı dolgusu |
| `errorFg` | `#9E3226` | Hata bandı metni |
| `badgeBg` | `#1D5A38` | Konu/zorluk rozeti |
| `badgeFg` | `#EAF3EC` | Rozet metni |
| `micLevel` | `#1D9A55` | Mikrofon seviye çubuğu |
| `micTrack` | `#EAE0CF` | Mikrofon çubuğu kanalı |
| `overlay` | `rgba(58,47,36,.82)` | Kamera üzeri uyarı bandı |
| `overlayFg` | `#F3E7D6` | Bant metni |
| `overlayDot` | `#E0A03C` | Bant noktası |
| `checkboxBorder` | `#C6B69F` | İşaretsiz onay kutusu |
| `chevron` | `#A2917E` | Geri oku, seçici oku |
| `logo` | `#0F0F0F` | Logo |

### Tipografi
Aile: iOS `-apple-system / SF Pro`, Android `Roboto` (RN varsayılanı — özel font gerekmez). Monospace yalnızca yer tutucu etiketlerinde (`ui-monospace, Menlo`), üretimde kaldırılabilir.

| Rol | Boyut / Ağırlık / Satır | Ek |
|---|---|---|
| Ekran başlığı (Login "HireVox") | 27 / 700 / 1.15 | letter-spacing −0.4 |
| Ekran başlığı (diğer) | 25 / 700 / 1.2 | letter-spacing −0.4 |
| Question başlığı "Konu 1/1" | 23 / 700 / 1.2 | letter-spacing −0.3 |
| Result başlığı | 26 / 700 / 1.25 | letter-spacing −0.4 |
| Alt başlık | 15.5–17 / 400 / 1.35 | |
| Gövde | 14.5 / 400 / 1.6 | |
| Liste maddesi | 14–14.5 / 400 / 1.45 | |
| Kutu başlığı | 14–14.5 / 700 / 1.4 | |
| Yardımcı / meta | 12.5–13 / 400 / 1.4 | |
| Buton | 16 / 700 | |
| Sayaç (Intro) | 54 / 700 / 1.1 | letter-spacing −1, `primary`, ortalı |
| Sayaç (Question) | 52 / 700 / 1.1 | letter-spacing −1, `primary`, ortalı |
| Rozet | 11.5 / 700 | letter-spacing 0.7, UPPERCASE |
| Kayıt etiketi | 14.5 / 700 | `recording` |
| Logo kelime markası | 15 / 600 / 1.08 (küçük: 13) | letter-spacing −0.2, iki satır |

### Boşluk / Yarıçap / Gölge
- Ekran kenar boşluğu: yatay **14**, üst **52** (Login/Eval/Result: **56**), alt **30–34** (safe-area üstüne).
- Kart: yarıçap **22**, iç boşluk **24–40 / 18–22**, gölge `0 10px 30px rgba(74,59,44,.07)` (RN: `shadowColor:'#4A3B2C', shadowOpacity:0.07, shadowRadius:15, shadowOffset:{0,10}, elevation:3`).
- Kutular (bilgi blokları): yarıçap **12**, iç boşluk **16 / 15**, 1px `border`.
- Buton: yarıçap **10**, dikey iç boşluk **16**, tam genişlik.
- Input: yarıçap **10**, iç boşluk **15 / 14**, 1px `borderInput`, `surfaceAlt` dolgu, letter-spacing 0.5.
- Soru bloğu: yarıçap **8**, sol kenar **4px** `primary`, iç boşluk **16 / 15**.
- Rozet: yarıçap **99**, iç boşluk **8 / 14**.
- Onay kutusu: **20×20**, yarıçap **5**, 1.5px kenar; işaretliyken dolgu `primary`, beyaz ✓ (12 / 700).
- Kamera PiP: genişlik **112**, yarıçap **12**, oran 3:4, altında `surface` şerit (5/7 iç boşluk) + 6px kırmızı nokta + "Kayıt" (10 / 600).
- İlerleme çubuğu: yükseklik **4**, yarıçap 99, tam dolu `primary` (1/1 konu).
- Mikrofon çubuğu: yükseklik **6**, yarıçap 99, kanal `micTrack`, dolgu `micLevel`.

## Screens / Views

### 1. LoginScreen
**Amaç:** Deep link'ten gelen token ile birlikte adayın erişim kodunu girmesi (`POST /api/login {code, token}`).
**Yerleşim:** Ekran üstünde tek kart (dikey akış, kaydırma yok). Kart içi sıra: logo (ortalı, alt boşluk 26) → "HireVox" (27/700) → "Online Mülakat Platformu" (17/400, üst 6) → açıklama (14.5/400, üst 16) → [hata bandı] → input (üst 16) → buton (üst 12).
**Kopya (birebir):**
- "HireVox" · "Online Mülakat Platformu"
- "Hoş geldiniz! Mülakata başlamak için size verilen erişim kodunu girin."
- Placeholder: "Erişim kodunu girin" · Buton: "Mülakata Başla"
- Hata: "Bu kod ile daha önce giriş yapılmış. Tekrar giriş yapılamaz."
**Durumlar:** Kod boş/kısa → buton `primaryDisabledBg`/`primaryDisabledFg`, dokunulamaz. Kod geçerli → `primary`/beyaz. Hata bandı: `errorBg`, yarıçap 10, iç boşluk 13/14, metin 13.5/1.45 `errorFg`; input değişince temizlenir. Gerçek uygulamada hata metni backend yanıtından gelir (geçersiz kod / kullanılmış kod / eksik token).

### 2. ConsentScreen
**Amaç:** KVKK + proctoring onayı (`/api/interview/consent`).
**Yerleşim:** Kart `ScrollView` (flex:1). Sıra: logo → "Mülakat Hakkında" (25/700) → "Başlamadan önce lütfen okuyun" (16/400) → 2 paragraf → "Mülakat akışı:" (14.5/700) + 4 madde → kapanış paragrafı → "Gözetim ve Veri Kullanımı" kutusu (başlık, açıklama, 4 madde, dipnot 13/`mutedSoft`, onay satırı) → buton.
**Kopya:** Ekran görüntülerindeki metin birebir korundu (bkz. prototip dosyası).
**Durumlar:** Onay kutusu işaretsizken "Görüşmeye Gir" devre dışı. Sol üstte 22px "‹" geri oku (`chevron`, top 66 / left 28) → Login.

### 3. PrepScreen
**Amaç:** Kamera/mikrofon izni + önizleme (`expo-camera`, `expo-av`).
**Yerleşim:** Kaydırılabilir kart. Sıra: logo → "Görüşmeye Hazırlık" (25/700) → "Kameranızı ve mikrofonunuzu kontrol edin" (15.5/400) → kamera önizlemesi (oran **3:4**, yarıçap 10, tam genişlik) + alt bant → "Mikrofon seviyesi" (13/`muted`) → seviye çubuğu → "Konuştuğunuzda çubuğun hareket etmesi gerekir." → Kamera seçici → Mikrofon seçici → "Mülakat nasıl işleyecek?" kutusu (4 numaralı madde + "Tahmini toplam süre: yaklaşık 15–20 dakika.") → "Başlamadan önce" kutusu (4 madde) → "Mülakata Başla" butonu (`primary`).
**Mobil uyarlama:** Web'in yatay 16:9 önizlemesi mobilde 3:4 dikey. Cihaz `select`'leri "Ön kamera" / "Telefon mikrofonu" satırlarına indi (dokununca native picker / ActionSheet açılmalı).
**Bant kopyası:** "Şu an kaydedilmiyorsunuz — bu yalnızca bir önizlemedir" (12/400, 7px `overlayDot`).
**Durumlar:** İzin reddi → spec gereği engelleyici ekran + "Ayarlar'a git" (bu pakette çizilmedi; aynı kart/tipografi diliyle üretilmeli). Mikrofon çubuğu gerçek ölçüm değeriyle sürülür (prototipte animasyon yer tutucu).

### 4. IntroScreen
**Amaç:** 2 dakikalık kendini tanıtma kaydı.
**Yerleşim:** Üstte kart: logo → "Kendinizi Tanıtın" (25/700) → sayaç (54/700 `primary`, ortalı, üst 14) → kayıt satırı (9px nokta + "Kayıt yapılıyor...", üst 14) → paragraf → "Konuşmayı Bitir" butonu (`danger`). Kartın altında sağa yaslı kamera PiP (üst 14).
**Kopya:** "Kendinizi tanıtmaya başlayabilirsiniz. Hazır olduğunuzda aşağıdaki butona basın."
**Davranış:** Sayaç 01:40'tan geriye (spec: 2 dk bütçe), saniyede bir. Kayıt noktası 1.4s nefes animasyonu (opacity 1 → .25). Buton → cevabı gönder + sıradaki soruyu çek (`/api/interview/answer`, `/api/interview/next`).

### 5. QuestionScreen
**Amaç:** Soru sesli sorulur, cevap kaydedilir + canlı STT (`/ws/stt`). Kod soruları da bu ekranda sözlü.
**Yerleşim:** Kart: logo → "Konu 1/1" (23/700) → ilerleme çubuğu (üst 10) → meta satırı (üst 9, iki uçta "Geçen süre: 0:22" / "Tahmini kalan: ~3 dk", 12.5/`muted`) → rozetler (ortalı, gap 8, üst 16) → soru bloğu (15/1.5 `textStrong`, sol 4px `primary`) → sayaç (52/700, üst 18) → kayıt satırı → "Cevabı Gönder" (`danger`). Altında sağa yaslı kamera PiP.
**Kopya (örnek veri):** Rozetler "JAVASCRİPT TEMELLERİ" / "KOLAY"; soru "JavaScript'te == ile === arasındaki fark nedir? Neden === kullanmak öneriliyor?" — gerçekte backend'den gelir (`topic`, `difficulty`, `questionText`).
**Davranış:** Geçen süre artar, cevap sayacı geriye sayar. TTS çalınamazsa sessiz geçilir; soru metni her zaman ekranda (failsafe). Canlı transkript alanı bu tasarımda yok — gerekirse soru bloğunun altına aynı `quoteBg` diliyle eklenmeli.

### 6. EvaluatingScreen
**Amaç:** `POST /api/evaluate` sonucunu bekleme. (Web görüntüsü yoktu; spec'e göre türetildi.)
**Yerleşim:** Dikeyde ortalanmış kart: logo → 38px halka spinner (3px `border`, üst kenar `primary`, 1s lineer) → "Cevaplarınız Değerlendiriliyor" (24/700) → "Bu işlem birkaç saniye sürebilir. Lütfen uygulamayı kapatmayın." (14.5/`muted`).
**Davranış:** Tamamlanınca doğrudan ResultScreen (ek soru adımı yok). Prototipte 3.2s sonra otomatik geçiş.

### 7. ResultScreen
**Yerleşim:** Dikeyde ortalanmış kart (iç boşluk 40/22, ortalı): logo → "Mülakat Tamamlandı" (26/700) → "Katılımınız için teşekkür ederiz." (15.5, üst 16) → "Değerlendirme sonuçlarınız ilgili ekibimiz tarafından incelenecektir." (15, üst 18). Prototipteki "Prototipi baştan başlat" bağlantısı **üretimde yok**.

## Interactions & Behavior
- **Navigasyon:** doğrusal, tek yön — login → consent → prep → intro → question(lar) → evaluating → result. Consent ve Prep'te geri oku var; Intro'dan sonra geri yok (kayıt sürüyor).
- **Buton geri bildirimi:** `Pressable` ile basılıyken opacity ~0.85. Devre dışı butonlar dokunulamaz.
- **Animasyonlar:** kayıt noktası nefes 1.4s ease-in-out sonsuz; spinner 1s lineer; mikrofon çubuğu gerçek seviyeye göre (prototipte 2.4s örnek). Ekran geçişleri Expo Router varsayılanı.
- **Sayaçlar:** 1s aralık, `mm:ss` sıfır dolgulu; "Geçen süre" `m:ss`.
- **Doğrulama:** erişim kodu boş değil (prototipte ≥6 karakter); consent onay kutusu zorunlu.
- **Hata durumları:** login hatası bandı; 5xx için genel hata + "tekrar dene"; STT WS kurulamazsa batch `/api/stt` fallback (görsel değişiklik yok); ağ kesintisi 30–60sn toleransı aşarsa mülakat sonlandırılır (uyarı ekranı bu pakette çizilmedi).
- **Responsive:** tüm yatay ölçüler esnek; küçük cihazlarda (≤375pt) sayaç 54→46, başlık 27→24 düşürülebilir. Alt boşluk `useSafeAreaInsets` ile toplanmalı.

## State Management
Spec'teki karar: React Context + useReducer.
- `screen`: 'login' | 'consent' | 'prep' | 'intro' | 'question' | 'evaluating' | 'result' (Expo Router rotalarıyla eşleşir)
- `code`, `loginError`, `token` (deep link), `sessionId` (SecureStore)
- `consentAccepted`
- `permissions`: camera / mic durumu; `devices`: seçili kamera-mikrofon
- `micLevel` (0-1)
- `introRemaining`, `answerRemaining`, `elapsed`
- `question`: { index, total, topic, difficulty, text }, `transcript`
- `recording`: boolean; `uploadQueue` (chunk buffer), `online`
Veri çekme: `/api/login`, `/api/interview/consent`, `/api/interview/next`, `/api/interview/answer`, `/api/interview/finish-questions`, `/api/evaluate`, `/api/integrity/event`, `/ws/stt`.

## Assets
- **Orion Innovation logosu:** bu pakette **yer tutucudur** — daire + eğik çubuk geometrisi ve iki satır kelime markası ile taklit edildi. Üretimde gerçek SVG/PNG varlığı (marka kitinden) kullanılmalı; ölçü: yükseklik 26 (küçük varyant 23), kelime markası 15/600 (13/600).
- **Kamera görüntüsü:** çizgili yer tutucu; `expo-camera` canlı görüntüsüyle değiştirilecek.
- Başka ikon/görsel kullanılmadı; seçici okları ve geri oku metin glifleridir — kod tabanının ikon setiyle değiştirilebilir.

## Files
- `HireVox Mobil.dc.html` — cihaz çerçeveleri içinde 7 ekranın galerisi (referans/sunum katmanı)
- `HireVoxFlow.dc.html` — ekranların tamamı + akış mantığı (**asıl tasarım kaynağı**; renk, ölçü ve kopya buradan okunur)
- `ios-frame.jsx`, `android-frame.jsx` — yalnızca cihaz çerçevesi; üretimde karşılığı yok
- `support.js` — prototip çalışma zamanı; üretimde karşılığı yok

Kaynak spec: `tolgakaralar/hirevox-mobile@development → docs/superpowers/specs/2026-08-12-mobile-interview-app-design.md`
