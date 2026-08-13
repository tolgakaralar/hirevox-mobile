import { render } from "@testing-library/react-native";
import IndexScreen from "../index";

const mockUseLocalSearchParams = jest.fn();
const redirectCalls: Record<string, unknown>[] = [];

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  Redirect: (props: Record<string, unknown>) => {
    redirectCalls.push(props);
    return null;
  },
}));

beforeEach(() => {
  redirectCalls.length = 0;
});

// CRITICAL 1: the mail deep link points at the root path (`/?t=<token>`, see
// server/services/mailer.js:53 in the video-ai repo), but app/ had no
// index.tsx, so Expo Router fell through to its "Unmatched" screen and the
// entry point 404'd. index.tsx now exists purely to forward `/` to `/login`,
// preserving the `t` query param so login.tsx's own useLocalSearchParams
// read still works exactly as before.
test("forwards the deep-link token to /login", () => {
  mockUseLocalSearchParams.mockReturnValue({ t: "deep-link-token" });
  render(<IndexScreen />);
  expect(redirectCalls).toHaveLength(1);
  expect(redirectCalls[0].href).toEqual({
    pathname: "/login",
    params: { t: "deep-link-token" },
  });
});

test("still redirects to /login when opened without a token", () => {
  mockUseLocalSearchParams.mockReturnValue({});
  render(<IndexScreen />);
  expect(redirectCalls).toHaveLength(1);
  expect(redirectCalls[0].href).toEqual({
    pathname: "/login",
    params: {},
  });
});
