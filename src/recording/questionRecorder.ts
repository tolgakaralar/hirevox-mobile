import { Audio } from "expo-av";
import LiveAudioStream from "react-native-live-audio-stream";
import { toByteArray } from "base64-js";
import { openSttSocket, sendAudioChunk, finishSttSocket } from "./sttSocket";
import { transcribeAudioFile } from "../api/client";

type Mode = "live" | "batch" | null;

let mode: Mode = null;
let socket: WebSocket | null = null;
let recording: Audio.Recording | null = null;

export async function startQuestionRecording(sessionId: string): Promise<void> {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

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
  recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
}

export async function stopQuestionRecording(): Promise<{ transcript: string }> {
  if (mode === "live" && socket) {
    LiveAudioStream.stop();
    const result = await finishSttSocket(socket);
    socket = null;
    mode = null;
    return result;
  }

  if (mode === "batch" && recording) {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    mode = null;
    if (!uri) return { transcript: "" };
    return transcribeAudioFile(uri, "audio/m4a");
  }

  return { transcript: "" };
}
