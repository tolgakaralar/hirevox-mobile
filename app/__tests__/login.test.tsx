import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "../login";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { login } from "../../src/api/client";
import { saveSessionId } from "../../src/storage/session";

jest.mock("../../src/api/client");
jest.mock("../../src/storage/session");
jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ t: "deep-link-token" })),
  useRouter: () => ({ replace: jest.fn() }),
}));

function renderLogin() {
  return render(
    <InterviewProvider>
      <LoginScreen />
    </InterviewProvider>
  );
}

beforeEach(() => {
  jest.mocked(require("expo-router").useLocalSearchParams).mockReturnValue({ t: "deep-link-token" });
});

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
