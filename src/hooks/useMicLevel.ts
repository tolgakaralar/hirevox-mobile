import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import LiveAudioStream from "react-native-live-audio-stream";
import { toByteArray } from "base64-js";
import { computeRmsLevel } from "../utils/audioLevel";

// Live mic-level meter for screens that show a "speak and watch the bar
// move" indicator (PrepScreen) before the real interview recording starts.
// Reuses the same LiveAudioStream PCM config the real question recorder
// (questionRecorder.ts) streams to the STT socket, just for metering here
// instead — the two are never active at once, since callers are expected
// to call the returned `stop` before handing off to the real recording.
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  const runningRef = useRef(false);

  const stop = useCallback(() => {
    if (!runningRef.current) return;
    runningRef.current = false;
    LiveAudioStream.stop();
    setLevel(0);
  }, []);

  const start = useCallback(() => {
    runningRef.current = true;
    LiveAudioStream.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      bufferSize: 4096,
      wavFile: "micLevelMeter.wav",
    });
    LiveAudioStream.on("data", (base64Chunk: string) => {
      setLevel(computeRmsLevel(toByteArray(base64Chunk)));
    });
    LiveAudioStream.start();
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    start();

    // iOS suspends microphone capture while the app is backgrounded (same
    // as it does the camera — see CameraHost/sessionRecorder) and doesn't
    // resume producing data on its own once foregrounded again, so the
    // stream has to be explicitly restarted. Same AppState "active" check
    // PrepScreen/CameraHost already use to re-check permission.
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && runningRef.current) {
        stop();
        start();
      }
    });

    return () => {
      subscription.remove();
      stop();
    };
  }, [active, start, stop]);

  return { level, stop };
}
