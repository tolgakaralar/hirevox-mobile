import type { RefObject } from "react";
import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import { createUploadQueue } from "./uploadQueue";
import { uploadVideoChunk, finalizeVideoSegment } from "../api/client";
import { triggerCameraReset } from "./cameraResetSignal";

interface CameraLike {
  // Matches expo-camera's real CameraView.recordAsync signature: no `quality`
  // option exists there (video quality is controlled via the CameraView's
  // `videoQuality` prop instead, see Task 14), and the result can be
  // `undefined` (e.g. recording was interrupted before any data was captured).
  recordAsync: (opts: { maxDuration: number }) => Promise<{ uri: string } | undefined>;
  stopRecording: () => void;
}

const CLIP_MAX_DURATION_SEC = 60;

let currentSessionId: string | null = null;
let currentSegmentIndex = 0;
let currentCameraRef: RefObject<CameraLike | null> | null = null;
let looping = false;
let inFlightClip: Promise<{ uri: string } | undefined> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let wasBackgrounded = false;
// Bumped on every start/resume so a clip loop that outlives its session (e.g. one
// left running because pause/stop was never called) can recognize it has been
// superseded and stop scheduling further clips instead of recording into whatever
// session/cameraRef happens to be current later.
let generation = 0;

const queue = createUploadQueue(async (item: { sessionId: string; segmentIndex: number; uri: string }) => {
  await uploadVideoChunk(item.sessionId, item.segmentIndex, item.uri, "video/mp4");
  await finalizeVideoSegment(item.sessionId, item.segmentIndex);
});

async function recordOneClip(myGeneration: number): Promise<void> {
  if (!currentCameraRef?.current || !currentSessionId) return;
  const segmentIndex = currentSegmentIndex++;
  // Captured up front: by the time this clip's promise settles, pause()/stop()
  // or a brand-new session may already have reset the module-level session id
  // (or a later clip may already be in flight). Using the captured values, and
  // only clearing `inFlightClip` if it still points at *this* clip's promise,
  // keeps a late-arriving settle from clobbering a newer clip's state or
  // enqueuing under the wrong (possibly null) sessionId.
  const mySessionId = currentSessionId;
  const clip = currentCameraRef.current.recordAsync({ maxDuration: CLIP_MAX_DURATION_SEC });
  inFlightClip = clip;
  let uri: string | undefined;
  try {
    const result = await clip;
    uri = result?.uri;
  } catch {
    // recordAsync can reject (camera interrupted, permission revoked, etc.).
    // Treat it the same as an empty result: skip this clip and keep looping
    // rather than leaving inFlightClip permanently rejected, which would make
    // every future pause()/stop() throw when they await it.
    uri = undefined;
  } finally {
    if (inFlightClip === clip) inFlightClip = null;
  }
  if (uri) {
    queue.enqueue({ sessionId: mySessionId, segmentIndex, uri });
  }

  // Defer the next clip to a macrotask instead of recursing straight through the
  // await chain. A direct recursive `await recordOneClip()` here never yields to
  // the event loop when recordAsync resolves promptly, which starves timers
  // indefinitely and also lets the loop race ahead of pause()/stop() calls made
  // by the caller right after start()/resume() resolve.
  const timer: unknown = setTimeout(() => {
    if (looping && generation === myGeneration) void recordOneClip(myGeneration);
  }, 0);
  // In a Node/Jest environment setTimeout returns a Timeout with unref(), letting
  // a still-looping recorder (e.g. one a test never explicitly stopped) avoid
  // keeping the process alive. React Native's setTimeout returns a plain number
  // with no unref, so this is a no-op there.
  if (timer && typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
}

function onAppStateChange(nextState: AppStateStatus): void {
  if (nextState === "background" || nextState === "inactive") {
    if (!wasBackgrounded) {
      wasBackgrounded = true;
      void pauseSessionRecording();
    }
  } else if (nextState === "active" && wasBackgrounded) {
    wasBackgrounded = false;
    void resumeSessionRecording();
  }
}

export async function startSessionRecording(
  sessionId: string,
  cameraRef: RefObject<CameraLike | null>
): Promise<void> {
  currentSessionId = sessionId;
  currentCameraRef = cameraRef;
  currentSegmentIndex = 0;
  wasBackgrounded = false;
  looping = true;
  generation++;
  appStateSubscription = AppState.addEventListener("change", onAppStateChange);
  void recordOneClip(generation);
}

export async function pauseSessionRecording(): Promise<void> {
  looping = false;
  currentCameraRef?.current?.stopRecording();
  // recordOneClip already handles a rejected clip internally; this await is
  // only here to block until the in-flight clip has settled, so swallow the
  // rejection rather than letting it propagate out of pause().
  if (inFlightClip) await inFlightClip.catch(() => undefined);
}

export async function resumeSessionRecording(cameraRef?: RefObject<CameraLike | null>): Promise<void> {
  if (cameraRef) currentCameraRef = cameraRef;
  looping = true;
  generation++;
  void recordOneClip(generation);
}

export async function stopSessionRecording(): Promise<void> {
  looping = false;
  appStateSubscription?.remove();
  appStateSubscription = null;
  currentCameraRef?.current?.stopRecording();
  // See pauseSessionRecording: don't let a rejected in-flight clip stop us
  // from reaching queue.drain() and uploading everything already enqueued.
  if (inFlightClip) await inFlightClip.catch(() => undefined);
  await queue.drain();
  currentSessionId = null;
  currentCameraRef = null;
  // Recording is fully, definitely done now — safe point to force-refresh
  // a possibly-stuck preview before the next interview (if any) reaches
  // PrepScreen again in this same app run.
  triggerCameraReset();
}
