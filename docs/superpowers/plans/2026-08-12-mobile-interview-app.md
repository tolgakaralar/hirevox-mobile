# Hirevox Mobile — Aday Mülakat Uygulaması Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `hirevox-mobile` reposunda, mevcut HireVox web platformunun (`/Users/tkaralar/Projects/video-ai`) aday mülakat akışının React Native (Expo) karşılığını, aynı backend'e bağlanan, tam çalışır bir mobil uygulama olarak inşa etmek.

**Architecture:** Expo Router (dosya tabanlı ekranlar) + React Context/useReducer state yönetimi. Mevcut backend'in REST API'lerine ve `/ws/stt` WebSocket'ine doğrudan bağlanır. Oturum boyu kamera kaydı, sınırlı süreli klipler halinde (segment başına bağımsız dosya) yüklenir; canlı STT için mikrofon PCM olarak akıtılır, bağlantı kurulamazsa dosya tabanlı batch STT'ye düşülür.

**Tech Stack:** Expo SDK (TypeScript, Expo Router), `expo-camera`, `expo-av`, `expo-secure-store`, `expo-file-system`, `expo-keep-awake`, `@react-native-community/netinfo`, `react-native-live-audio-stream`, `base64-js`. Test: `jest-expo`, `@testing-library/react-native`.

## Global Constraints

- Backend URL sabiti: `EXPO_PUBLIC_API_BASE_URL` ortam değişkeninden okunur (ör. `https://interview.hirevox.example`); `.env` dosyasında tutulur, koda gömülmez.
- Backend'de hiçbir değişiklik yapılmaz — istisna: iki additive, video-ai ekibine iletilmiş, henüz uygulanmamış istek: `docs/superpowers/specs/2026-08-12-video-segment-backend-request.md` (`segmentIndex` parametresi) ve `docs/superpowers/specs/2026-08-12-stt-encoding-backend-request.md` (`encoding`/`sampleRate` query parametreleri). Bu plan her iki sözleşmenin de var olacağını varsayarak yazılmıştır; her ikisi de geriye dönük uyumlu (verilmezse davranış web ile aynı) ve olmadan da mobil taraf çökmez (bkz. ilgili görevlerdeki fallback notları).
- Kod soruları mobilde her zaman sözlü kabul edilir; yazılı kod editörü YOKTUR (`type: "code"` hiçbir zaman client'tan gönderilmez).
- ExtraPage/ek-soru akışı YOKTUR — `EvaluatingScreen`'den doğrudan `ResultScreen`'e geçilir.
- Video klip süresi üst sınırı: 60 saniye (backend'in `video-chunk` uç noktasındaki 20MB/istek limitini güvenli marjla aşmamak için); kalite `480p`.
- Bağlantı kesintisi toleransı: 30-60 saniye (bu planda 45 saniye sabit değer kullanılır — aralığın ortası, ayrı bir konfigürasyon ihtiyacı yok).
- Tüm ekran dosyaları `app/` altında Expo Router dosya tabanlı routing kullanır; state Context/useReducer ile tutulur, ekstra state kütüphanesi eklenmez.

---

## Dosya Yapısı

```
app/
  _layout.tsx                     Root layout: Provider'lar (Interview, SessionRecording), oturum devam ettirme yönlendirmesi
  login.tsx                       LoginScreen
  consent.tsx                     ConsentScreen
  prep.tsx                        PrepScreen
  intro.tsx                       IntroScreen
  question.tsx                    QuestionScreen
  evaluating.tsx                  EvaluatingScreen
  result.tsx                      ResultScreen
src/
  api/
    client.ts                     REST çağrıları (web'in client/src/api.js'inin RN karşılığı)
    types.ts                      Paylaşılan TS tipleri (Session, Question, AnswerPayload, ...)
  state/
    interviewReducer.ts           Saf reducer (birim test edilebilir)
    InterviewContext.tsx          Context + Provider + useInterview() hook'u
  storage/
    session.ts                    SecureStore wrapper: saveSessionId/loadSessionId/clearSessionId
  hooks/
    useProctor.ts                 AppState tabanlı bütünlük olay loglama
    useNetworkTolerance.ts        NetInfo + kesinti tolerans sayacı
  recording/
    sttSocket.ts                  /ws/stt istemcisi: canlı akış + stop/final protokolü + batch fallback kararı
    questionRecorder.ts           Soru bazlı ses kaydı: canlı STT veya batch (expo-av) fallback
    uploadQueue.ts                Genel amaçlı, expo-file-system destekli retry kuyruğu
    CameraRefContext.tsx          Root layout'ta yaşayan, ekranlar arası paylaşılan CameraView ref'i
    CameraHost.tsx                Kalıcı <CameraView>: route'a göre görünür/gizli, hiç unmount olmaz
    sessionRecorder.ts            Oturum boyu kamera kaydı: klip döngüsü + segment upload
  audio/
    playRemoteAudio.ts            `/sesler/` altındaki MP3'leri ve TTS/browser-fallback akışını çalma
app.json                          Expo config: kamera/mikrofon izinleri, deep link şeması, plugin ayarları
.env.example                      EXPO_PUBLIC_API_BASE_URL örneği
```

---

### Task 1: Proje İskeleti

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `jest.config.js`, `.env.example`, `babel.config.js`
- Create: `app/_layout.tsx` (geçici, sonraki görevde genişletilecek), `app/login.tsx` .. `app/result.tsx` (her biri geçici, tek başlık gösteren placeholder ekran)
- Create: `src/api/types.ts` (boş, sonraki görevde doldurulacak — dosya varlığı diğer görevlerin import path'lerini sabitler)

**Interfaces:**
- Produces: Çalışan bir Expo projesi, `npm test` ile jest çalıştırılabilir, `app/` altında 8 route dosyası mevcut (henüz işlevsiz).

- [ ] **Step 1: Expo projesini bu dizinde oluştur**

```bash
cd /Users/tkaralar/Projects/hirevox-mobile
npx create-expo-app@latest . --template blank-typescript
npx expo install expo-router expo-camera expo-av expo-secure-store expo-file-system expo-keep-awake expo-linking react-native-safe-area-context react-native-screens
npx expo install @react-native-community/netinfo
npm install base64-js react-native-live-audio-stream
npm install --save-dev jest-expo @testing-library/react-native @types/jest
```

- [ ] **Step 2: Expo Router'ı etkinleştir**

`package.json`'da `"main"` alanını güncelle:

```json
"main": "expo-router/entry"
```

`app.json`'a plugin ve deep link şeması ekle:

```json
{
  "expo": {
    "name": "Hirevox Mobile",
    "slug": "hirevox-mobile",
    "scheme": "hirevox",
    "plugins": [
      "expo-router",
      [
        "expo-camera",
        {
          "cameraPermission": "Mülakat sırasında kamera görüntünüz kaydedilir.",
          "microphonePermission": "Mülakat sırasında sesiniz kaydedilir."
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Mülakat sırasında kamera görüntünüz kaydedilir.",
        "NSMicrophoneUsageDescription": "Mülakat sırasında sesiniz kaydedilir."
      },
      "associatedDomains": ["applinks:interview.hirevox.example"]
    },
    "android": {
      "permissions": ["CAMERA", "RECORD_AUDIO"],
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "interview.hirevox.example" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

> Not: `interview.hirevox.example` yer tutucu domain'dir — gerçek Universal Link domaini belirlendiğinde güncellenecek; `hirevox://` custom scheme (`"scheme": "hirevox"`) geliştirme/test için her durumda çalışır.

- [ ] **Step 3: Jest kurulumunu tamamla**

`jest.config.js`:

```js
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
  setupFiles: ["./jest.setup.js"],
};
```

`jest.setup.js`:

```js
process.env.EXPO_PUBLIC_API_BASE_URL = "https://test.local";
```

`package.json`'a script ekle:

```json
"scripts": {
  "test": "jest"
}
```

- [ ] **Step 4: Placeholder route dosyalarını oluştur**

`app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Her biri için aynı kalıpla (`app/login.tsx`, `app/consent.tsx`, `app/prep.tsx`, `app/intro.tsx`, `app/question.tsx`, `app/evaluating.tsx`, `app/result.tsx`):

```tsx
import { Text, View } from "react-native";

export default function LoginScreen() {
  return (
    <View>
      <Text>login</Text>
    </View>
  );
}
```

(Diğer dosyalarda `LoginScreen`/`"login"` yerine ekran adı geçer: `ConsentScreen`/`"consent"`, vb.)

`.env.example`:

```
EXPO_PUBLIC_API_BASE_URL=https://interview.hirevox.example
```

`src/api/types.ts`:

```ts
export {};
```

- [ ] **Step 5: Smoke test yaz ve çalıştır**

`app/__tests__/login.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import LoginScreen from "../login";

test("renders login placeholder", () => {
  render(<LoginScreen />);
  expect(screen.getByText("login")).toBeTruthy();
});
```

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo Router project with test setup"
```

---

### Task 2: API İstemcisi ve Tipler

**Files:**
- Create: `src/api/types.ts`
- Create: `src/api/client.ts`
- Test: `src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces:
  - `login(code: string, token: string): Promise<{ sessionId: string; message: string }>`
  - `consent(sessionId: string): Promise<{ status: string }>`
  - `introDone(sessionId: string): Promise<{ status: string }>`
  - `getNextQuestion(sessionId: string): Promise<NextQuestionResponse>`
  - `submitAnswer(payload: AnswerPayload): Promise<{ saved: true }>`
  - `finishQuestions(sessionId: string): Promise<{ status: string }>`
  - `getSession(sessionId: string): Promise<SessionRecord>`
  - `evaluateSession(sessionId: string): Promise<EvaluationResult>`
  - `logIntegrityEvent(payload: IntegrityEventPayload): Promise<{ saved: true }>`
  - `transcribeAudioFile(uri: string, mimeType: string): Promise<{ transcript: string }>`
  - `uploadVideoChunk(sessionId: string, segmentIndex: number, uri: string, mimeType: string): Promise<{ saved: true }>`
  - `finalizeVideoSegment(sessionId: string, segmentIndex: number): Promise<{ saved: true; videoPath: string }>`
  - `ApiError` sınıfı: `.status: number`, `.message: string`

- [ ] **Step 1: Tipleri yaz**

`src/api/types.ts`:

```ts
export interface NextQuestionResponse {
  done: boolean;
  question?: {
    id: number;
    topic: string;
    text: string;
    audioFile: string | null;
    difficulty: number;
    type: "verbal" | "code";
    language: string | null;
    starterCode: string | null;
  };
  topicNumber?: number;
  totalTopics?: number;
}

export interface AnswerPayload {
  sessionId: string;
  questionId?: number;
  phase: "intro" | "main";
  topic?: string;
  askedText?: string;
  transcript: string;
  difficulty?: number;
}

export interface SessionRecord {
  id: string;
  code: string;
  status: "created" | "intro" | "questions" | "evaluating" | "done";
  start_difficulty: number;
  video_path: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface EvaluationResult {
  evaluationId: number;
  scores: Array<{ topic: string; rating: number; justification: string }>;
  overall_comment: string;
}

export interface IntegrityEventPayload {
  sessionId: string;
  type: string;
  detail?: Record<string, unknown> | null;
  questionId?: number | null;
}
```

- [ ] **Step 2: Testleri yaz**

`src/api/__tests__/client.test.ts`:

```ts
import { login, submitAnswer, uploadVideoChunk, ApiError } from "../client";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetAllMocks();
});

test("login POSTs code+token and returns sessionId", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sessionId: "abc-123", message: "Giriş başarılı" }),
  }) as unknown as typeof fetch;

  const result = await login("12345678", "tok-1");

  expect(global.fetch).toHaveBeenCalledWith(
    "https://test.local/api/login",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ code: "12345678", token: "tok-1" }),
    })
  );
  expect(result).toEqual({ sessionId: "abc-123", message: "Giriş başarılı" });
});

