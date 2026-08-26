import { AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import type { AudioRecorder } from "expo-audio";
import LiveAudioStream from "react-native-live-audio-stream";
import { toByteArray } from "base64-js";
import { openSttSocket, sendAudioChunk, finishSttSocket } from "./sttSocket";
import { transcribeAudioFile } from "../api/client";

type Mode = "live" | "batch" | null;

let mode: Mode = null;
let socket: WebSocket | null = null;
let recorder: AudioRecorder | null = null;

export async function startQuestionRecording(sessionId: string): Promise<void> {
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

  socket = await openSttSocket(sessionId);

  if (socket) {
    mode = "live";
    LiveAudioStream.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      bufferSize: 4096,
      wavFile: "questionRecorder.wav",
    });
    LiveAudioStream.on("data", (base64Chunk: string) => {
      if (!socket) return;
      sendAudioChunk(socket, toByteArray(base64Chunk));
    });
    LiveAudioStream.start();
    return;
  }

  mode = "batch";
  recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
  await recorder.prepareToRecordAsync();
  recorder.record();
}

export async function stopQuestionRecording(): Promise<{ transcript: string }> {
  if (mode === "live" && socket) {
    LiveAudioStream.stop();
    const result = await finishSttSocket(socket);
    socket = null;
    mode = null;
    return result;
  }

  if (mode === "batch" && recorder) {
    await recorder.stop();
    const uri = recorder.uri;
    recorder = null;
    mode = null;
    if (!uri) return { transcript: "" };
    return transcribeAudioFile(uri, "audio/m4a");
  }

  return { transcript: "" };
}
