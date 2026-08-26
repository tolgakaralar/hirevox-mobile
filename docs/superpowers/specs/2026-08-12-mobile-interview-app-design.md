# Hirevox Mobile — Aday Mülakat Uygulaması Tasarımı

## Özet

`hirevox-mobile`, mevcut HireVox web platformunun (`/Users/tkaralar/Projects/video-ai`) aday mülakat akışının **React Native (Expo)** ile yazılmış mobil karşılığıdır. Uygulama adaylara yöneliktir; İK/admin tarafı bu projenin kapsamı dışındadır. Mevcut backend'e (Express.js + SQLite, REST API + `/ws/stt` WebSocket) doğrudan bağlanır; tek bir istisna dışında backend'de değişiklik gerekmez (bkz. "Harici Bağımlılık" bölümü).

## Kapsam

- **Kullanıcı:** Aday (candidate) — İK/admin paneli kapsam dışı.
- **Akış:** AI ile sesli mülakat (web'deki zorluk-merdiveni mantığı backend'de zaten var, mobil ona bağlanır).
- **Platform:** iOS + Android, tek kod tabanı (Expo).

## Kararlar Özeti

| Konu | Karar |
|---|---|
| Teknoloji | React Native (Expo) |
| Proctoring/video | Web'deki gibi oturum boyu kamera+ses kaydı, 10sn'lik chunk upload |
| Arka plana düşme | Bütünlük olayı olarak loglanır; video OS kısıtı nedeniyle duraklar, ön plana dönünce devam eder |
| Kod soruları | Sözlü sorulur, aday sözlü açıklar (yazılı kod editörü yok) |
| Giriş | Aday sadece erişim kodunu girer — video-ai'nin 2026-08-18'de kaldırdığı kişiye özel link/token sistemi mobilde de yok, `POST /api/login` artık sadece `{code}` alıyor |
| Bağlantı kesintisi | Kısa toleransla (30-60sn) yerelde buffer'lanır, aşılırsa mülakat sonlandırılır |
| Soru-cevap akışı | Web ile aynı: canlı streaming STT (`/ws/stt` WebSocket, Deepgram relay) |
| Mimari yaklaşım | Native RN/Expo, mevcut API'lere doğrudan bağlanır (backend'e dokunulmaz) |
| Extra (ek soru) adımı | Yok — web tarafında da kaldırılmış, EvaluatingScreen'den doğrudan ResultScreen'e geçilir |

## Mimari

Yeni bir Expo (React Native) uygulaması, `video-ai` backend'inin mevcut REST API'lerine ve `/ws/stt` WebSocket'ine doğrudan bağlanır. Backend'de değişiklik yapılmaz — `/api/interview/answer` uç noktası `type` alanını zaten opsiyonel kabul edip göndermezse "verbal" varsayıyor, dolayısıyla mobilde kod sorularının sözlü cevap olarak kaydedilmesi salt client tarafı bir davranış (backend değişikliği gerektirmiyor). RN tarafında framework olarak Expo Router (dosya tabanlı ekran yönlendirme) kullanılır; state yönetimi web'deki gibi basit tutulur (React Context + useReducer), ekstra bir state kütüphanesi (Redux vb.) gerekmez — akış tek yönlü ve doğrusal (login → consent → prep → intro → questions → evaluating → result).

### Değerlendirilen diğer yaklaşımlar (seçilmedi)

- **Paylaşımlı çekirdek paket:** `video-ai`'daki iş mantığının (API client, state machine, STT wrapper) ortak bir pakete çıkarılıp hem web hem mobil tarafından kullanılması. Uzun vadede daha tutarlı olurdu ama üretimdeki web reposuna dokunmayı ve monorepo/workspace kurulumunu gerektirdiği için bu projenin kapsamını aşıyor (YAGNI). İleride ayrı bir iş olarak değerlendirilebilir.
- **WebView tabanlı hibrit:** Web akışının RN WebView içine gömülmesi. En hızlı teslim olurdu ama WebView içinde sürekli oturum-boyu kamera+ses kaydı platformlar arası güvenilmez ve arka plana düşünce davranışı öngörülemez — proctoring gereksinimini garanti edemediği için elenmiştir.

## Ekranlar ve Bileşenler

**Web ekranları → Mobil ekranları**