test("login throws ApiError with backend message on non-ok response", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: "Geçersiz erişim kodu" }),
  }) as unknown as typeof fetch;

  await expect(login("wrong", "tok-1")).rejects.toMatchObject({
    message: "Geçersiz erişim kodu",
    status: 401,
  });
});

test("submitAnswer omits type field entirely (mobile never sends code type)", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ saved: true }),
  }) as unknown as typeof fetch;

  await submitAnswer({
    sessionId: "s1",
    phase: "main",
    topic: "JavaScript",
    askedText: "Soru metni",
    transcript: "Cevap",
    difficulty: 2,
  });

  const call = (global.fetch as jest.Mock).mock.calls[0];
  const body = JSON.parse(call[1].body);
  expect(body.type).toBeUndefined();
});

test("uploadVideoChunk sends multipart form with segmentIndex", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ saved: true }),
  }) as unknown as typeof fetch;

  await uploadVideoChunk("s1", 2, "file:///tmp/clip.mp4", "video/mp4");

  const call = (global.fetch as jest.Mock).mock.calls[0];
  expect(call[0]).toBe("https://test.local/api/interview/video-chunk");
  const form = call[1].body as FormData;
  expect(form).toBeInstanceOf(FormData);
});

test("ApiError carries status code", () => {
  const err = new ApiError("boom", 500);
  expect(err.status).toBe(500);
  expect(err.message).toBe("boom");
  expect(err).toBeInstanceOf(Error);
});
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/api/__tests__/client.test.ts`
Expected: FAIL — `Cannot find module '../client'`

- [ ] **Step 4: `client.ts`'i yaz**

```ts
import type {
  NextQuestionResponse,
  AnswerPayload,
  SessionRecord,
  EvaluationResult,
  IntegrityEventPayload,
} from "./types";

const BASE = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
    throw new ApiError(err.error || `HTTP ${res.status}`, res.status);
  }
  return res.json();
}

export function login(code: string, token: string) {
  return request("/login", { method: "POST", body: JSON.stringify({ code, token }) }) as Promise<{
    sessionId: string;
    message: string;
  }>;
}

export function consent(sessionId: string) {
  return request("/interview/consent", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  }) as Promise<{ status: string }>;
}

export function introDone(sessionId: string) {
  return request("/interview/intro-done", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  }) as Promise<{ status: string }>;
}

export function getNextQuestion(sessionId: string) {
  return request(`/interview/next?sessionId=${sessionId}`) as Promise<NextQuestionResponse>;
}

export function submitAnswer(payload: AnswerPayload) {
  return request("/interview/answer", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<{ saved: true }>;
}

export function finishQuestions(sessionId: string) {
  return request("/interview/finish-questions", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  }) as Promise<{ status: string }>;
}

export function getSession(sessionId: string) {
  return request(`/interview/session?sessionId=${sessionId}`) as Promise<SessionRecord>;
}

export function evaluateSession(sessionId: string) {
  return request("/evaluate", { method: "POST", body: JSON.stringify({ sessionId }) }) as Promise<EvaluationResult>;
}

export function logIntegrityEvent(payload: IntegrityEventPayload) {
  return request("/integrity/event", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<{ saved: true }>;
}

export async function transcribeAudioFile(uri: string, mimeType: string) {
  const form = new FormData();
  // @ts-expect-error React Native FormData dosya nesnesi web File tipinden farklıdır
  form.append("audio", { uri, name: "recording", type: mimeType });
  const res = await fetch(`${BASE}/stt`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || "Ses metne çevrilemedi", res.status);
  }
  return res.json() as Promise<{ transcript: string }>;
}

export async function uploadVideoChunk(sessionId: string, segmentIndex: number, uri: string, mimeType: string) {
  const form = new FormData();
  // @ts-expect-error bkz. yukarısı
  form.append("chunk", { uri, name: `segment-${segmentIndex}`, type: mimeType });
  form.append("sessionId", sessionId);
  form.append("index", "0");
  form.append("segmentIndex", String(segmentIndex));
  const res = await fetch(`${BASE}/interview/video-chunk`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || "Video parçası gönderilemedi", res.status);
  }
  return res.json() as Promise<{ saved: true }>;
}

export function finalizeVideoSegment(sessionId: string, segmentIndex: number) {
  return request("/interview/video-finalize", {
    method: "POST",
    body: JSON.stringify({ sessionId, segmentIndex }),
  }) as Promise<{ saved: true; videoPath: string }>;
}
```

- [ ] **Step 5: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/api/__tests__/client.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/api
git commit -m "feat: add REST API client for interview backend"
```

---

### Task 3: Session Persistence (SecureStore)

**Files:**
- Create: `src/storage/session.ts`
- Test: `src/storage/__tests__/session.test.ts`

**Interfaces:**
- Consumes: yok (yalnızca `expo-secure-store`)
- Produces:
  - `saveSessionId(sessionId: string): Promise<void>`
  - `loadSessionId(): Promise<string | null>`
  - `clearSessionId(): Promise<void>`

- [ ] **Step 1: Testleri yaz**

`src/storage/__tests__/session.test.ts`:

```ts
import * as SecureStore from "expo-secure-store";
import { saveSessionId, loadSessionId, clearSessionId } from "../session";

jest.mock("expo-secure-store");

test("saveSessionId writes to SecureStore under fixed key", async () => {
  await saveSessionId("abc-123");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("hirevox.sessionId", "abc-123");
});

test("loadSessionId reads and returns stored value", async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("abc-123");
  await expect(loadSessionId()).resolves.toBe("abc-123");
});

test("loadSessionId returns null when nothing stored", async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  await expect(loadSessionId()).resolves.toBeNull();
});

test("clearSessionId deletes the key", async () => {
  await clearSessionId();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("hirevox.sessionId");
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/storage/__tests__/session.test.ts`
Expected: FAIL — `Cannot find module '../session'`

- [ ] **Step 3: `session.ts`'i yaz**

```ts
import * as SecureStore from "expo-secure-store";

const KEY = "hirevox.sessionId";

export async function saveSessionId(sessionId: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, sessionId);
}

export async function loadSessionId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function clearSessionId(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/storage/__tests__/session.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/storage
git commit -m "feat: persist sessionId in SecureStore"
```

---

### Task 4: Interview Reducer + Context

**Files:**
- Create: `src/state/interviewReducer.ts`
- Create: `src/state/InterviewContext.tsx`
- Test: `src/state/__tests__/interviewReducer.test.ts`

**Interfaces:**
- Produces:
  - `type InterviewState = { sessionId: string | null; page: "login" | "consent" | "prep" | "intro" | "question" | "evaluating" | "result"; error: string | null }`
  - `type InterviewAction = { type: "SET_SESSION"; sessionId: string } | { type: "SET_PAGE"; page: InterviewState["page"] } | { type: "SET_ERROR"; error: string | null } | { type: "RESET" }`
  - `interviewReducer(state, action): InterviewState`
  - `<InterviewProvider>`, `useInterview(): { state: InterviewState; dispatch: Dispatch<InterviewAction> }`

- [ ] **Step 1: Testleri yaz**

`src/state/__tests__/interviewReducer.test.ts`:

```ts
import { interviewReducer, initialInterviewState } from "../interviewReducer";

test("SET_SESSION stores sessionId and advances to consent", () => {
  const next = interviewReducer(initialInterviewState, { type: "SET_SESSION", sessionId: "s1" });
  expect(next).toEqual({ sessionId: "s1", page: "consent", error: null });
});

test("SET_PAGE changes page and clears error", () => {
  const withError = { ...initialInterviewState, error: "boom" };
  const next = interviewReducer(withError, { type: "SET_PAGE", page: "prep" });
  expect(next.page).toBe("prep");
  expect(next.error).toBeNull();
});

test("SET_ERROR stores the error message", () => {
  const next = interviewReducer(initialInterviewState, { type: "SET_ERROR", error: "ağ hatası" });
  expect(next.error).toBe("ağ hatası");
});

test("RESET returns to initial state", () => {
  const modified = { sessionId: "s1", page: "question" as const, error: "x" };
  expect(interviewReducer(modified, { type: "RESET" })).toEqual(initialInterviewState);
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/state/__tests__/interviewReducer.test.ts`
Expected: FAIL — `Cannot find module '../interviewReducer'`

- [ ] **Step 3: `interviewReducer.ts`'i yaz**

```ts
export type InterviewPage = "login" | "consent" | "prep" | "intro" | "question" | "evaluating" | "result";

export interface InterviewState {
  sessionId: string | null;
  page: InterviewPage;
  error: string | null;
}

export type InterviewAction =
  | { type: "SET_SESSION"; sessionId: string }
  | { type: "SET_PAGE"; page: InterviewPage }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

export const initialInterviewState: InterviewState = {
  sessionId: null,
  page: "login",
  error: null,
};

export function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case "SET_SESSION":
      return { ...state, sessionId: action.sessionId, page: "consent", error: null };
    case "SET_PAGE":
      return { ...state, page: action.page, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "RESET":
      return initialInterviewState;
    default:
      return state;
  }
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/state/__tests__/interviewReducer.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: `InterviewContext.tsx`'i yaz (test gerektirmez — saf wiring)**

```tsx
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { interviewReducer, initialInterviewState, type InterviewState, type InterviewAction } from "./interviewReducer";

const InterviewContext = createContext<{ state: InterviewState; dispatch: Dispatch<InterviewAction> } | null>(null);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(interviewReducer, initialInterviewState);
  return <InterviewContext.Provider value={{ state, dispatch }}>{children}</InterviewContext.Provider>;
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error("useInterview must be used within InterviewProvider");
  return ctx;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/state
