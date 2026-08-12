# Hirevox Mobile

Adaylar için React Native (Expo) mülakat uygulaması. Mevcut HireVox web platformunun (`/Users/tkaralar/Projects/video-ai`, ayrı ekip) aday mülakat akışının mobil karşılığı — aynı backend'e bağlanır.

- Tasarım: @docs/superpowers/specs/2026-08-12-mobile-interview-app-design.md
- İmplementasyon planı: @docs/superpowers/plans/2026-08-12-mobile-interview-app.md

## Kritik kurallar

- Kod soruları mobilde HER ZAMAN sözlü kabul edilir. `type: "code"` hiçbir zaman backend'e gönderilmez — yazılı kod editörü yoktur.
- `video-ai` reposuna (backend, ayrı ekip) asla doğrudan değişiklik yapılmaz. İstisnalar, o ekibe iletilmiş, geriye dönük uyumlu iki additive istek (henüz uygulanmamışsa mobil taraf batch/segment-0 fallback'ine düşer, çökmez):
  - @docs/superpowers/specs/2026-08-12-video-segment-backend-request.md — `segmentIndex` parametresi
  - @docs/superpowers/specs/2026-08-12-stt-encoding-backend-request.md — `encoding`/`sampleRate` parametreleri
- Video klip süresi üst sınırı 60 saniye (backend'in `video-chunk` uç noktasındaki 20MB/istek limiti nedeniyle).
- Bağlantı kesintisi toleransı: 45 saniye sabit (30-60sn aralığının ortası).
- `CameraView` yalnızca root layout'taki `CameraHost`'ta yaşar — hiçbir ekran kendi kamera örneğini oluşturmaz. Expo Router'ın `<Stack>`'i aktif olmayan ekranları unmount eder; kamera bir route dosyasında olsaydı o rotadan ayrılınca oturum kaydı kesilirdi (plan Task 14'ün self-review notunda bulunan gerçek bir hata).

## Geliştirme

- TDD zorunlu: her görev için önce başarısız test yazılır, sonra implementasyon.
- `EXPO_PUBLIC_API_BASE_URL` ortam değişkeni backend URL'sini taşır; koda gömülmez.
