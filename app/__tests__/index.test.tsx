import { render } from "@testing-library/react-native";
import IndexScreen from "../index";

const redirectCalls: Record<string, unknown>[] = [];

jest.mock("expo-router", () => ({
  Redirect: (props: Record<string, unknown>) => {
    redirectCalls.push(props);
    return null;
  },
}));

beforeEach(() => {
  redirectCalls.length = 0;
});

// CRITICAL 1: the mail invite link points at the root path (`/`, see
// server/services/mailer.js in the video-ai repo), but app/ had no
// index.tsx, so Expo Router fell through to its "Unmatched" screen and the
// entry point 404'd. index.tsx exists purely to forward `/` to `/login`.
// The link no longer carries a personal token (video-ai removed that system
// 2026-08-18, see docs/features/2026-08-18-kisiye-ozel-giris-linkini-kaldir.md
// in that repo), so there's nothing left to forward — just redirect.
test("redirects the app root to /login", () => {
  render(<IndexScreen />);
  expect(redirectCalls).toHaveLength(1);
  expect(redirectCalls[0].href).toBe("/login");
});
