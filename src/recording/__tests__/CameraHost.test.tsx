import { AppState } from "react-native";
import { render, waitFor, act } from "@testing-library/react-native";
import { CameraHost } from "../CameraHost";
import { CameraRefProvider } from "../CameraRefContext";
import { triggerCameraReset } from "../cameraResetSignal";

const mockUsePathname = jest.fn();
jest.mock("expo-router", () => ({ usePathname: () => mockUsePathname() }));

// Defaults to granted so the existing mode-by-route tests below (which
// don't care about permissions) keep exercising the already-granted case,
// matching the common path once PrepScreen has gotten the user through.
let mockPermissionGranted = true;
let lastProps: Record<string, unknown> = {};
jest.mock("expo-camera", () => {
  const { useState } = require("react");
  // Stateful (via useState), same as the real expo-modules-core permission
  // hook: `get`/`request` must call the setter so a permission change is
  // actually reflected in a re-render, not just recomputed on the next one
  // that happens to occur for some other reason.
  const hook = () => {
    const [status, setStatus] = useState({ granted: mockPermissionGranted });
    const refresh = async () => {
      const next = { granted: mockPermissionGranted };
      setStatus(next);
      return next;
    };
    return [status, refresh, refresh];
  };
  return {
    CameraView: (props: Record<string, unknown>) => {
      lastProps = props;
      return null;
    },
    useCameraPermissions: hook,
    useMicrophonePermissions: hook,
  };
});

let appStateHandler: (state: string) => void = () => {};

beforeEach(() => {
  mockPermissionGranted = true;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    appStateHandler = handler as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
});

test("full-size visible style while on /prep", () => {
  mockUsePathname.mockReturnValue("/prep");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ position: "absolute", top: 0, left: 0, right: 0 });
  expect(lastProps.mode).toBe("video");
  expect(lastProps.videoQuality).toBe("480p");
});

// GitHub finding: denying camera/mic permission makes the live feed go
// black (no permission, nothing to show) but the "Şu an kaydedilmiyorsunuz"
// preview banner stayed on screen anyway, since CameraHost picked its mode
// purely off the route and had no idea permission was missing. The banner
// (and camera box) must hide together with the feed, and come back
// together once permission is granted again.
test("falls back to hidden mode on /prep when camera/mic permission isn't granted, hiding the preview banner too", () => {
  mockPermissionGranted = false;
  mockUsePathname.mockReturnValue("/prep");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ width: 1, height: 1, opacity: 0 });
});

test("returns to full-size /prep mode once permission is granted after returning to foreground", async () => {
  mockPermissionGranted = false;
  mockUsePathname.mockReturnValue("/prep");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ width: 1, height: 1, opacity: 0 });

  mockPermissionGranted = true;
  appStateHandler("active");

  await waitFor(() =>
    expect(lastProps.style).toMatchObject({ position: "absolute", top: 0, left: 0, right: 0 })
  );
});

// GitHub finding: returning to a fresh PrepScreen after a full interview
// cycle (Result's "Bitti" -> Login -> re-login -> Consent -> Prep, all
// within the same app run, no relaunch) showed a frozen camera preview —
// the native capture session apparently doesn't cleanly resume live
// frames on its own after stopSessionRecording()'s stopRecording() call.
// expo-camera's `active` prop exists precisely to force-restart the
// session without unmounting (required — CameraView must never unmount,
// see CLAUDE.md); stopSessionRecording() fires this signal once recording
// is fully done, CameraHost consumes it here.
test("toggles the camera off and back on when a camera reset is signaled, to force a fresh session without unmounting", () => {
  jest.useFakeTimers();
  mockUsePathname.mockReturnValue("/prep");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.active).not.toBe(false);

  act(() => triggerCameraReset());
  expect(lastProps.active).toBe(false);

  act(() => jest.runAllTimers());
  expect(lastProps.active).toBe(true);

  jest.useRealTimers();
});

test.each(["/intro", "/question"])("PiP style while on %s", (pathname) => {
  mockUsePathname.mockReturnValue(pathname);
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ width: 112, aspectRatio: 3 / 4 });
  expect(lastProps.mode).toBe("video");
  expect(lastProps.videoQuality).toBe("480p");
});

test("hidden 1x1 style on any other route, e.g. /evaluating", () => {
  mockUsePathname.mockReturnValue("/evaluating");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ width: 1, height: 1, opacity: 0 });
  expect(lastProps.mode).toBe("video");
  expect(lastProps.videoQuality).toBe("480p");
});