git commit -m "feat: add interview state reducer and context"
```

---

### Task 5: Root Layout — Oturum Devam Ettirme Yönlendirmesi

**Files:**
- Modify: `app/_layout.tsx`
- Test: `app/__tests__/_layout.test.tsx`

**Interfaces:**
- Consumes: `loadSessionId` (Task 3), `getSession` (Task 2), `InterviewProvider`/`useInterview` (Task 4)
- Produces: Uygulama açıldığında SecureStore'da bir `sessionId` varsa backend'den mevcut durumu sorgulayıp doğru sayfaya (`SET_SESSION` + `SET_PAGE`) yönlendiren; yoksa `login`'de kalan bir `RootLayout`.

- [ ] **Step 1: Testleri yaz**

`app/__tests__/_layout.test.tsx`:

```tsx
import { render, waitFor } from "@testing-library/react-native";
import RootLayout from "../_layout";
import { loadSessionId } from "../../src/storage/session";
import { getSession } from "../../src/api/client";
import { useInterview } from "../../src/state/InterviewContext";

jest.mock("../../src/storage/session");
jest.mock("../../src/api/client");
jest.mock("expo-router", () => ({ Stack: () => null, useRouter: () => ({ replace: jest.fn() }) }));

function Probe() {
  const { state } = useInterview();
  return null;
}

test("no stored session: stays on login, does not call getSession", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue(null);
  render(<RootLayout />);
  await waitFor(() => expect(loadSessionId).toHaveBeenCalled());
  expect(getSession).not.toHaveBeenCalled();
});

test("stored session with status 'questions': resumes to question page", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue("s1");
  (getSession as jest.Mock).mockResolvedValue({ id: "s1", status: "questions" });
  render(<RootLayout />);
  await waitFor(() => expect(getSession).toHaveBeenCalledWith("s1"));
});

