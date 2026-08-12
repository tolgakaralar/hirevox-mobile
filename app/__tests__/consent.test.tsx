import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ConsentScreen from "../consent";
import { InterviewProvider, useInterview } from "../../src/state/InterviewContext";
import { consent } from "../../src/api/client";

jest.mock("../../src/api/client");
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../../src/state/InterviewContext", () => ({
  InterviewProvider: ({ children }: { children: any }) => children,
  useInterview: () => ({
    state: { sessionId: "test-session-id", error: null },
    dispatch: jest.fn(),
  }),
}));

test("submit button disabled until monitoring checkbox is checked", () => {
  render(<ConsentScreen />);
  const button = screen.getByText("Görüşmeye Gir");
  expect(button).toBeDisabled();
});

test("checking consent and submitting calls consent API and navigates to prep", async () => {
  (consent as jest.Mock).mockResolvedValue({ status: "intro" });
  render(<ConsentScreen />);

  fireEvent(screen.getByRole("checkbox"), "valueChange", true);
  fireEvent.press(screen.getByText("Görüşmeye Gir"));

  await waitFor(() => expect(consent).toHaveBeenCalled());
});
