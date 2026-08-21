import { useEffect } from "react";
import { AppState, Dimensions, Linking, StyleSheet } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import LiveAudioStream from "react-native-live-audio-stream";
import { fromByteArray } from "base64-js";
import PrepScreen from "../prep";
import { InterviewProvider, useInterview } from "../../src/state/InterviewContext";
import { CameraRefProvider } from "../../src/recording/CameraRefContext";
import { startSessionRecording } from "../../src/recording/sessionRecorder";

jest.mock("../../src/recording/sessionRecorder");
// useMicLevel (mic-level meter on this screen) uses this under the hood.
jest.mock("react-native-live-audio-stream", () => ({
  init: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
}));
// Module-level so tests can assert on which route PrepScreen navigates to
// (a fresh jest.fn() per render, as before, can never be asserted on).
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
// Module-level so tests can simulate the permission state changing outside
// the app (e.g. the user flipping it in iOS Settings) and then trigger the
// hook's `get` method to pick that change up, same as the real
// expo-modules-core hook's getPermission does (see PermissionsHook.ts).
let mockPermissionState: { granted: boolean; canAskAgain: boolean; status: string } = {
  granted: false,
  canAskAgain: true,
  status: "undetermined",
};
// The real useCameraPermissions/useMicrophonePermissions hooks are stateful:
// calling requestPermission() updates the hook's own state and triggers a
// re-render with granted: true (see expo-modules-core's PermissionsHook).
// Mirror that here instead of a stateless mock, so PrepScreen's
// `cameraPerm?.granted && micPerm?.granted` check is exercised for real.
// Also mirror the real hook's 3-tuple return ([status, request, get]) so
// PrepScreen's foreground re-check (via the `get` method) is exercised too.
jest.mock("expo-camera", () => {
  const { useState } = require("react");
  const hook = () => {
    const [permission, setPermission] = useState(mockPermissionState);
    const request = async () => {
      const granted = { granted: true, canAskAgain: true, status: "granted" };
      mockPermissionState = granted;
      setPermission(granted);
      return granted;
    };
    const get = async () => {
      setPermission(mockPermissionState);
      return mockPermissionState;
    };
    return [permission, request, get];
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

let appStateHandler: (state: string) => void = () => {};

beforeEach(() => {
  mockReplace.mockClear();
  mockPermissionState = { granted: false, canAskAgain: true, status: "undetermined" };
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    appStateHandler = handler as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
  jest.spyOn(Linking, "openSettings").mockImplementation(() => Promise.resolve());
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
// GitHub finding (#40): before permissions are granted, CameraHost renders
// in its "hidden" mode — no preview band on screen at all (see
// CameraHost.test.tsx's own "falls back to hidden mode ... when permission
// isn't granted"). Reserving top space for a preview that isn't there
// pushed the blocked-permission message and "Ayarlar'a Git"/"İzin Ver ve
// Devam Et" button down near the bottom of the screen instead of near the
// top where there's nothing else competing for space.
test("does not reserve camera-preview space before permissions are granted, since there's no preview band to avoid covering", () => {
  renderPrep();
  const previewHeight = Dimensions.get("window").width * (4 / 3);
  const content = screen.getByTestId("prep-content");
  expect(StyleSheet.flatten(content.props.style).paddingTop).not.toBe(previewHeight);
});

// GitHub finding: once the previous fix dropped the preview-height top
// padding for the blocked-permission branch, its content had nothing else
// pushing it below the device's top inset (notch/speaker cutout) — the
// SafeAreaView here was `edges: ["bottom"]` only, a deliberate choice for
// the granted branch where CameraHost's own full-bleed preview already
// covers that area, but wrong for the blocked branch where there's no
// preview at all and the logo/text needs the safe top inset itself.
test("respects the top safe-area inset before permissions are granted, so the logo isn't cut off by the notch/speaker", () => {
  renderPrep();
  const safeArea = screen.getByTestId("prep-safe-area");
  expect(safeArea.props.edges).toMatchObject({ top: "additive" });
});

test("does not add extra top safe-area inset once permission is granted, since CameraHost's preview already fills that area", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  const safeArea = screen.getByTestId("prep-safe-area");
  expect(safeArea.props.edges).toMatchObject({ top: "off" });
});

test("reserves space for the camera preview band so the start button isn't covered, after permissions are granted", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  const previewHeight = Dimensions.get("window").width * (4 / 3);
  const content = screen.getByTestId("prep-content");
  expect(StyleSheet.flatten(content.props.style).paddingTop).toBe(previewHeight);
});

test("pressing start requests permissions then begins session recording, then continues to /intro by default", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  fireEvent.press(screen.getByText("Mülakata Başla"));
  await waitFor(() => expect(startSessionRecording).toHaveBeenCalled());
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/intro"));
});

// GitHub finding: the "Mikrofon seviyesi" bar was a hardcoded 12%-width
// View with no metering behind it at all, despite the hint text right next
// to it ("Konuştuğunuzda çubuğun hareket etmesi gerekir.") promising it
// reacts to speech. It now reads live levels from the same LiveAudioStream
// PCM feed the real question recorder streams to STT (via useMicLevel).
test("mic level bar reflects live microphone input once permission is granted", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  const onDataCall = (LiveAudioStream.on as jest.Mock).mock.calls.find(([event]) => event === "data");
  const onData = onDataCall![1] as (chunk: string) => void;

  const loudBytes = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    loudBytes[i * 2] = 0xff;
    loudBytes[i * 2 + 1] = 0x7f;
  }
  act(() => onData(fromByteArray(loudBytes)));

  const bar = screen.getByTestId("mic-level-bar");
  expect(StyleSheet.flatten(bar.props.style).width).not.toBe("12%");
});