- LoginPage → LoginScreen — kullanıcı erişim kodunu girer (kişiye özel link/token sistemi backend'den kaldırıldı, bkz. video-ai `docs/features/2026-08-18-kisiye-ozel-giris-linkini-kaldir.md`)
- ConsentPage → ConsentScreen — KVKK + proctoring (video/ses kaydı) onay metni
- PrepPage → PrepScreen — Kamera/mikrofon izni istenir + önizleme
- IntroPage → IntroScreen — TTS karşılama, 2dk tanıtım kaydı
- QuestionPage → QuestionScreen — Soru sesli sorulur, cevap kaydedilir + canlı STT; kod soruları da bu ekranda sözlü modda sorulur (ayrı editör ekranı yok)
- EvaluatingPage → EvaluatingScreen — Bekleme ekranı
- ResultPage → ResultScreen — Teşekkür ekranı

**Paylaşılan native modüller/hook'lar**

- **SessionRecorder** — Consent onayından itibaren oturum boyu kamera+ses kaydı, 10sn chunk'larla upload; ağ kesintisinde chunk'ları yerelde buffer'lar.
- **QuestionRecorder** — Her soruda cevabı kaydeder, `/ws/stt`'ye canlı akıtır (web'deki `Recorder.jsx` mantığının native karşılığı).
- **useProctor (mobil)** — `AppState` ile arka plan/ön plana geçişi izler, `/api/integrity/event`'e loglar.
- **DeepLinkHandler** — `/` (app root) rotasını `/login`'e yönlendirir; artık bir token taşımıyor, sadece uygulamanın doğrudan mail linkinden ("Unmatched" ekranına düşmeden) açılmasını sağlar.

## Veri Akışı

**Giriş:** Aday mail'deki (artık kişiye özel olmayan, genel) linke tıklar → deep link uygulamayı açar → LoginScreen'de erişim kodu girilir → `POST /api/login {code}` → `sessionId` alınır ve cihazda (SecureStore) tutulur.

**Mülakat ilerleyişi:** Consent onayı (`/api/interview/consent`) ile SessionRecorder başlar (oturum boyu video+ses, 10sn chunk upload). Intro ve her soru için QuestionRecorder cevabı `/ws/stt` üzerinden canlı akıtır, dönen transkript `askedText`/`transcript` ile `/api/interview/answer`'a gönderilir. Sıradaki soru `/api/interview/next` ile (zorluk merdiveni mantığı backend'de) çekilir. Son soru sonrası `/api/interview/finish-questions` çağrılır, SessionRecorder durur ve son chunk'lar flush edilir.

**Bütünlük (integrity):** useProctor arka plan/ön plan geçişlerini `/api/integrity/event`'e loglar; SessionRecorder kaydı ön plana dönüldüğünde kaldığı yerden sürdürür (bkz. Native Modüller bölümü).

