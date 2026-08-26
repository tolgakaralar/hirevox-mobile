import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ConsentScreen from "../consent";
import { InterviewProvider, useInterview } from "../../src/state/InterviewContext";
import { consent } from "../../src/api/client";

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock("../../src/api/client");
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack }) }));
jest.mock("../../src/state/InterviewContext", () => ({
  InterviewProvider: ({ children }: { children: any }) => children,
  useInterview: () => ({
    state: { sessionId: "test-session-id", error: null },
    dispatch: jest.fn(),
  }),
}));

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
});

test("submit button disabled until monitoring checkbox is checked", () => {
  render(<ConsentScreen />);
  const button = screen.getByText("Görüşmeye Gir");
  expect(button).toBeDisabled();
});

test("checking consent and submitting calls consent API and navigates to prep", async () => {
  (consent as jest.Mock).mockResolvedValue({ status: "intro" });
  render(<ConsentScreen />);

  fireEvent.press(screen.getByRole("checkbox"));
  fireEvent.press(screen.getByText("Görüşmeye Gir"));

  await waitFor(() => expect(consent).toHaveBeenCalled());
});

test("back arrow navigates to the previous screen", () => {
  render(<ConsentScreen />);
  fireEvent.press(screen.getByLabelText("Geri"));
  expect(mockBack).toHaveBeenCalled();
});
