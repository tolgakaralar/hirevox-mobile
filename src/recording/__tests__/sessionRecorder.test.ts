import { AppState } from "react-native";
import {
  startSessionRecording,
  pauseSessionRecording,
  resumeSessionRecording,
  stopSessionRecording,
} from "../sessionRecorder";
import { uploadVideoChunk, finalizeVideoSegment } from "../../api/client";
import { subscribeCameraReset } from "../cameraResetSignal";

jest.mock("../../api/client");

let appStateHandler: (state: string) => void;

beforeEach(() => {
  jest.mocked(uploadVideoChunk).mockResolvedValue({ saved: true });
  jest.mocked(finalizeVideoSegment).mockResolvedValue({ saved: true, videoPath: "x" });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    appStateHandler = handler as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
});

function fakeCameraRef(uri = "file:///tmp/clip-0.mp4") {
  return {
    current: {
      recordAsync: jest.fn().mockResolvedValue({ uri }),
      stopRecording: jest.fn(),
    },
  } as unknown as React.RefObject<{ recordAsync: jest.Mock; stopRecording: jest.Mock }>;
}

test("starting recording begins segment 0 and uploads it once the clip resolves", async () => {
  const ref = fakeCameraRef();
  await startSessionRecording("s1", ref as never);

  expect(ref.current!.recordAsync).toHaveBeenCalledWith(expect.objectContaining({ maxDuration: 60 }));
  await ref.current!.recordAsync.mock.results[0].value;

  expect(uploadVideoChunk).toHaveBeenCalledWith("s1", 0, "file:///tmp/clip-0.mp4", "video/mp4");
  expect(finalizeVideoSegment).toHaveBeenCalledWith("s1", 0);
});

test("pause stops current clip and resume starts a new segmentIndex", async () => {
  const ref = fakeCameraRef();
  await startSessionRecording("s1", ref as never);
  await pauseSessionRecording();

  expect(ref.current!.stopRecording).toHaveBeenCalledTimes(1);

  await resumeSessionRecording(ref as never);
  expect(ref.current!.recordAsync).toHaveBeenCalledTimes(2);
});

test("stop finalizes the current in-flight segment and drains the queue", async () => {
  const ref = fakeCameraRef();
  await startSessionRecording("s1", ref as never);
  await stopSessionRecording();

  expect(ref.current!.stopRecording).toHaveBeenCalled();
  expect(finalizeVideoSegment).toHaveBeenCalled();
});

// GitHub finding: the live camera preview could come back frozen when a
// fresh interview starts later in the same app run (no relaunch) — the
// native session apparently doesn't reliably resume live frames on its
// own after stopRecording(). Signaling a reset here (once recording is
// fully, definitely done) lets CameraHost force-restart its session via
// expo-camera's `active` prop toggle.
test("stop signals a camera reset so CameraHost can refresh a possibly-stuck preview for the next session", async () => {
  const ref = fakeCameraRef();
  const onReset = jest.fn();
  subscribeCameraReset(onReset);

  await startSessionRecording("s1", ref as never);
  await stopSessionRecording();

  expect(onReset).toHaveBeenCalledTimes(1);
});

test("AppState transition to background auto-pauses; returning to active auto-resumes", async () => {
  const ref = fakeCameraRef();
  await startSessionRecording("s1", ref as never);

  appStateHandler("background");
  expect(ref.current!.stopRecording).toHaveBeenCalledTimes(1);

  appStateHandler("active");
  expect(ref.current!.recordAsync).toHaveBeenCalledTimes(2);
});
