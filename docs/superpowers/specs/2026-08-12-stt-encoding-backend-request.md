# Backend İsteği: Canlı STT'de mobil ses formatını (PCM) destekleme

**Kimden:** Hirevox Mobile (React Native/Expo, aday mülakat uygulaması) ekibi
**Neden:** Mobil, mevcut `/ws/stt` canlı transkripsiyon uç noktasını kullanmak istiyor ama ürettiği ses formatı web'den farklı; küçük, geriye dönük uyumlu bir eklemeye ihtiyaç var.
**Durum:** video-ai ekibine iletildi (2026-08-12), implementasyon o ekipte.

## Bağlam

`server/services/deepgramLive.js`, Deepgram bağlantısını `encoding`/`sample_rate` belirtmeden açıyor:

```js
const connection = deepgram.listen.live({
  model: "nova-2",
  language: "tr",
  smart_format: true,
  interim_results: false,
});
```

Parametre verilmediğinde Deepgram gelen ses formatını **otomatik algılıyor**. Web'in gönderdiği `audio/webm;codecs=opus` (tarayıcı `MediaRecorder`'ından) bu otomatik algılamayla uyumlu çalışıyor.

Mobilde canlı mikrofon akışı için kullanılacak native kütüphaneler (React Native'de WebM/Opus üretebilen pratik bir canlı-akış API'si yok) **ham PCM** (header'sız, container'sız, 16-bit linear PCM) verisi üretiyor. Deepgram bu formatı otomatik algılayamıyor — `encoding`/`sample_rate` açıkça belirtilmezse sessizce boş/hatalı transkript dönebilir. Bu, mülakatın çekirdek işlevini (soru-cevap transkripsiyonu) etkileyeceği için varsayımla geçilecek bir risk değil.

## İstenen değişiklik (küçük, additive, web'i etkilemez)

`server/ws/sttStream.js`, WebSocket URL'inden gelen opsiyonel `encoding` ve `sampleRate` query parametrelerini okusun ve `createLiveTranscription`'a iletsin:

```js
// server/ws/sttStream.js — registerSttStream içinde
const encoding = searchParams.get("encoding") || undefined;
const sampleRate = searchParams.get("sampleRate");

const live = createLiveTranscription({
  encoding,
  sampleRate: sampleRate ? Number(sampleRate) : undefined,
  onError: (err) => console.error("Deepgram live hatasi:", err.message),
});
```

`server/services/deepgramLive.js`, bu parametreleri Deepgram bağlantı seçeneklerine opsiyonel olarak eklesin:

```js
export function createLiveTranscription({ encoding, sampleRate, onError } = {}) {
  const connection = deepgram.listen.live({
    model: "nova-2",
    language: "tr",
    smart_format: true,
    interim_results: false,
    ...(encoding ? { encoding, sample_rate: sampleRate, channels: 1 } : {}),
  });
  // ...geri kalanı değişmeden
}
```

- Parametreler gönderilmezse (web'in bugünkü davranışı): **hiçbir şey değişmez**, Deepgram otomatik algılamaya devam eder.
- Mobil, bağlanırken `wss://.../ws/stt?sessionId=<id>&encoding=linear16&sampleRate=16000` şeklinde bağlanıp bu iki parametreyi eklesin.

## Mobil tarafın varsayımı

Hirevox Mobile implementasyon planı (`docs/superpowers/plans/2026-08-12-mobile-interview-app.md`), bu parametrelerin desteklendiğini varsayarak `sttSocket.ts`'i `encoding=linear16&sampleRate=16000` ile bağlanacak şekilde tasarlar. video-ai ekibi bu değişikliği yapana kadar mobilde canlı STT transkripsiyonu güvenilir çalışmayabilir; bu durumda `sttSocket.ts` zaten tasarımdaki batch fallback'e (`/api/stt`, dosya tabanlı, format bağımsız) düşecek şekilde yazılır, yani özellik tamamen kırılmaz — yalnızca canlı geri bildirim yerine "kaydet-bitince-gönder" davranışına döner.
