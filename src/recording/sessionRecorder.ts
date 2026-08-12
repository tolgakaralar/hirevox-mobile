import type { RefObject } from "react";
import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import { createUploadQueue } from "./uploadQueue";
import { uploadVideoChunk, finalizeVideoSegment } from "../api/client";

interface CameraLike {
  recordAsync: (opts: { maxDuration: number; quality: string }) => Promise<{ uri: string }>;
  stopRecording: () => void;
}

const CLIP_MAX_DURATION_SEC = 60;
const CLIP_QUALITY = "480p";

let currentSessionId: string | null = null;
let currentSegmentIndex = 0;
let currentCameraRef: RefObject<CameraLike> | null = null;
let looping = false;
let inFlightClip: Promise<{ uri: string }> | null = null;
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
  inFlightClip = currentCameraRef.current.recordAsync({ maxDuration: CLIP_MAX_DURATION_SEC, quality: CLIP_QUALITY });
  const { uri } = await inFlightClip;
  inFlightClip = null;
  queue.enqueue({ sessionId: currentSessionId, segmentIndex, uri });

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

export async function startSessionRecording(sessionId: string, cameraRef: RefObject<CameraLike>): Promise<void> {
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
  if (inFlightClip) await inFlightClip;
}

export async function resumeSessionRecording(cameraRef?: RefObject<CameraLike>): Promise<void> {
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
  if (inFlightClip) await inFlightClip;
  await queue.drain();
  currentSessionId = null;
  currentCameraRef = null;
}
