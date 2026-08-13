import { useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import PrepScreen from "../prep";
import { InterviewProvider, useInterview } from "../../src/state/InterviewContext";
import { CameraRefProvider } from "../../src/recording/CameraRefContext";
import { startSessionRecording } from "../../src/recording/sessionRecorder";

jest.mock("../../src/recording/sessionRecorder");
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("expo-camera", () => ({
  useCameraPermissions: () => [{ granted: false }, jest.fn().mockResolvedValue({ granted: true })],
  useMicrophonePermissions: () => [{ granted: false }, jest.fn().mockResolvedValue({ granted: true })],
}));

// PrepScreen guards session start on state.sessionId (same convention as
// consent.tsx). The real InterviewProvider starts with sessionId: null, so
// this seeds it the way login.tsx would before a user ever reaches /prep.
function SeedSession() {
  const { dispatch } = useInterview();
  useEffect(() => {
    dispatch({ type: "SET_SESSION", sessionId: "test-session-id" });
  }, [dispatch]);
  return null;
}

function renderPrep() {
  return render(
    <InterviewProvider>
      <CameraRefProvider>
        <SeedSession />
        <PrepScreen />
      </CameraRefProvider>
    </InterviewProvider>
  );
}

test("shows permission blocked message before permissions are granted", () => {
  renderPrep();
  expect(screen.getByText(/Kamera ve mikrofon erişimi gerekli/)).toBeTruthy();
});

test("pressing start requests permissions then begins session recording", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  fireEvent.press(screen.getByText("Mülakata Başla"));
  await waitFor(() => expect(startSessionRecording).toHaveBeenCalled());
});
