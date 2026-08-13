# Final Review Backlog — Important Findings

Source: final whole-branch code review of `docs/superpowers/plans/2026-08-12-mobile-interview-app.md` (2026-08-13), commit range `de35868..0b4b301`. The 5 Critical findings from the same review were fixed immediately (see git log after this file's commit). These 11 Important findings were deferred — real issues, but not blocking merge of the golden path fix.

Intended as a temporary local backlog until this repo has a GitHub remote / `gh` CLI set up, at which point each item below should become its own GitHub issue and this file can be deleted.

---

## 1. Upload queue durability — partial

Design spec requires file-system-backed retry (`expo-file-system`) with NetInfo-triggered `retry()`. The Critical-fix wave implemented this for the *forward* path (new uploads queue to disk, retry on reconnect). Still open: bootstrapping stale queue entries left on disk from a previous killed session back into the queue on next app launch. Low frequency (only matters if the app is killed while segments are still pending), but real data-loss-shaped gap.

**File:** `src/recording/uploadQueue.ts`, `app/_layout.tsx` (bootstrap point)

## 2. TTS/question-load failure recovery

`question.tsx`: if `playRemoteAudio` rejects, the design spec says "TTS çalınamazsa sessiz geçilir" (continue silently, text is already shown) — verify the Critical-fix wave's change to this actually matches; if `getNextQuestion`/`startQuestionRecording` fails, there should be a retry affordance rather than a dead `phase: "idle"` state.

**File:** `app/question.tsx`

## 3. Connectivity-termination UX and cleanup

When `useNetworkTolerance` terminates the interview: `ResultScreen` should tell the candidate the interview was cut short (not "tamamlandı"), the recorder/socket should be stopped, an integrity event should be logged, and `finishQuestions` should be called so the backend session isn't left stranded in `questions` status.

**Files:** `app/question.tsx`, `app/result.tsx`

## 4. Unmount cleanup for active recording

Neither `intro.tsx` nor `question.tsx` stops an in-progress recording/live-STT-socket if the screen unmounts mid-recording (e.g. forced navigation). Leaks a hot mic + open WebSocket.

**Files:** `app/intro.tsx`, `app/question.tsx`

## 5. EvaluatingScreen stuck spinner on failure

No retry affordance; `ActivityIndicator` spins forever if `evaluateSession` fails.

**File:** `app/evaluating.tsx`

## 6. IntroScreen mount effect has no try/catch

Unhandled rejection possible from `playRemoteAudio`/`startQuestionRecording` on mount; `phase` gets stuck at `"speaking"` with no recovery path. (`handleRetry` already exists in the file — just needs to be reachable from this failure.)

**File:** `app/intro.tsx`

## 7. PrepScreen error handling + settings escape hatch

No try/catch around `handleStart`/`handleRequestPermissions`; `starting` never resets on failure (button permanently disabled). Spec requires a "Ayarlar'a git" (open Settings) path for permanently-denied permissions — `expo-linking` is installed but unused for this.

**File:** `app/prep.tsx`

## 8. Planning-language leak in user-facing copy

"(bkz. Task 14)" shipped in candidate-visible text.

**File:** `app/prep.tsx`

## 9. `sessionRecorder.ts` gives up permanently on a transient null camera ref

`recordOneClip` returns early with no reschedule if `currentCameraRef.current` is momentarily null — the clip loop dies for the rest of the session instead of retrying with backoff.

**File:** `src/recording/sessionRecorder.ts`

## 10. No 2-minute cap on the intro recording

`IntroScreen` tells the candidate "2 dakikanız var" but nothing enforces it — recording runs until the candidate manually stops.

**File:** `app/intro.tsx`

## 11. Misc polish (bundle if convenient, not urgent individually)

- `openSttSocket`'s timeout branch never calls `.close()` on a late-connecting socket (leak).
- `sttSocket.ts` uses a non-null assertion on `EXPO_PUBLIC_API_BASE_URL` at module scope — crashes with an opaque error if unset, instead of a clear startup message.
- No logging/telemetry anywhere — every failure path is silently swallowed, making field issues undiagnosable.
- `app.json` still has placeholder domain `interview.hirevox.example` — must be swapped before a real build.
- No `SafeAreaView`/notch-safe styling on any screen (`react-native-safe-area-context` is installed, unused).
- Test hygiene: no `resetMocks`/`clearMocks` in jest config, several suites are run-order-dependent; `consent.test.tsx` still stubs the whole `InterviewContext` module instead of using the real reducer (parked since Task 7).
- `LICENSE` is Expo's own MIT boilerplate (should be replaced or removed for a private app); `AGENTS.md` is unrequested scaffold clutter.