**Sonuç:** EvaluatingScreen açılınca `POST /api/evaluate {sessionId}` çağrılır (web'in `EvaluatingPage.jsx`'i ile aynı davranış: idempotent olduğu için `finish-questions`'ın arka planda zaten başlattığı değerlendirmeyle çakışmaz), tamamlanınca doğrudan ResultScreen'e geçilir — web'deki gibi ek soru (extra) adımı yok.

## Harici Bağımlılıklar (video-ai ekibi)

Planlama sırasında bulunan, spec'in "backend'e dokunulmaz" kararına iki izole, additive ve karşı tarafça onaylı istisna:

**1. Video Segment Desteği** (`docs/superpowers/specs/2026-08-12-video-segment-backend-request.md`) — Web'de `MediaRecorder` sekme arka plana alınsa da kesintisiz kaydeder (tek video akışı), bu yüzden mevcut `/api/interview/video-chunk` + `/api/interview/video-finalize` mimarisi (parçaları tek dosyaya `fs.appendFile` ile ekleme) web için doğru çalışır. Mobilde ise OS, uygulama arka plana düştüğünde kamera erişimini zorla kesiyor (bkz. aşağıdaki "Arka plan davranışı" notu) — ön plana dönüşte yeni, bağımsız bir video dosyası (segment) başlamak zorunda. Bu segmentleri mevcut mantıkla art arda eklemek bozuk video üretir. Çözüm: `video-chunk`/`video-finalize`'a opsiyonel `segmentIndex` alanı eklenir (varsayılan `0` — web hiç etkilenmez), segment ≥1 ayrı dosyaya yazılır ve yeni bir `video_segments` tablosunda saklanır.

**2. Canlı STT'de PCM Desteği** (`docs/superpowers/specs/2026-08-12-stt-encoding-backend-request.md`) — `/ws/stt`, Deepgram bağlantısını `encoding`/`sample_rate` belirtmeden açıyor; web'in gönderdiği `audio/webm;codecs=opus` bu otomatik algılamayla uyumlu ama mobilin canlı mikrofon akışı için üreteceği ham PCM değil. Çözüm: WebSocket URL'ine opsiyonel `encoding`/`sampleRate` query parametreleri eklenir (verilmezse web hiç etkilenmez), sunucu bunları Deepgram bağlantı seçeneklerine iletir.

**Mobil taraf her iki sözleşmenin de var olacağını varsayarak inşa edilir.** video-ai ekibi değişiklikleri yapana kadar: video segment desteği olmadan yalnızca kesintisiz mülakatlarda (segment 0) video kaydı sorunsuz çalışır; STT encoding desteği olmadan canlı transkripsiyon güvenilir olmayabilir ama tasarımdaki batch fallback (`/api/stt`, mimetype tabanlı, format bağımsız) devreye girer — özellik tamamen kırılmaz.

## Native Modüller, İzinler ve Dayanıklılık

**İzinler:** Kamera + mikrofon (`expo-camera`, `expo-av`) PrepScreen'de istenir; reddedilirse mülakata başlanamaz. `expo-keep-awake` ile ekran mülakat boyunca kilitlenmez (kilitlenme = arka plana düşme ile aynı şekilde ele alınır).

**Arka plan davranışı — OS kısıtı:** iOS ve Android, uygulama arka plana düştüğünde kamera erişimini işletim sistemi seviyesinde otomatik keser — bu bir tasarım tercihi değil, platform kısıtıdır. "Arka planda kayda devam" fiilen mümkün değildir; bunun yerine SessionRecorder arka plana geçişte videoyu duraklatır, `useProctor` olayı `/api/integrity/event`'e loglar, ön plana dönüldüğünde kayıt kaldığı yerden devam eder.

**Ağ dayanıklılığı:** `NetInfo` ile bağlantı durumu izlenir. Video/ses chunk'ları yüklenemezse yerel dosya sistemine (`expo-file-system`) kuyruklanır ve bağlantı dönünce sırayla yüklenir. Kesinti başladığında bir sayaç başlar (30-60sn tolerans); bağlantı bu süre içinde dönmezse mülakat sonlandırılır ve bütünlük olayı loglanır.

**Deep link:** `expo-linking` + Universal Links (iOS) / App Links (Android) yapılandırması; uygulama yüklü değilse mağaza sayfasına yönlendirme.

## Hata Yönetimi

- **İzin reddi:** Kamera/mikrofon izni verilmezse PrepScreen'de engelleyici bir ekran gösterilir, "Ayarlar'a git" yönlendirmesi sunulur; izin verilmeden mülakata geçilemez.
- **Canlı STT bağlantı hatası:** `/ws/stt` kurulamazsa web'deki gibi batch `/api/stt` fallback'ine düşülür — aynı mantık mobile taşınır.
- **Giriş hatası:** Kod yanlışsa LoginScreen'de açık hata mesajı gösterilir, tekrar denenebilir.
- **Uygulama zorla kapatılırsa (force-quit):** Yeniden açıldığında SecureStore'daki `sessionId` ile `/api/interview/session` sorgulanır, backend'deki mevcut duruma göre doğru ekrana (consent/intro/questions/vb.) yönlendirilir — web'de sayfa yenilemenin karşılığı, ekstra bir "kaldığı yerden devam" mekanizması icat etmeye gerek yok.
- **TTS çalınamazsa:** Web'deki davranışla tutarlı olarak sessiz geçilir; soru metni ekranda her zaman yazılı olarak da gösterilir (failsafe).
- **Backend/sunucu hatası (5xx):** Kullanıcıya genel bir hata ekranı + "tekrar dene" seçeneği; kritik adımlarda (login, answer, finish-questions) otomatik kısa retry.

## Test Stratejisi

- **Birim testleri:** State machine/reducer, API client, WebSocket STT wrapper — native modüller mock'lanarak.
- **Bileşen testleri:** Ekranlar `@testing-library/react-native` ile, backend mock'lanmış (ör. `msw`).
- **Manuel cihaz testi (zorunlu):** Kamera/mikrofon/arka plan/deep-link/network kesintisi gibi davranışlar simülatörde güvenilir test edilemez — her sürüm öncesi gerçek cihazda golden path + kritik edge case'ler (izin reddi, arka plana atma, bağlantı kaybı) elle doğrulanır.
- **E2E (opsiyonel, ileride):** Maestro/Detox ile login→consent→prep→intro→question→result kritik yolunun simülatörde otomatikleştirilmesi; kamera/mikrofon gerçek davranışı yine manuel teste bırakılır.

## Kapsam Dışı

- İK/admin mobil özellikleri (yalnızca aday tarafı).
- Paylaşımlı çekirdek paket / web reposuna dokunma (Approach B).
- WebView tabanlı hibrit yaklaşım (Approach C).
- Push notification (bu tasarımda ele alınmadı, ihtiyaç netleşirse ayrı bir spec'e konu olabilir).
