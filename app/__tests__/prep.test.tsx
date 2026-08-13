import { useEffect } from "react";
import { Dimensions } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import PrepScreen from "../prep";
import { InterviewProvider, useInterview } from "../../src/state/InterviewContext";
import { CameraRefProvider } from "../../src/recording/CameraRefContext";
import { startSessionRecording } from "../../src/recording/sessionRecorder";

jest.mock("../../src/recording/sessionRecorder");
// Module-level so tests can assert on which route PrepScreen navigates to
// (a fresh jest.fn() per render, as before, can never be asserted on).
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
// The real useCameraPermissions/useMicrophonePermissions hooks are stateful:
// calling requestPermission() updates the hook's own state and triggers a
// re-render with granted: true (see expo-modules-core's PermissionsHook).
// Mirror that here instead of a stateless mock, so PrepScreen's
// `cameraPerm?.granted && micPerm?.granted` check is exercised for real.
jest.mock("expo-camera", () => {
  const { useState } = require("react");
  const hook = () => {
    const [permission, setPermission] = useState({ granted: false });
    const request = async () => {
      const granted = { granted: true };
      setPermission(granted);
      return granted;
    };
    return [permission, request];
  };
  return { useCameraPermissions: hook, useMicrophonePermissions: hook };
});

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

// CRITICAL 2: ResumeGate (_layout.tsx) routes a session resumed mid-recording
// through /prep with resumeTarget set to where the user actually was
// (question/intro/evaluating), instead of the normal fresh-start "created"
// flow that has no resumeTarget and always continues to /intro.
function SeedResumedSession() {
  const { dispatch } = useInterview();
  useEffect(() => {
    dispatch({ type: "SET_SESSION", sessionId: "test-session-id" });
    dispatch({ type: "SET_RESUME_TARGET", target: "question" });
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

function renderResumedPrep() {
  return render(
    <InterviewProvider>
      <CameraRefProvider>
        <SeedResumedSession />
        <PrepScreen />
      </CameraRefProvider>
    </InterviewProvider>
  );
}

beforeEach(() => {
  mockReplace.mockClear();
});

test("shows permission blocked message before permissions are granted", () => {
  renderPrep();
  expect(screen.getByText(/Kamera ve mikrofon erişimi gerekli/)).toBeTruthy();
});

// CRITICAL 5: CameraHost's "/prep" preview band is position:absolute,
// full-width, aspectRatio 3/4 (~screenWidth * 4/3 tall) and renders as a
// sibling after PrepScreen in _layout.tsx's tree, so it visually sits on
// top of PrepScreen's content — including the "Mülakata Başla" button,
// making it untappable. PrepScreen must reserve that much space at the top
// so its content (and the button) renders below the preview instead of
// underneath it.
test("reserves space for the camera preview band so content isn't covered, before permissions are granted", () => {
  renderPrep();
  const previewHeight = Dimensions.get("window").width * (4 / 3);
  const content = screen.getByTestId("prep-content");
  expect(content.props.style).toMatchObject({ paddingTop: previewHeight });
});

test("reserves space for the camera preview band so the start button isn't covered, after permissions are granted", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  const previewHeight = Dimensions.get("window").width * (4 / 3);
  const content = screen.getByTestId("prep-content");
  expect(content.props.style).toMatchObject({ paddingTop: previewHeight });
});

test("pressing start requests permissions then begins session recording, then continues to /intro by default", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  fireEvent.press(screen.getByText("Mülakata Başla"));
  await waitFor(() => expect(startSessionRecording).toHaveBeenCalled());
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/intro"));
});

test("resumed session (resumeTarget set) restarts recording then continues to the original page, not /intro", async () => {
  renderResumedPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  fireEvent.press(screen.getByText("Mülakata Başla"));
  await waitFor(() => expect(startSessionRecording).toHaveBeenCalled());
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/question"));
  expect(mockReplace).not.toHaveBeenCalledWith("/intro");
});