// Metering and the real interview recording both use LiveAudioStream —
// they must never run at once, so metering has to stop before the real
// recording (started inside handleStart, on the way to /intro) begins.
test("starting the interview stops mic-level metering before handing off to the real recording", async () => {
  renderPrep();
  fireEvent.press(screen.getByText("İzin Ver ve Devam Et"));
  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());

  fireEvent.press(screen.getByText("Mülakata Başla"));
  await waitFor(() => expect(LiveAudioStream.stop).toHaveBeenCalled());
});

// GitHub issue: denying camera/mic permission via iOS Settings before
// opening the app leaves canAskAgain: false. Calling requestPermission()
// again in that state is a no-op on real iOS (the OS only shows its native
// prompt once) — "İzin Ver ve Devam Et" silently does nothing. The screen
// must offer a way to iOS Settings instead once the OS says it won't ask again.
test("shows 'Ayarlar'a Git' instead of the request button once permission can no longer be asked for again", () => {
  mockPermissionState = { granted: false, canAskAgain: false, status: "denied" };
  renderPrep();

  expect(screen.getByText("Ayarlar'a Git")).toBeTruthy();
  expect(screen.queryByText("İzin Ver ve Devam Et")).toBeNull();
});

test("pressing 'Ayarlar'a Git' opens the system settings app", () => {
  mockPermissionState = { granted: false, canAskAgain: false, status: "denied" };
  renderPrep();

  fireEvent.press(screen.getByText("Ayarlar'a Git"));
  expect(Linking.openSettings).toHaveBeenCalled();
});

test("re-checks permission when the app returns to foreground, so granting it in Settings unblocks the screen without a manual retry", async () => {
  mockPermissionState = { granted: false, canAskAgain: false, status: "denied" };
  renderPrep();
  expect(screen.getByText("Ayarlar'a Git")).toBeTruthy();

  // user leaves the app, grants access in iOS Settings, comes back
  mockPermissionState = { granted: true, canAskAgain: true, status: "granted" };
  appStateHandler("active");

  await waitFor(() => expect(screen.getByText("Mülakata Başla")).toBeTruthy());
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
