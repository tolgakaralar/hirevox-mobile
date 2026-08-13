import { Redirect, useLocalSearchParams } from "expo-router";

// The backend's mail invite link points at the app root (`/?t=<token>`, see
// server/services/mailer.js:53 in the video-ai repo). Without this file, `/`
// had no matching route and Expo Router fell through to its "Unmatched"
// screen. login.tsx already owns the full login UI and its own test
// (app/__tests__/login.test.tsx) exercises it in detail, so this file stays
// a thin forwarder: read the deep-link `t` param here and hand it to
// /login unchanged, rather than duplicating login.tsx's logic.
export default function IndexScreen() {
  const { t } = useLocalSearchParams<{ t?: string }>();
  return <Redirect href={{ pathname: "/login", params: t ? { t } : {} }} />;
}
