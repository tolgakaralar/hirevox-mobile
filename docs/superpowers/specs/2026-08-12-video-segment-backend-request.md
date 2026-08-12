# Backend İsteği: Mobil için oturum-video segmentlerini destekleme

**Kimden:** Hirevox Mobile (React Native/Expo, aday mülakat uygulaması) ekibi
**Neden:** Mobil, mevcut oturum-video kayıt uç noktalarınızı kullanmak istiyor ama bir platform kısıtı nedeniyle küçük, geriye dönük uyumlu bir eklemeye ihtiyaç var.
**Durum:** video-ai ekibine iletildi (2026-08-12), implementasyon o ekipte.

## Bağlam

Web'de `MediaRecorder`, tarayıcı sekmesi arka plana alınsa bile (blur/visibility_hidden) kesintisiz kayda devam ediyor — bu yüzden bir oturumda hep **tek bir video akışı** oluşuyor ve mevcut `/api/interview/video-chunk` + `/api/interview/video-finalize` mimarisi (parçaları tek bir `.webm` dosyasına sırayla `fs.appendFile` ile ekleme) bunun için doğru çalışıyor.

Mobilde durum farklı: iOS ve Android, uygulama arka plana düştüğünde kamera erişimini **işletim sistemi seviyesinde** otomatik kesiyor (kod/kütüphane kısıtı değil, platform davranışı). Aday arka plana düşüp geri döndüğünde, native kayıt zorunlu olarak YENİ bir dosya olarak yeniden başlıyor — kendi container header'ı olan, bağımsız bir video dosyası. Bu dosyaları mevcut mantıkla art arda ham bayt olarak eklemek (aynı `.webm`'e appendFile) oynatılamaz/bozuk bir sonuç veriyor, çünkü her biri kendi başına tam bir video container'ı.

## İstenen değişiklik (küçük, additive, web'i etkilemez)

1. **`POST /api/interview/video-chunk`** — body'ye opsiyonel `segmentIndex` alanı eklensin (varsayılan `0`).
   - `segmentIndex` `0` veya gönderilmezse: **mevcut davranış birebir korunsun** (`uploads/${sessionId}.webm`'e append — web hiç değişmez).
   - `segmentIndex >= 1` ise: `uploads/${sessionId}-seg${segmentIndex}.webm` dosyasına append edilsin.

2. **`POST /api/interview/video-finalize`** — body'ye opsiyonel `segmentIndex` eklensin (varsayılan `0`).
   - Yeni bir `video_segments` tablosuna `(session_id, segment_index, path, created_at)` satırı eklensin.
   - `segmentIndex=0` için **ayrıca** mevcut `sessions.video_path` da eskisi gibi set edilsin (admin panelinin bugünkü davranışı bozulmasın).

3. **Migration:**
   ```sql
   CREATE TABLE video_segments (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     session_id TEXT NOT NULL,
     segment_index INTEGER NOT NULL,
     path TEXT NOT NULL,
     created_at TEXT DEFAULT (datetime('now'))
   );
   ```

## Neden gerekli

Bu olmadan, mobilde bir mülakat sırasında aday bir kez bile arka plana düşerse (bildirim, kilitlenme vb.) o andan sonraki kayıt ya tamamen kaybolur ya da mevcut dosyanın üzerine yazılıp öncesi kaybolur. Bu değişiklikle hiçbir segment kaybolmadan, ayrı ayrı saklanabilir.

## Kapsam dışı (şimdilik)

Admin panelinde birden fazla segmenti art arda/ayrı oynatma UI'ı bu isteğin kapsamında değil — backend'in segmentleri kaybetmeden saklaması yeterli, oynatma tarafını ayrıca konuşabiliriz.

## Mobil tarafın varsayımı

Hirevox Mobile implementasyon planı (`docs/superpowers/plans/2026-08-12-mobile-interview-app.md`), bu sözleşmenin var olacağını varsayarak `SessionRecorder`'ı `segmentIndex` alanını gönderecek şekilde tasarlar. video-ai ekibi bu değişikliği yapana kadar mobil tarafta segment > 0 durumları (arka plana düşüldükten sonraki kayıtlar) sunucuda kaybolur/hatalı davranabilir — segment 0 (kesintisiz senaryo) mevcut API ile zaten sorunsuz çalışır.
