import { render, waitFor } from "@testing-library/react-native";
import RootLayout from "../_layout";
import { loadSessionId } from "../../src/storage/session";
import { getSession } from "../../src/api/client";

jest.mock("../../src/storage/session");
jest.mock("../../src/api/client");

// CRITICAL 3: the previous inline mock (`useRouter: () => ({ replace: jest.fn() })`)
// returned a brand-new jest.fn() on every render, so no test could ever hold a
// reference to the fn that was actually called and assert on it — this is why
// the original tests never caught router.replace being invoked before Stack had
// mounted (and silently dropped by Expo Router as a result). A module-level fn,
// cleared between tests, makes the call itself assertable.
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  Stack: () => null,
  Redirect: () => null,
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/",
}));
jest.mock("expo-camera", () => ({ CameraView: () => null }));

beforeEach(() => {
  mockReplace.mockClear();
});

test("no stored session: stays on login, does not call getSession", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue(null);
  render(<RootLayout />);
  await waitFor(() => expect(loadSessionId).toHaveBeenCalled());
  expect(getSession).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("stored session with status 'created': resumes straight to consent (no recording to restart)", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue("s1");
  (getSession as jest.Mock).mockResolvedValue({ id: "s1", status: "created" });
  render(<RootLayout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/consent"));
});

// CRITICAL 2: resuming mid-recording (intro/questions/evaluating) must not
// jump straight to that page — startSessionRecording/activateKeepAwakeAsync
// only ever run from PrepScreen's "Mülakata Başla" button, so a direct jump
// would silently skip camera recording and keep-awake entirely. The gate
// must route through /prep first.
test("stored session with status 'questions': resumes through /prep to restart recording", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue("s1");
  (getSession as jest.Mock).mockResolvedValue({ id: "s1", status: "questions" });
  render(<RootLayout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/prep"));
});

test("stored session with status 'intro': also resumes through /prep to restart recording", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue("s1");
  (getSession as jest.Mock).mockResolvedValue({ id: "s1", status: "intro" });
  render(<RootLayout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/prep"));
});

test("stored session with status 'evaluating': also resumes through /prep to restart recording", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue("s1");
  (getSession as jest.Mock).mockResolvedValue({ id: "s1", status: "evaluating" });
  render(<RootLayout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/prep"));
});

test("stored session with status 'done': does not crash, resumes straight to result", async () => {
  (loadSessionId as jest.Mock).mockResolvedValue("s1");
  (getSession as jest.Mock).mockResolvedValue({ id: "s1", status: "done" });
  render(<RootLayout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/result"));
});