test("stored session with status 'done': does not crash, resumes to result", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue("s1");
  (getSession as jest.Mock).mockResolvedValue({ id: "s1", status: "done" });
  render(<RootLayout />);
  await waitFor(() => expect(getSession).toHaveBeenCalledWith("s1"));
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- app/__tests__/_layout.test.tsx`
Expected: FAIL — mevcut `_layout.tsx` `InterviewProvider` sarmıyor, resume mantığı yok

- [ ] **Step 3: `_layout.tsx`'i yaz**

```tsx
import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { InterviewProvider, useInterview } from "../src/state/InterviewContext";
import { loadSessionId } from "../src/storage/session";
import { getSession } from "../src/api/client";
import type { InterviewPage } from "../src/state/interviewReducer";

const STATUS_TO_PAGE: Record<string, InterviewPage> = {
  created: "consent",
  intro: "intro",
  questions: "question",
  evaluating: "evaluating",
  done: "result",
};

function ResumeGate({ children }: { children: React.ReactNode }) {
  const { dispatch } = useInterview();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const sessionId = await loadSessionId();
      if (!sessionId) {
        setReady(true);
        return;
      }
      try {
        const session = await getSession(sessionId);
        const page = STATUS_TO_PAGE[session.status] ?? "consent";
        dispatch({ type: "SET_SESSION", sessionId });
        dispatch({ type: "SET_PAGE", page });
        router.replace(`/${page}`);
      } catch {
        // Session backend'de bulunamadıysa (ör. süresi dolmuş) login'de kal
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <InterviewProvider>
      <ResumeGate>
        <Stack screenOptions={{ headerShown: false }} />
      </ResumeGate>
    </InterviewProvider>
  );
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- app/__tests__/_layout.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx app/__tests__/_layout.test.tsx
git commit -m "feat: resume in-progress interview on app launch"
```

---

### Task 6: LoginScreen

**Files:**
- Modify: `app/login.tsx`
- Test: `app/__tests__/login.test.tsx` (Task 1'deki placeholder testin yerini alır)

**Interfaces:**
- Consumes: `login` (Task 2), `saveSessionId` (Task 3), `useInterview` (Task 4), `useLocalSearchParams` (expo-router — deep link'ten gelen `t` parametresi)
- Produces: Deep link'ten token okuyup erişim kodu formu gösteren, başarılı girişte `SET_SESSION` dispatch edip `/consent`'e yönlendiren ekran.

- [ ] **Step 1: Testleri yaz**

`app/__tests__/login.test.tsx` (Task 1'deki dosyanın üzerine yazılır):

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "../login";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { login } from "../../src/api/client";
import { saveSessionId } from "../../src/storage/session";

jest.mock("../../src/api/client");
jest.mock("../../src/storage/session");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ t: "deep-link-token" }),
  useRouter: () => ({ replace: jest.fn() }),
}));

function renderLogin() {
  return render(
    <InterviewProvider>
      <LoginScreen />
    </InterviewProvider>
  );
}

test("missing deep link token shows blocking error and disables submit", () => {
  jest.mocked(require("expo-router").useLocalSearchParams).mockReturnValue({});
  renderLogin();
  expect(screen.getByText(/Geçersiz veya eksik bağlantı/)).toBeTruthy();
});

test("submits code with deep-link token and saves session on success", async () => {
  (login as jest.Mock).mockResolvedValue({ sessionId: "s1", message: "ok" });
  renderLogin();

  fireEvent.changeText(screen.getByPlaceholderText("Erişim kodunu girin"), "12345678");
  fireEvent.press(screen.getByText("Mülakata Başla"));

  await waitFor(() => expect(login).toHaveBeenCalledWith("12345678", "deep-link-token"));
  expect(saveSessionId).toHaveBeenCalledWith("s1");
});

test("shows backend error message on failed login", async () => {
  (login as jest.Mock).mockRejectedValue(new Error("Geçersiz erişim kodu"));
  renderLogin();

  fireEvent.changeText(screen.getByPlaceholderText("Erişim kodunu girin"), "wrong");
  fireEvent.press(screen.getByText("Mülakata Başla"));

  await waitFor(() => expect(screen.getByText("Geçersiz erişim kodu")).toBeTruthy());
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- app/__tests__/login.test.tsx`
Expected: FAIL — placeholder ekran bu davranışları içermiyor

- [ ] **Step 3: `login.tsx`'i yaz**

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { login } from "../src/api/client";
import { saveSessionId } from "../src/storage/session";

export default function LoginScreen() {
  const { t } = useLocalSearchParams<{ t?: string }>();
  const router = useRouter();
  const { dispatch } = useInterview();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!code.trim() || !t) return;
    setLoading(true);
    setError(null);
    try {
      const data = await login(code.trim(), t);
      await saveSessionId(data.sessionId);
      dispatch({ type: "SET_SESSION", sessionId: data.sessionId });
      router.replace("/consent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text>HireVox</Text>
      {!t && <Text>Geçersiz veya eksik bağlantı. Lütfen size gönderilen kişisel linki kullanın.</Text>}
      {error && <Text>{error}</Text>}
      <TextInput
        placeholder="Erişim kodunu girin"
        value={code}
        onChangeText={setCode}
        secureTextEntry
        editable={!loading}
      />
      <Pressable onPress={handleSubmit} disabled={loading || !code.trim() || !t}>
        {loading ? <ActivityIndicator /> : <Text>Mülakata Başla</Text>}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- app/__tests__/login.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/login.tsx app/__tests__/login.test.tsx
git commit -m "feat: implement LoginScreen with deep-link token"
```

---

### Task 7: ConsentScreen

**Files:**
- Modify: `app/consent.tsx`
- Test: `app/__tests__/consent.test.tsx`

**Interfaces:**
- Consumes: `consent` (Task 2), `useInterview` (Task 4)
- Produces: Onay kutusu işaretlenmeden ilerlemeyen, onaylanınca `/api/interview/consent` çağırıp `/prep`'e giden ekran.

- [ ] **Step 1: Testleri yaz**

`app/__tests__/consent.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ConsentScreen from "../consent";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { consent } from "../../src/api/client";

jest.mock("../../src/api/client");
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));

test("submit button disabled until monitoring checkbox is checked", () => {
  render(
    <InterviewProvider>
      <ConsentScreen />
    </InterviewProvider>
  );
  const button = screen.getByText("Görüşmeye Gir");
  expect(button).toBeDisabled();
});

test("checking consent and submitting calls consent API and navigates to prep", async () => {
  (consent as jest.Mock).mockResolvedValue({ status: "intro" });
  render(
    <InterviewProvider>
      <ConsentScreen />
    </InterviewProvider>
  );

  fireEvent(screen.getByRole("checkbox"), "valueChange", true);
  fireEvent.press(screen.getByText("Görüşmeye Gir"));

  await waitFor(() => expect(consent).toHaveBeenCalled());
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- app/__tests__/consent.test.tsx`
Expected: FAIL — placeholder ekranda checkbox/buton yok

- [ ] **Step 3: `consent.tsx`'i yaz**

```tsx
import { useState } from "react";
import { View, Text, Switch, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { consent } from "../src/api/client";

export default function ConsentScreen() {
  const router = useRouter();
  const { state, dispatch } = useInterview();
  const [monitoringConsent, setMonitoringConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConsent = async () => {
    if (!state.sessionId) return;
    setLoading(true);
    try {
      await consent(state.sessionId);
      dispatch({ type: "SET_PAGE", page: "prep" });
      router.replace("/prep");
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Bir hata oluştu" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text>Mülakat Hakkında</Text>
      <Text>
        Mülakat süresince kamera görüntünüz ve mikrofon sesiniz tüm oturum boyunca kaydedilir; sekme/uygulama
        değişimi ve arka plana geçişler bütünlük amacıyla izlenir.
      </Text>
      <Switch
        accessibilityRole="checkbox"
        value={monitoringConsent}
        onValueChange={setMonitoringConsent}
      />
      <Text>Yukarıdaki bilgileri okudum ve veri toplanmasını kabul ediyorum.</Text>
      {state.error && <Text>{state.error}</Text>}
      <Pressable onPress={handleConsent} disabled={loading || !monitoringConsent}>
        {loading ? <ActivityIndicator /> : <Text>Görüşmeye Gir</Text>}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- app/__tests__/consent.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/consent.tsx app/__tests__/consent.test.tsx
git commit -m "feat: implement ConsentScreen"
```

---

### Task 8: STT WebSocket İstemcisi

**Files:**
- Create: `src/recording/sttSocket.ts`
- Test: `src/recording/__tests__/sttSocket.test.ts`

**Interfaces:**
- Produces:
  - `openSttSocket(sessionId: string, timeoutMs?: number): Promise<WebSocket | null>` — `wss://.../ws/stt?sessionId=...&encoding=linear16&sampleRate=16000` bağlantısı dener, `timeoutMs` (varsayılan 2000) içinde açılmazsa `null` döner.
  - `sendAudioChunk(ws: WebSocket, bytes: Uint8Array): void`
  - `finishSttSocket(ws: WebSocket, timeoutMs?: number): Promise<{ transcript: string }>` — `{"type":"stop"}` gönderir, `{"type":"final",...}` mesajını bekler (varsayılan 8000ms timeout).

- [ ] **Step 1: Testleri yaz**

`src/recording/__tests__/sttSocket.test.ts`:

```ts
import { openSttSocket, sendAudioChunk, finishSttSocket } from "../sttSocket";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: unknown[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {}
  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  triggerMessage(data: string) {
    this.onmessage?.({ data });
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  // @ts-expect-error test double
  global.WebSocket = FakeWebSocket;
});

test("openSttSocket includes sessionId, encoding and sampleRate in URL", async () => {
  const promise = openSttSocket("s1", 1000);
  const ws = FakeWebSocket.instances[0];
  expect(ws.url).toBe("wss://test.local/ws/stt?sessionId=s1&encoding=linear16&sampleRate=16000");
  ws.triggerOpen();
  await expect(promise).resolves.toBe(ws as unknown as WebSocket);
});

test("openSttSocket resolves null if connection does not open before timeout", async () => {
  const promise = openSttSocket("s1", 10);
  await expect(promise).resolves.toBeNull();
});

test("sendAudioChunk sends bytes only when socket is OPEN", () => {
  const ws = new FakeWebSocket("wss://x");
  sendAudioChunk(ws as unknown as WebSocket, new Uint8Array([1, 2, 3]));
  expect(ws.sent).toHaveLength(0); // henüz OPEN değil

  ws.readyState = FakeWebSocket.OPEN;
  sendAudioChunk(ws as unknown as WebSocket, new Uint8Array([1, 2, 3]));
  expect(ws.sent).toHaveLength(1);
});

test("finishSttSocket sends stop and resolves with final transcript", async () => {
  const ws = new FakeWebSocket("wss://x");
  ws.readyState = FakeWebSocket.OPEN;

  const promise = finishSttSocket(ws as unknown as WebSocket, 1000);
  expect(JSON.parse(ws.sent[0] as string)).toEqual({ type: "stop" });

  ws.triggerMessage(JSON.stringify({ type: "final", transcript: "merhaba dünya" }));
  await expect(promise).resolves.toEqual({ transcript: "merhaba dünya" });
});

test("finishSttSocket resolves with empty transcript on timeout", async () => {
  const ws = new FakeWebSocket("wss://x");
  ws.readyState = FakeWebSocket.OPEN;
  await expect(finishSttSocket(ws as unknown as WebSocket, 10)).resolves.toEqual({ transcript: "" });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/recording/__tests__/sttSocket.test.ts`
Expected: FAIL — `Cannot find module '../sttSocket'`

- [ ] **Step 3: `sttSocket.ts`'i yaz**

```ts
const WS_BASE = process.env.EXPO_PUBLIC_API_BASE_URL!.replace(/^http/, "ws");

export function openSttSocket(sessionId: string, timeoutMs = 2000): Promise<WebSocket | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: WebSocket | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const ws = new WebSocket(`${WS_BASE}/ws/stt?sessionId=${sessionId}&encoding=linear16&sampleRate=16000`);

    const timer = setTimeout(() => {
      ws.onopen = null;
      ws.onerror = null;
      settle(null);
    }, timeoutMs);

    ws.onopen = () => {
      clearTimeout(timer);
      settle(ws);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      settle(null);
    };
  });
}

export function sendAudioChunk(ws: WebSocket, bytes: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(bytes.buffer);
  }
}

export function finishSttSocket(ws: WebSocket, timeoutMs = 8000): Promise<{ transcript: string }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.onmessage = null;
      resolve({ transcript: "" });
    }, timeoutMs);

    ws.onmessage = (event: { data: string }) => {
      let msg: { type?: string; transcript?: string };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "final") {
        clearTimeout(timer);
        resolve({ transcript: msg.transcript || "" });
      }
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop" }));
    }
  });
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/recording/__tests__/sttSocket.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/recording/sttSocket.ts src/recording/__tests__/sttSocket.test.ts
git commit -m "feat: add live STT WebSocket client"
```

---

### Task 9: Upload Queue

**Files:**
- Create: `src/recording/uploadQueue.ts`
- Test: `src/recording/__tests__/uploadQueue.test.ts`

**Interfaces:**
- Produces:
  - `createUploadQueue<T>(upload: (item: T) => Promise<void>): { enqueue(item: T): void; drain(): Promise<void>; pendingCount(): number }`
  - Kuyruk, öğeleri sırayla işler; bir öğe başarısız olursa (reddedilen promise) kuyruğun başında kalır ve `retry()` çağrılana kadar bir sonraki öğeye geçilmez — ağ döndüğünde `retry()` ile devam ettirilir.
  - `retry(): void`

- [ ] **Step 1: Testleri yaz**

`src/recording/__tests__/uploadQueue.test.ts`:

```ts
import { createUploadQueue } from "../uploadQueue";

test("processes items sequentially in FIFO order", async () => {
  const order: number[] = [];
  const upload = jest.fn(async (item: number) => {
    order.push(item);
  });
  const queue = createUploadQueue(upload);

  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  await queue.drain();

  expect(order).toEqual([1, 2, 3]);
  expect(queue.pendingCount()).toBe(0);
});

test("failed item stays queued and blocks later items until retry", async () => {
  let attempt = 0;
  const upload = jest.fn(async (item: number) => {
    if (item === 2 && attempt === 0) {
      attempt++;
      throw new Error("network down");
    }
  });
  const queue = createUploadQueue(upload);

  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  await queue.drain();

  // item 1 basarili, item 2 hata verdi ve kuyrukta kaldi, item 3'e gecilmedi
  expect(upload).toHaveBeenNthCalledWith(1, 1);
  expect(upload).toHaveBeenNthCalledWith(2, 2);
  expect(queue.pendingCount()).toBe(2); // 2 ve 3 hala bekliyor

  queue.retry();
  await queue.drain();

  expect(upload).toHaveBeenNthCalledWith(3, 2);
  expect(upload).toHaveBeenNthCalledWith(4, 3);
  expect(queue.pendingCount()).toBe(0);
});

test("pendingCount reflects items not yet uploaded", () => {
  const queue = createUploadQueue(async () => {});
  expect(queue.pendingCount()).toBe(0);
  queue.enqueue("a");
  queue.enqueue("b");
  expect(queue.pendingCount()).toBe(2);
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/recording/__tests__/uploadQueue.test.ts`
Expected: FAIL — `Cannot find module '../uploadQueue'`

- [ ] **Step 3: `uploadQueue.ts`'i yaz**

```ts
export function createUploadQueue<T>(upload: (item: T) => Promise<void>) {
  const items: T[] = [];
  let draining = false;

  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (items.length > 0) {
        const item = items[0];
        try {
          await upload(item);
          items.shift();
        } catch {
          // Basarisiz oge kuyrukta kalir, sonraki ogelere gecilmez
          break;
        }
      }
    } finally {
      draining = false;
    }
  }

  return {
    enqueue(item: T) {
      items.push(item);
      void drain();
    },
    drain,
    retry() {
      void drain();
    },
    pendingCount() {
      return items.length;
    },
  };
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/recording/__tests__/uploadQueue.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/recording/uploadQueue.ts src/recording/__tests__/uploadQueue.test.ts
git commit -m "feat: add generic sequential retry upload queue"
```

---

### Task 10: QuestionRecorder

**Files:**
- Create: `src/recording/questionRecorder.ts`
- Test: `src/recording/__tests__/questionRecorder.test.ts`

**Interfaces:**
- Consumes: `openSttSocket`, `sendAudioChunk`, `finishSttSocket` (Task 8), `transcribeAudioFile` (Task 2)
- Produces:
  - `startQuestionRecording(sessionId: string): Promise<void>`
  - `stopQuestionRecording(): Promise<{ transcript: string }>` — canlı STT ile bağlanabildiyse WS'den gelen transcript'i, bağlanamadıysa kaydedilen dosyayı `transcribeAudioFile` ile batch çevirip transcript'i döner.

- [ ] **Step 1: Testleri yaz**

`src/recording/__tests__/questionRecorder.test.ts`:

```ts
import { startQuestionRecording, stopQuestionRecording } from "../questionRecorder";
import { openSttSocket, sendAudioChunk, finishSttSocket } from "../sttSocket";
import { transcribeAudioFile } from "../../api/client";
import LiveAudioStream from "react-native-live-audio-stream";
import { Audio } from "expo-av";

jest.mock("../sttSocket");
jest.mock("../../api/client");
jest.mock("react-native-live-audio-stream", () => ({
  init: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
}));
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn(),
      getURI: jest.fn(() => "file:///tmp/rec.m4a"),
    })),
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

const fakeWs = { readyState: 1 } as unknown as WebSocket;

test("live path: opens socket and streams via LiveAudioStream when connection succeeds", async () => {
  (openSttSocket as jest.Mock).mockResolvedValue(fakeWs);

  await startQuestionRecording("s1");

  expect(LiveAudioStream.init).toHaveBeenCalledWith(
    expect.objectContaining({ sampleRate: 16000, channels: 1, bitsPerSample: 16 })
  );
  expect(LiveAudioStream.start).toHaveBeenCalled();
});

test("live path: stop sends final stop message and returns its transcript", async () => {
  (openSttSocket as jest.Mock).mockResolvedValue(fakeWs);
  (finishSttSocket as jest.Mock).mockResolvedValue({ transcript: "canlı transkript" });

  await startQuestionRecording("s1");
  const result = await stopQuestionRecording();

  expect(LiveAudioStream.stop).toHaveBeenCalled();
  expect(result).toEqual({ transcript: "canlı transkript" });
});

test("fallback path: batch-records with expo-av when socket fails to open", async () => {
  (openSttSocket as jest.Mock).mockResolvedValue(null);
  (transcribeAudioFile as jest.Mock).mockResolvedValue({ transcript: "batch transkript" });

  await startQuestionRecording("s1");
  const result = await stopQuestionRecording();

  expect(transcribeAudioFile).toHaveBeenCalledWith("file:///tmp/rec.m4a", "audio/m4a");
  expect(result).toEqual({ transcript: "batch transkript" });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/recording/__tests__/questionRecorder.test.ts`
Expected: FAIL — `Cannot find module '../questionRecorder'`

- [ ] **Step 3: `questionRecorder.ts`'i yaz**

```ts
import { Audio } from "expo-av";
import LiveAudioStream from "react-native-live-audio-stream";
import { toByteArray } from "base64-js";
import { openSttSocket, sendAudioChunk, finishSttSocket } from "./sttSocket";
import { transcribeAudioFile } from "../api/client";

type Mode = "live" | "batch" | null;

let mode: Mode = null;
let socket: WebSocket | null = null;
let recording: Audio.Recording | null = null;

export async function startQuestionRecording(sessionId: string): Promise<void> {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

  socket = await openSttSocket(sessionId);

  if (socket) {
    mode = "live";
    LiveAudioStream.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      bufferSize: 4096,
    });
    LiveAudioStream.on("data", (base64Chunk: string) => {
      if (!socket) return;
      sendAudioChunk(socket, toByteArray(base64Chunk));
    });
    LiveAudioStream.start();
    return;
  }

  mode = "batch";
  recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
}

export async function stopQuestionRecording(): Promise<{ transcript: string }> {
  if (mode === "live" && socket) {
    LiveAudioStream.stop();
    const result = await finishSttSocket(socket);
    socket = null;
    mode = null;
    return result;
  }

  if (mode === "batch" && recording) {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    mode = null;
    if (!uri) return { transcript: "" };
    return transcribeAudioFile(uri, "audio/m4a");
  }

  return { transcript: "" };
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/recording/__tests__/questionRecorder.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/recording/questionRecorder.ts src/recording/__tests__/questionRecorder.test.ts
git commit -m "feat: add per-question recorder with live/batch STT fallback"
```

---

### Task 11: useProctor Hook

**Files:**
- Create: `src/hooks/useProctor.ts`
- Test: `src/hooks/__tests__/useProctor.test.tsx`

**Interfaces:**
- Consumes: `logIntegrityEvent` (Task 2)
- Produces: `useProctor(sessionId: string | null, active?: boolean): void` — `AppState` "background"/"inactive" geçişlerinde `logIntegrityEvent({ sessionId, type: "app_backgrounded" })` fire-and-forget çağırır; "active"'e dönüşte `type: "app_foregrounded"` loglar.

- [ ] **Step 1: Testleri yaz**

`src/hooks/__tests__/useProctor.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useProctor } from "../useProctor";
import { logIntegrityEvent } from "../../api/client";

jest.mock("../../api/client");

let changeHandler: (state: string) => void;

beforeEach(() => {
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    changeHandler = handler as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
  jest.mocked(logIntegrityEvent).mockClear();
});

function Probe({ sessionId, active = true }: { sessionId: string | null; active?: boolean }) {
  useProctor(sessionId, active);
  return null;
}

test("logs app_backgrounded when AppState transitions to background", () => {
  render(<Probe sessionId="s1" />);
  changeHandler("background");
  expect(logIntegrityEvent).toHaveBeenCalledWith({ sessionId: "s1", type: "app_backgrounded", detail: null });
});

test("logs app_foregrounded when returning to active after backgrounding", () => {
  render(<Probe sessionId="s1" />);
  changeHandler("background");
  changeHandler("active");
  expect(logIntegrityEvent).toHaveBeenLastCalledWith({
    sessionId: "s1",
    type: "app_foregrounded",
    detail: null,
  });
});

test("does nothing when sessionId is null", () => {
  render(<Probe sessionId={null} />);
  changeHandler("background");
  expect(logIntegrityEvent).not.toHaveBeenCalled();
});

test("does nothing when active=false", () => {
  render(<Probe sessionId="s1" active={false} />);
  changeHandler("background");
  expect(logIntegrityEvent).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/hooks/__tests__/useProctor.test.tsx`
Expected: FAIL — `Cannot find module '../useProctor'`

- [ ] **Step 3: `useProctor.ts`'i yaz**

```ts
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { logIntegrityEvent } from "../api/client";

export function useProctor(sessionId: string | null, active = true): void {
  const wasBackgrounded = useRef(false);

  useEffect(() => {
    if (!active || !sessionId) return;

    const send = (type: string) => {
      logIntegrityEvent({ sessionId, type, detail: null }).catch(() => {});
    };

    const onChange = (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        wasBackgrounded.current = true;
        send("app_backgrounded");
      } else if (nextState === "active" && wasBackgrounded.current) {
        wasBackgrounded.current = false;
        send("app_foregrounded");
      }
    };

    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [sessionId, active]);
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/hooks/__tests__/useProctor.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProctor.ts src/hooks/__tests__/useProctor.test.tsx
git commit -m "feat: log app background/foreground transitions as integrity events"
```

---

### Task 12: useNetworkTolerance Hook

**Files:**
- Create: `src/hooks/useNetworkTolerance.ts`
- Test: `src/hooks/__tests__/useNetworkTolerance.test.tsx`

**Interfaces:**
- Consumes: `@react-native-community/netinfo`
- Produces: `useNetworkTolerance(onToleranceExceeded: () => void, toleranceMs?: number): void` — varsayılan `toleranceMs = 45000`; bağlantı kesilince sayaç başlar, `toleranceMs` içinde dönmezse `onToleranceExceeded()` çağrılır; döndüğünde sayaç iptal edilir.

- [ ] **Step 1: Testleri yaz**

`src/hooks/__tests__/useNetworkTolerance.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";
import { useNetworkTolerance } from "../useNetworkTolerance";

jest.mock("@react-native-community/netinfo");
jest.useFakeTimers();

let listener: (state: { isConnected: boolean | null }) => void;

beforeEach(() => {
  jest.mocked(NetInfo.addEventListener).mockImplementation((cb) => {
    listener = cb as never;
    return jest.fn();
  });
});

function Probe({ onExceeded, toleranceMs }: { onExceeded: () => void; toleranceMs?: number }) {
  useNetworkTolerance(onExceeded, toleranceMs);
  return null;
}

test("does not fire callback if reconnected before tolerance elapses", () => {
  const onExceeded = jest.fn();
  render(<Probe onExceeded={onExceeded} toleranceMs={45000} />);

  listener({ isConnected: false });
  jest.advanceTimersByTime(30000);
  listener({ isConnected: true });
  jest.advanceTimersByTime(20000);

  expect(onExceeded).not.toHaveBeenCalled();
});

test("fires callback once tolerance elapses while disconnected", () => {
  const onExceeded = jest.fn();
  render(<Probe onExceeded={onExceeded} toleranceMs={45000} />);

  listener({ isConnected: false });
  jest.advanceTimersByTime(45000);

  expect(onExceeded).toHaveBeenCalledTimes(1);
});

test("reconnecting after firing does not fire again", () => {
  const onExceeded = jest.fn();
  render(<Probe onExceeded={onExceeded} toleranceMs={45000} />);

  listener({ isConnected: false });
  jest.advanceTimersByTime(45000);
  listener({ isConnected: true });
  listener({ isConnected: false });
  jest.advanceTimersByTime(10000);

  expect(onExceeded).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/hooks/__tests__/useNetworkTolerance.test.tsx`
Expected: FAIL — `Cannot find module '../useNetworkTolerance'`

- [ ] **Step 3: `useNetworkTolerance.ts`'i yaz**

```ts
import { useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useNetworkTolerance(onToleranceExceeded: () => void, toleranceMs = 45000): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onToleranceExceeded);
  callbackRef.current = onToleranceExceeded;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) {
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            callbackRef.current();
          }, toleranceMs);
        }
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toleranceMs]);
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/hooks/__tests__/useNetworkTolerance.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNetworkTolerance.ts src/hooks/__tests__/useNetworkTolerance.test.tsx
git commit -m "feat: terminate interview after sustained connectivity loss"
```

---

### Task 13: SessionRecorder

**Files:**
- Create: `src/recording/sessionRecorder.ts`
- Test: `src/recording/__tests__/sessionRecorder.test.ts`

**Interfaces:**
- Consumes: `createUploadQueue` (Task 9), `uploadVideoChunk`, `finalizeVideoSegment` (Task 2), `expo-camera`, `react-native` `AppState`
- Produces:
  - `startSessionRecording(sessionId: string, cameraRef: React.RefObject<CameraView>): Promise<void>` — 60 saniyelik klipler halinde sürekli kayıt döngüsü başlatır; her tamamlanan klip artan bir `segmentIndex` ile kuyruğa (Task 9) eklenir. Ayrıca bir `AppState` dinleyicisi kaydeder: arka plana geçişte otomatik `pauseSessionRecording()`, ön plana dönüşte otomatik `resumeSessionRecording(cameraRef)` çağırır — hiçbir ekranın bunu elle tetiklemesi gerekmez.
  - `pauseSessionRecording(): Promise<void>` — mevcut klibi hemen durdurup yükler, döngüyü durdurur. Dışa açık kalır (Task 15'te PrepScreen'den ayrılmadan önce de tetiklenebilir), ama normal akışta `AppState` tarafından otomatik çağrılır.
  - `resumeSessionRecording(cameraRef?: React.RefObject<CameraView>): Promise<void>` — yeni bir `segmentIndex` ile döngüyü yeniden başlatır; `cameraRef` verilmezse en son kullanılan ref korunur.
  - `stopSessionRecording(): Promise<void>` — mevcut klibi durdurup yükler, kuyruğun boşalmasını bekler, `AppState` dinleyicisini kaldırır (ResultScreen'de çağrılır).

- [ ] **Step 1: Testleri yaz**

`src/recording/__tests__/sessionRecorder.test.ts`:

```ts
import { AppState } from "react-native";
import {
  startSessionRecording,
  pauseSessionRecording,
  resumeSessionRecording,
  stopSessionRecording,
} from "../sessionRecorder";
import { uploadVideoChunk, finalizeVideoSegment } from "../../api/client";

jest.mock("../../api/client");

let appStateHandler: (state: string) => void;

beforeEach(() => {
  jest.mocked(uploadVideoChunk).mockResolvedValue({ saved: true });
  jest.mocked(finalizeVideoSegment).mockResolvedValue({ saved: true, videoPath: "x" });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    appStateHandler = handler as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
});

function fakeCameraRef(uri = "file:///tmp/clip-0.mp4") {
  return {
    current: {
      recordAsync: jest.fn().mockResolvedValue({ uri }),
      stopRecording: jest.fn(),
    },
  } as unknown as React.RefObject<{ recordAsync: jest.Mock; stopRecording: jest.Mock }>;
}

test("starting recording begins segment 0 and uploads it once the clip resolves", async () => {
  const ref = fakeCameraRef();
  await startSessionRecording("s1", ref as never);

  expect(ref.current!.recordAsync).toHaveBeenCalledWith(
    expect.objectContaining({ maxDuration: 60, quality: "480p" })
  );
  await ref.current!.recordAsync.mock.results[0].value;

  expect(uploadVideoChunk).toHaveBeenCalledWith("s1", 0, "file:///tmp/clip-0.mp4", "video/mp4");
  expect(finalizeVideoSegment).toHaveBeenCalledWith("s1", 0);
});

test("pause stops current clip and resume starts a new segmentIndex", async () => {
  const ref = fakeCameraRef();
  await startSessionRecording("s1", ref as never);
  await pauseSessionRecording();

  expect(ref.current!.stopRecording).toHaveBeenCalledTimes(1);

  await resumeSessionRecording(ref as never);
  expect(ref.current!.recordAsync).toHaveBeenCalledTimes(2);
});

test("stop finalizes the current in-flight segment and drains the queue", async () => {
  const ref = fakeCameraRef();
  await startSessionRecording("s1", ref as never);
  await stopSessionRecording();

  expect(ref.current!.stopRecording).toHaveBeenCalled();
  expect(finalizeVideoSegment).toHaveBeenCalled();
});

test("AppState transition to background auto-pauses; returning to active auto-resumes", async () => {
  const ref = fakeCameraRef();
  await startSessionRecording("s1", ref as never);

  appStateHandler("background");
  expect(ref.current!.stopRecording).toHaveBeenCalledTimes(1);

  appStateHandler("active");
  expect(ref.current!.recordAsync).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/recording/__tests__/sessionRecorder.test.ts`
Expected: FAIL — `Cannot find module '../sessionRecorder'`

- [ ] **Step 3: `sessionRecorder.ts`'i yaz**

```ts
import type { RefObject } from "react";
import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import { createUploadQueue } from "./uploadQueue";
import { uploadVideoChunk, finalizeVideoSegment } from "../api/client";

interface CameraLike {
  recordAsync: (opts: { maxDuration: number; quality: string }) => Promise<{ uri: string }>;
  stopRecording: () => void;
}

const CLIP_MAX_DURATION_SEC = 60;
const CLIP_QUALITY = "480p";

let currentSessionId: string | null = null;
let currentSegmentIndex = 0;
let currentCameraRef: RefObject<CameraLike> | null = null;
let looping = false;
let inFlightClip: Promise<{ uri: string }> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let wasBackgrounded = false;

const queue = createUploadQueue(async (item: { sessionId: string; segmentIndex: number; uri: string }) => {
  await uploadVideoChunk(item.sessionId, item.segmentIndex, item.uri, "video/mp4");
  await finalizeVideoSegment(item.sessionId, item.segmentIndex);
});

async function recordOneClip(): Promise<void> {
  if (!currentCameraRef?.current || !currentSessionId) return;
  const segmentIndex = currentSegmentIndex++;
  inFlightClip = currentCameraRef.current.recordAsync({ maxDuration: CLIP_MAX_DURATION_SEC, quality: CLIP_QUALITY });
  const { uri } = await inFlightClip;
  inFlightClip = null;
  queue.enqueue({ sessionId: currentSessionId, segmentIndex, uri });

  if (looping) {
    await recordOneClip();
  }
}

function onAppStateChange(nextState: AppStateStatus): void {
  if (nextState === "background" || nextState === "inactive") {
    if (!wasBackgrounded) {
      wasBackgrounded = true;
      void pauseSessionRecording();
    }
  } else if (nextState === "active" && wasBackgrounded) {
    wasBackgrounded = false;
    void resumeSessionRecording();
  }
}

export async function startSessionRecording(sessionId: string, cameraRef: RefObject<CameraLike>): Promise<void> {
  currentSessionId = sessionId;
  currentCameraRef = cameraRef;
  currentSegmentIndex = 0;
  wasBackgrounded = false;
  looping = true;
  appStateSubscription = AppState.addEventListener("change", onAppStateChange);
  void recordOneClip();
}

export async function pauseSessionRecording(): Promise<void> {
  looping = false;
  currentCameraRef?.current?.stopRecording();
  if (inFlightClip) await inFlightClip;
}

export async function resumeSessionRecording(cameraRef?: RefObject<CameraLike>): Promise<void> {
  if (cameraRef) currentCameraRef = cameraRef;
  looping = true;
  void recordOneClip();
}

export async function stopSessionRecording(): Promise<void> {
  looping = false;
  appStateSubscription?.remove();
  appStateSubscription = null;
  currentCameraRef?.current?.stopRecording();
  if (inFlightClip) await inFlightClip;
  await queue.drain();
  currentSessionId = null;
  currentCameraRef = null;
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/recording/__tests__/sessionRecorder.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/recording/sessionRecorder.ts src/recording/__tests__/sessionRecorder.test.ts
git commit -m "feat: add session-long camera recorder with clip-based segment upload"
```

---

### Task 14: CameraHost — Kalıcı Kamera Referansı

**Files:**
- Create: `src/recording/CameraRefContext.tsx`
- Create: `src/recording/CameraHost.tsx`
- Modify: `app/_layout.tsx`
- Test: `src/recording/__tests__/CameraHost.test.tsx`

**Interfaces:**
- Consumes: `expo-camera` (`CameraView`), `expo-router` (`usePathname`)
- Produces:
  - `CameraRefProvider({ children })` — `RefObject<CameraView>`'i Context üzerinden sağlar.
  - `useCameraRef(): RefObject<CameraView>`
  - `<CameraHost />` — `CameraRefProvider` içinde, `_layout.tsx`'te `<Stack>`'in KARDEŞİ olarak (üstünde değil, aynı seviyede, `Stack`'in dışında) render edilir; bu sayede ekran geçişlerinde hiç unmount olmaz. `usePathname() === "/prep"` iken tam boyutlu önizleme olarak, diğer tüm rotalarda görünmez (1x1, opacity 0) ama KAYITTA olarak render edilir.

> Neden gerekli: `expo-router`'ın `<Stack>` navigatörü, aktif olmayan ekranları unmount eder. `SessionRecorder` (Task 13) oturum boyu (`prep` → `intro` → `question` → `result`) aynı `CameraView` örneğiyle kayıt yapmak zorunda — web'in `SessionRecordingProvider`'ının "sayfa geçişleri boyunca hayatta kalır" davranışının mobildeki karşılığı budur. `CameraView`'i `Stack`'in İÇİNDE (bir route dosyasında) tutmak, o rotadan ayrılınca kaydı koparır.

- [ ] **Step 1: Testleri yaz**

`src/recording/__tests__/CameraHost.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { CameraHost } from "../CameraHost";
import { CameraRefProvider } from "../CameraRefContext";

const mockUsePathname = jest.fn();
jest.mock("expo-router", () => ({ usePathname: () => mockUsePathname() }));

let lastProps: Record<string, unknown> = {};
jest.mock("expo-camera", () => ({
  CameraView: (props: Record<string, unknown>) => {
    lastProps = props;
    return null;
  },
}));

test("full-size visible style while on /prep", () => {
  mockUsePathname.mockReturnValue("/prep");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ width: "100%" });
});

test("hidden 1x1 style on any other route, e.g. /question", () => {
  mockUsePathname.mockReturnValue("/question");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ width: 1, height: 1, opacity: 0 });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- src/recording/__tests__/CameraHost.test.tsx`
Expected: FAIL — `Cannot find module '../CameraHost'`

- [ ] **Step 3: `CameraRefContext.tsx`'i yaz**

```tsx
import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import type { CameraView } from "expo-camera";

const CameraRefContext = createContext<RefObject<CameraView> | null>(null);

export function CameraRefProvider({ children }: { children: ReactNode }) {
  const ref = useRef<CameraView>(null);
  return <CameraRefContext.Provider value={ref}>{children}</CameraRefContext.Provider>;
}

export function useCameraRef(): RefObject<CameraView> {
  const ctx = useContext(CameraRefContext);
  if (!ctx) throw new Error("useCameraRef must be used within CameraRefProvider");
  return ctx;
}
```

- [ ] **Step 4: `CameraHost.tsx`'i yaz**

```tsx
import { StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { usePathname } from "expo-router";
import { useCameraRef } from "./CameraRefContext";

export function CameraHost() {
  const cameraRef = useCameraRef();
  const pathname = usePathname();
  const visible = pathname === "/prep";

  return (
    <CameraView
      ref={cameraRef}
      facing="front"
      videoQuality="480p"
      style={visible ? styles.visible : styles.hidden}
    />
  );
}

const styles = StyleSheet.create({
  visible: { width: "100%", aspectRatio: 3 / 4 },
  hidden: { position: "absolute", top: -1000, width: 1, height: 1, opacity: 0 },
});
```

- [ ] **Step 5: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- src/recording/__tests__/CameraHost.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: `_layout.tsx`'e `CameraRefProvider` ve `CameraHost`'u ekle**

Task 5'te yazılan `app/_layout.tsx`'in `RootLayout` fonksiyonunu güncelle — `CameraHost`, `Stack`'in KARDEŞİ olarak (üstünde değil, yanında) eklenir:

```tsx
import { InterviewProvider } from "../src/state/InterviewContext";
import { CameraRefProvider } from "../src/recording/CameraRefContext";
import { CameraHost } from "../src/recording/CameraHost";
// ...ResumeGate ve diger importlar Task 5'teki gibi kalir

export default function RootLayout() {
  return (
    <InterviewProvider>
      <CameraRefProvider>
        <ResumeGate>
          <Stack screenOptions={{ headerShown: false }} />
          <CameraHost />
        </ResumeGate>
      </CameraRefProvider>
    </InterviewProvider>
  );
}
```

- [ ] **Step 7: Task 5'in layout testini tekrar çalıştır, hâlâ geçtiğini doğrula**

Run: `npm test -- app/__tests__/_layout.test.tsx`
Expected: PASS (3 tests) — `CameraHost`, `expo-camera` mock'landığı için `_layout.test.tsx`'te sorun çıkarmaz; çıkarırsa o test dosyasına `jest.mock("expo-camera", () => ({ CameraView: () => null }))` eklenir.

- [ ] **Step 8: Commit**

```bash
git add src/recording/CameraRefContext.tsx src/recording/CameraHost.tsx src/recording/__tests__/CameraHost.test.tsx app/_layout.tsx
git commit -m "feat: keep camera recording alive across screen navigation"
```

---

### Task 15: PrepScreen

**Files:**
- Modify: `app/prep.tsx`
- Test: `app/__tests__/prep.test.tsx`

**Interfaces:**
- Consumes: `expo-camera` (`useCameraPermissions`), `useCameraRef` (Task 14), `startSessionRecording` (Task 13), `useInterview` (Task 4)
- Produces: İzin isteyen, `CameraHost`'un (Task 14, root layout'ta zaten render edilen kalıcı kamera) önizlemesini gösteren, "Mülakata Başla" ile kaydı başlatıp `/intro`'ya geçen ekran. Kendi `CameraView`'ini render ETMEZ — `CameraHost` zaten bu route'tayken tam boyutlu görünür oluyor (Task 14).

- [ ] **Step 1: Testleri yaz**

`app/__tests__/prep.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import PrepScreen from "../prep";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { CameraRefProvider } from "../../src/recording/CameraRefContext";
import { startSessionRecording } from "../../src/recording/sessionRecorder";

jest.mock("../../src/recording/sessionRecorder");
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("expo-camera", () => ({
  useCameraPermissions: () => [{ granted: false }, jest.fn().mockResolvedValue({ granted: true })],
  useMicrophonePermissions: () => [{ granted: false }, jest.fn().mockResolvedValue({ granted: true })],
}));

function renderPrep() {
  return render(
    <InterviewProvider>
      <CameraRefProvider>
        <PrepScreen />
      </CameraRefProvider>
    </InterviewProvider>
  );
}

test("shows permission blocked message before permissions are granted", () => {
  renderPrep();
  expect(screen.getByText(/Kamera ve mikrofon erişimi gerekli/)).toBeTruthy();
});

test("pressing start requests permissions then begins session recording", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  fireEvent.press(screen.getByText("Mülakata Başla"));
  await waitFor(() => expect(startSessionRecording).toHaveBeenCalled());
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- app/__tests__/prep.test.tsx`
Expected: FAIL — placeholder ekranda izin/kayıt akışı yok

- [ ] **Step 3: `prep.tsx`'i yaz**

```tsx
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { useInterview } from "../src/state/InterviewContext";
import { useCameraRef } from "../src/recording/CameraRefContext";
import { startSessionRecording } from "../src/recording/sessionRecorder";

export default function PrepScreen() {
  const router = useRouter();
  const { state } = useInterview();
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const cameraRef = useCameraRef();
  const [starting, setStarting] = useState(false);

  const granted = cameraPerm?.granted && micPerm?.granted;

  const handleRequestPermissions = async () => {
    await requestCameraPerm();
    await requestMicPerm();
  };

  const handleStart = async () => {
    if (!state.sessionId) return;
    setStarting(true);
    await activateKeepAwakeAsync();
    await startSessionRecording(state.sessionId, cameraRef);
    router.replace("/intro");
  };

  if (!granted) {
    return (
      <View>
        <Text>Görüşmeye Hazırlık</Text>
        <Text>Kamera ve mikrofon erişimi gerekli. İzin vermeden mülakata devam edilemez.</Text>
        <Pressable onPress={handleRequestPermissions}>
          <Text>İzin Ver ve Devam Et</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text>Görüşmeye Hazırlık</Text>
      <Text>Aşağıda kamera önizlemenizi görüyorsunuz — bu önizleme, kalıcı olarak arka planda çalışan CameraHost bileşenindendir (bkz. Task 14).</Text>
      <Pressable onPress={handleStart} disabled={starting}>
        <Text>Mülakata Başla</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- app/__tests__/prep.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/prep.tsx app/__tests__/prep.test.tsx
git commit -m "feat: implement PrepScreen with camera/mic permission flow"
```

---

### Task 16: IntroScreen

**Files:**
- Modify: `app/intro.tsx`
- Test: `app/__tests__/intro.test.tsx`

**Interfaces:**
- Consumes: `startQuestionRecording`/`stopQuestionRecording` (Task 10), `submitAnswer`/`introDone` (Task 2), `useProctor` (Task 11), `playRemoteAudio` (bu görevde yazılır)
- Produces: 2 dakikalık tanıtım kaydı akışı; bitince `/question`'a geçer.

- [ ] **Step 1: `playRemoteAudio.ts`'i yaz (test gerektirmez — ince expo-av sarmalayıcı)**

`src/audio/playRemoteAudio.ts`:

```ts
import { Audio } from "expo-av";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
let currentSound: Audio.Sound | null = null;

export async function playRemoteAudio(fileName: string): Promise<void> {
  if (currentSound) {
    await currentSound.unloadAsync();
    currentSound = null;
  }
  const { sound } = await Audio.Sound.createAsync({ uri: `${BASE}/sesler/${fileName}` });
  currentSound = sound;
  return new Promise((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        resolve();
      }
    });
    sound.playAsync();
  });
}

export async function stopRemoteAudio(): Promise<void> {
  if (currentSound) {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
    currentSound = null;
  }
}
```

- [ ] **Step 2: Testleri yaz**

`app/__tests__/intro.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import IntroScreen from "../intro";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { startQuestionRecording, stopQuestionRecording } from "../../src/recording/questionRecorder";
import { submitAnswer, introDone } from "../../src/api/client";
import { playRemoteAudio } from "../../src/audio/playRemoteAudio";

jest.mock("../../src/recording/questionRecorder");
jest.mock("../../src/api/client");
jest.mock("../../src/audio/playRemoteAudio");
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));

beforeEach(() => {
  jest.mocked(playRemoteAudio).mockResolvedValue();
  jest.mocked(stopQuestionRecording).mockResolvedValue({ transcript: "kendimi tanıtıyorum" });
  jest.mocked(submitAnswer).mockResolvedValue({ saved: true });
  jest.mocked(introDone).mockResolvedValue({ status: "questions" });
});

test("plays welcome audio then starts recording", async () => {
  render(
    <InterviewProvider>
      <IntroScreen />
    </InterviewProvider>
  );

  await waitFor(() => expect(playRemoteAudio).toHaveBeenCalledWith("giris-karsilama.mp3"));
  await waitFor(() => expect(startQuestionRecording).toHaveBeenCalled());
});

test("finishing submits intro-phase answer and advances via introDone", async () => {
  render(
    <InterviewProvider>
      <IntroScreen />
    </InterviewProvider>
  );

  await waitFor(() => screen.getByText("Konuşmayı Bitir"));
  fireEvent.press(screen.getByText("Konuşmayı Bitir"));

  await waitFor(() =>
    expect(submitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "intro", transcript: "kendimi tanıtıyorum" })
    )
  );
  expect(introDone).toHaveBeenCalled();
});
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- app/__tests__/intro.test.tsx`
Expected: FAIL — placeholder ekranda bu akış yok

- [ ] **Step 4: `intro.tsx`'i yaz**

```tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { startQuestionRecording, stopQuestionRecording } from "../src/recording/questionRecorder";
import { submitAnswer, introDone } from "../src/api/client";
import { playRemoteAudio, stopRemoteAudio } from "../src/audio/playRemoteAudio";
import { useProctor } from "../src/hooks/useProctor";

const INTRO_TEXT =
  "Merhaba! Mülakata hoş geldiniz. Lütfen kendinizi kısaca tanıtın. 2 dakikanız var, hazır olduğunuzda konuşmaya başlayabilirsiniz.";

export default function IntroScreen() {
  const router = useRouter();
  const { state } = useInterview();
  useProctor(state.sessionId);
  const [phase, setPhase] = useState<"speaking" | "recording" | "processing">("speaking");
  const [error, setError] = useState<string | null>(null);
  const finishingRef = useRef(false);

  useEffect(() => {
    (async () => {
      await playRemoteAudio("giris-karsilama.mp3");
      if (!state.sessionId) return;
      await startQuestionRecording(state.sessionId);
      setPhase("recording");
    })();
    return () => {
      void stopRemoteAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFinish = async () => {
    if (phase !== "recording" || finishingRef.current) return;
    finishingRef.current = true;
    setPhase("processing");

    try {
      const { transcript } = await stopQuestionRecording();
      await submitAnswer({
        sessionId: state.sessionId!,
        phase: "intro",
        askedText: "Kendinizi kısaca tanıtın",
        transcript: transcript || "(Ses alınamadı)",
      });
      await playRemoteAudio("giris-tesekkur.mp3");
      await introDone(state.sessionId!);
      router.replace("/question");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      finishingRef.current = false;
      setPhase("recording");
    }
  };

  return (
    <View>
      <Text>Kendinizi Tanıtın</Text>
      {phase === "speaking" && <Text>{INTRO_TEXT}</Text>}
      {phase === "recording" && <Text>Kayıt yapılıyor...</Text>}
      {phase === "processing" && <Text>İşleniyor...</Text>}
      {error && <Text>{error}</Text>}
      {phase === "recording" && (
        <Pressable onPress={handleFinish}>
          <Text>Konuşmayı Bitir</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 5: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- app/__tests__/intro.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/audio app/intro.tsx app/__tests__/intro.test.tsx
git commit -m "feat: implement IntroScreen with TTS playback and recording"
```

---

### Task 17: QuestionScreen

**Files:**
- Modify: `app/question.tsx`
- Test: `app/__tests__/question.test.tsx`

**Interfaces:**
- Consumes: `getNextQuestion`, `submitAnswer`, `finishQuestions` (Task 2), `startQuestionRecording`/`stopQuestionRecording` (Task 10), `useProctor` (Task 11), `useNetworkTolerance` (Task 12), `playRemoteAudio` (Task 16)
- Produces: Soru döngüsü — her soru (kod dahil) sözlü sorulur/cevaplanır, `done: true` gelince `finishQuestions` çağrılıp `/evaluating`'e geçilir.

- [ ] **Step 1: Testleri yaz**

`app/__tests__/question.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import QuestionScreen from "../question";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { getNextQuestion, submitAnswer, finishQuestions } from "../../src/api/client";
import { startQuestionRecording, stopQuestionRecording } from "../../src/recording/questionRecorder";
import { playRemoteAudio } from "../../src/audio/playRemoteAudio";

jest.mock("../../src/api/client");
jest.mock("../../src/recording/questionRecorder");
jest.mock("../../src/audio/playRemoteAudio");
jest.mock("../../src/hooks/useNetworkTolerance", () => ({ useNetworkTolerance: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));

beforeEach(() => {
  jest.mocked(playRemoteAudio).mockResolvedValue();
  jest.mocked(stopQuestionRecording).mockResolvedValue({ transcript: "cevabım budur" });
  jest.mocked(submitAnswer).mockResolvedValue({ saved: true });
});

test("loads first question, records answer, and submits it always as verbal — even for code-type questions", async () => {
  jest
    .mocked(getNextQuestion)
    .mockResolvedValueOnce({
      done: false,
      question: {
        id: 1,
        topic: "JavaScript",
        text: "Closure nedir, sözlü açıklayın",
        audioFile: null,
        difficulty: 1,
        type: "code",
        language: "javascript",
        starterCode: null,
      },
      topicNumber: 1,
      totalTopics: 6,
    })
    .mockResolvedValueOnce({ done: true });

  render(
    <InterviewProvider>
      <QuestionScreen />
    </InterviewProvider>
  );

  await waitFor(() => expect(startQuestionRecording).toHaveBeenCalled());
  fireEvent.press(screen.getByText("Cevabı Gönder"));

  await waitFor(() =>
    expect(submitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 1, transcript: "cevabım budur" })
    )
  );
  const call = jest.mocked(submitAnswer).mock.calls[0][0];
  expect(call).not.toHaveProperty("type", "code");
});

test("done:true finishes questions and navigates to evaluating", async () => {
  jest.mocked(getNextQuestion).mockResolvedValueOnce({ done: true });
  jest.mocked(finishQuestions).mockResolvedValue({ status: "evaluating" });

  render(
    <InterviewProvider>
      <QuestionScreen />
    </InterviewProvider>
  );

  await waitFor(() => expect(finishQuestions).toHaveBeenCalled());
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- app/__tests__/question.test.tsx`
Expected: FAIL — placeholder ekranda bu döngü yok

- [ ] **Step 3: `question.tsx`'i yaz**

```tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { getNextQuestion, submitAnswer, finishQuestions } from "../src/api/client";
import type { NextQuestionResponse } from "../src/api/types";
import { startQuestionRecording, stopQuestionRecording } from "../src/recording/questionRecorder";
import { playRemoteAudio } from "../src/audio/playRemoteAudio";
import { useProctor } from "../src/hooks/useProctor";
import { useNetworkTolerance } from "../src/hooks/useNetworkTolerance";

type Phase = "idle" | "speaking" | "recording" | "processing";

export default function QuestionScreen() {
  const router = useRouter();
  const { state, dispatch } = useInterview();
  useProctor(state.sessionId);
  useNetworkTolerance(() => {
    dispatch({ type: "SET_ERROR", error: "Bağlantı kesintisi çok uzun sürdü, mülakat sonlandırıldı." });
    router.replace("/result");
  });

  const [question, setQuestion] = useState<NextQuestionResponse["question"] | null>(null);
  const [topicNumber, setTopicNumber] = useState(0);
  const [totalTopics, setTotalTopics] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadNextQuestion = async () => {
    if (loadingRef.current || !state.sessionId) return;
    loadingRef.current = true;
    setPhase("idle");

    try {
      const data = await getNextQuestion(state.sessionId);

      if (data.done) {
        await finishQuestions(state.sessionId);
        router.replace("/evaluating");
        return;
      }

      setQuestion(data.question!);
      setTopicNumber(data.topicNumber!);
      setTotalTopics(data.totalTopics!);

      if (data.question!.audioFile) {
        setPhase("speaking");
        await playRemoteAudio(data.question!.audioFile);
      }

      setPhase("recording");
      await startQuestionRecording(state.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      loadingRef.current = false;
    }
  };

  const handleFinish = async () => {
    if (phase !== "recording" || !question || !state.sessionId) return;
    setPhase("processing");

    try {
      const { transcript } = await stopQuestionRecording();
      await submitAnswer({
        sessionId: state.sessionId,
        questionId: question.id,
        phase: "main",
        topic: question.topic,
        askedText: question.text,
        transcript: transcript || "(Ses alınamadı)",
        difficulty: question.difficulty,
      });
      await loadNextQuestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setPhase("recording");
    }
  };

  useEffect(() => {
    void loadNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Text>
        Konu {topicNumber}/{totalTopics}
      </Text>
      {question && <Text>{question.text}</Text>}
      {phase === "speaking" && <Text>Soru okunuyor...</Text>}
      {phase === "recording" && <Text>Kayıt yapılıyor...</Text>}
      {phase === "processing" && <Text>Cevabınız işleniyor...</Text>}
      {error && <Text>{error}</Text>}
      {phase === "recording" && (
        <Pressable onPress={handleFinish}>
          <Text>Cevabı Gönder</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- app/__tests__/question.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/question.tsx app/__tests__/question.test.tsx
git commit -m "feat: implement QuestionScreen with verbal-only answer loop"
```

---

### Task 18: EvaluatingScreen

**Files:**
- Modify: `app/evaluating.tsx`
- Test: `app/__tests__/evaluating.test.tsx`

**Interfaces:**
- Consumes: `evaluateSession` (Task 2)
- Produces: Açılışta `evaluateSession` çağırır (web'in `EvaluatingPage.jsx`'i ile aynı davranış — idempotent, `finish-questions`'ın arka planda başlattığı değerlendirmeyle çakışmaz), tamamlanınca `/result`'a geçer.

- [ ] **Step 1: Testleri yaz**

`app/__tests__/evaluating.test.tsx`:

```tsx
import { render, waitFor } from "@testing-library/react-native";
import EvaluatingScreen from "../evaluating";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { evaluateSession } from "../../src/api/client";

jest.mock("../../src/api/client");
const replace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace }) }));

test("calls evaluateSession once on mount and navigates to result", async () => {
  jest.mocked(evaluateSession).mockResolvedValue({ evaluationId: 1, scores: [], overall_comment: "" });

  render(
    <InterviewProvider>
      <EvaluatingScreen />
    </InterviewProvider>
  );

  await waitFor(() => expect(evaluateSession).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/result"));
});

test("shows error message if evaluation fails", async () => {
  jest.mocked(evaluateSession).mockRejectedValue(new Error("Değerlendirme yapılamadı"));

  const { findByText } = render(
    <InterviewProvider>
      <EvaluatingScreen />
    </InterviewProvider>
  );

  expect(await findByText("Değerlendirme yapılamadı")).toBeTruthy();
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- app/__tests__/evaluating.test.tsx`
Expected: FAIL — placeholder ekranda bu davranış yok

- [ ] **Step 3: `evaluating.tsx`'i yaz**

```tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { evaluateSession } from "../src/api/client";

export default function EvaluatingScreen() {
  const router = useRouter();
  const { state } = useInterview();
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current || !state.sessionId) return;
    calledRef.current = true;

    (async () => {
      try {
        await evaluateSession(state.sessionId!);
        router.replace("/result");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Değerlendirme yapılamadı");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Text>Mülakat Tamamlanıyor</Text>
      <Text>Cevaplarınız işleniyor...</Text>
      <ActivityIndicator />
      {error && <Text>{error}</Text>}
    </View>
  );
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- app/__tests__/evaluating.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/evaluating.tsx app/__tests__/evaluating.test.tsx
git commit -m "feat: implement EvaluatingScreen"
```

---

### Task 19: ResultScreen

**Files:**
- Modify: `app/result.tsx`
- Test: `app/__tests__/result.test.tsx`

**Interfaces:**
- Consumes: `stopSessionRecording` (Task 13), `playRemoteAudio` (Task 16), `clearSessionId` (Task 3)
- Produces: Kapanış sesini çalan, oturum kaydını durdurup son segmenti finalize eden, sonra saklı `sessionId`'yi temizleyen ekran.

- [ ] **Step 1: Testleri yaz**

`app/__tests__/result.test.tsx`:

```tsx
import { render, waitFor, screen } from "@testing-library/react-native";
import ResultScreen from "../result";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { stopSessionRecording } from "../../src/recording/sessionRecorder";
import { playRemoteAudio } from "../../src/audio/playRemoteAudio";
import { clearSessionId } from "../../src/storage/session";

jest.mock("../../src/recording/sessionRecorder");
jest.mock("../../src/audio/playRemoteAudio");
jest.mock("../../src/storage/session");

test("plays closing audio, stops session recording, and clears stored session", async () => {
  jest.mocked(playRemoteAudio).mockResolvedValue();
  jest.mocked(stopSessionRecording).mockResolvedValue();

  render(
    <InterviewProvider>
      <ResultScreen />
    </InterviewProvider>
  );

  expect(screen.getByText("Mülakat Tamamlandı")).toBeTruthy();
  await waitFor(() => expect(playRemoteAudio).toHaveBeenCalledWith("kapanis.mp3"));
  await waitFor(() => expect(stopSessionRecording).toHaveBeenCalled());
  await waitFor(() => expect(clearSessionId).toHaveBeenCalled());
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test -- app/__tests__/result.test.tsx`
Expected: FAIL — placeholder ekranda bu davranış yok

- [ ] **Step 3: `result.tsx`'i yaz**

```tsx
import { useEffect } from "react";
import { View, Text } from "react-native";
import { deactivateKeepAwake } from "expo-keep-awake";
import { playRemoteAudio } from "../src/audio/playRemoteAudio";
import { stopSessionRecording } from "../src/recording/sessionRecorder";
import { clearSessionId } from "../src/storage/session";

export default function ResultScreen() {
  useEffect(() => {
    (async () => {
      await playRemoteAudio("kapanis.mp3");
      await stopSessionRecording();
      await clearSessionId();
      deactivateKeepAwake();
    })();
  }, []);

  return (
    <View>
      <Text>Mülakat Tamamlandı</Text>
      <Text>Katılımınız için teşekkür ederiz.</Text>
    </View>
  );
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini doğrula**

Run: `npm test -- app/__tests__/result.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add app/result.tsx app/__tests__/result.test.tsx
git commit -m "feat: implement ResultScreen and finalize session cleanup"
```

---

## Self-Review Notları

**Spec kapsaması:** Tasarım dokümanının her bölümü bir göreve karşılık geliyor — Ekranlar/Bileşenler (Task 6-7, 15-19), Veri Akışı (Task 2, 4-5), Native Modüller/Dayanıklılık (Task 9, 11-14), Hata Yönetimi (her ekran görevinde try/catch + kullanıcıya mesaj), Test Stratejisi (her görev TDD ile ilerliyor; gerçek cihaz manuel test listesi aşağıda). Harici Bağımlılıklar bölümündeki her iki sözleşme de (`segmentIndex`, `encoding`/`sampleRate`) sırasıyla Task 13 ve Task 8'de kullanılıyor.

**Placeholder taraması:** Kod bloklarında TBD/TODO yok; her adımın çalışan, gerçek implementasyonu var.

**Tip tutarlılığı:** `stopQuestionRecording(): Promise<{ transcript: string }>` imzası Task 10, 16, 17'de birebir aynı kullanılıyor; `AnswerPayload`'da `type` alanı hiç yok (Global Constraints ile tutarlı — kod soruları da sözlü gönderiliyor); `resumeSessionRecording`'in `cameraRef` parametresi alması gerektiği Task 13'ün kendi self-review'ında bulunup düzeltildi.

**Mimari boşluk (self-review'da bulundu, düzeltildi):** İlk taslakta `CameraView`, yalnızca `PrepScreen`'de (o zamanki Task 14) render ediliyordu — Expo Router'ın `<Stack>`'i o rotadan ayrılınca bileşeni unmount edeceğinden, oturum kaydı `intro`'ya geçildiği an kesilirdi (web'in `SessionRecordingProvider`'ının "sayfa geçişleri boyunca hayatta kalır" davranışının eksik kalan mobil karşılığı). Düzeltme: yeni Task 14 (CameraHost), kamerayı `Stack`'in kardeşi olarak root layout'ta kalıcı hale getirdi; `PrepScreen` (Task 15) artık kendi `CameraView`'ini render etmiyor, paylaşılan `useCameraRef()`'i kullanıyor. Ayrıca `pauseSessionRecording`/`resumeSessionRecording`'in hiçbir ekrandan çağrılmadığı fark edildi — Task 13'e dahili bir `AppState` dinleyicisi eklenerek bu artık SessionRecorder'ın kendi sorumluluğu yapıldı, ekranların ayrıca wiring yapmasına gerek kalmadı.

**Pre-flight tarama (dispatch öncesi bulundu, düzeltildi):** Global Constraints'te "video klip kalitesi 480p" şart koşulmuş ama Task 13'ün ilk kod bloğunda `recordAsync` çağrısına `quality` hiç geçilmiyordu — Global Constraint ile görev kodu arasında sessiz bir tutarsızlık. `CameraLike.recordAsync` imzasına ve çağrısına `quality: "480p"` eklendi, testteki `objectContaining` beklentisi de güncellendi.

## Manuel Cihaz Testi Kontrol Listesi (implementasyon bitince, her sürüm öncesi)

- [ ] Golden path: login → consent → prep → intro → questions (en az bir "code" tipi soru dahil, sözlü cevaplanmalı) → evaluating → result, gerçek iOS ve Android cihazda.
- [ ] Kamera/mikrofon izni reddedilirse PrepScreen engelleyici mesaj gösteriyor.
- [ ] Mülakat sırasında uygulama arka plana alınıp geri dönülüyor: `useProctor` olayları backend'de görünüyor, video segment(ler)i (video-ai ekibinin `segmentIndex` desteğini tamamladığı andan itibaren) kayıpsız yükleniyor.
- [ ] Wi-Fi kapatılıp 45+ saniye kapalı tutuluyor: mülakat sonlanıyor ve kullanıcıya bilgi veriliyor.
- [ ] Uçak modu kısa süreliğine (10-20sn) açılıp kapatılıyor: mülakat kesintisiz devam ediyor.
- [ ] Uygulama zorla kapatılıp yeniden açılıyor: doğru ekrandan devam ediyor (Task 5).
- [ ] Canlı STT bağlantısı engellenmiş bir ağda (ör. WS portu kapalı bir kurumsal Wi-Fi) test ediliyor: batch fallback'e düşüp cevap kaydediliyor.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-12-mobile-interview-app.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
