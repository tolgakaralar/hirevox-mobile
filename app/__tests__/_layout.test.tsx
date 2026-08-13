import { render, waitFor } from "@testing-library/react-native";
import RootLayout from "../_layout";
import { loadSessionId } from "../../src/storage/session";
import { getSession } from "../../src/api/client";
import { useInterview } from "../../src/state/InterviewContext";

jest.mock("../../src/storage/session");
jest.mock("../../src/api/client");
jest.mock("expo-router", () => ({
  Stack: () => null,
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/",
}));
jest.mock("expo-camera", () => ({ CameraView: () => null }));

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
