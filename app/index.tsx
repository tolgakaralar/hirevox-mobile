import { Redirect } from "expo-router";

// The backend's mail invite link points at the app root (`/`, see
// server/services/mailer.js in the video-ai repo). Without this file, `/`
// had no matching route and Expo Router fell through to its "Unmatched"
// screen. The link no longer carries a personal token (video-ai removed
// that system 2026-08-18, see
// docs/features/2026-08-18-kisiye-ozel-giris-linkini-kaldir.md in that
// repo) — login.tsx now only needs the access code, so this file stays a
// thin forwarder with nothing left to pass through.
export default function IndexScreen() {
  return <Redirect href="/login" />;
}
