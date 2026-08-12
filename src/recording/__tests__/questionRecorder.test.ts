import { startQuestionRecording, stopQuestionRecording } from "../questionRecorder";
import { openSttSocket, sendAudioChunk, finishSttSocket } from "../sttSocket";
import { transcribeAudioFile } from "../../api/client";
import LiveAudioStream from "react-native-live-audio-stream";
import { Audio } from "expo-av";

jest.mock("../sttSocket");
jest.mock("../../api/client");
jest.mock("react-native-live-audio-stream", () => ({
  init: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
}));
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn(),
      getURI: jest.fn(() => "file:///tmp/rec.m4a"),
    })),
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

const fakeWs = { readyState: 1 } as unknown as WebSocket;

test("live path: opens socket and streams via LiveAudioStream when connection succeeds", async () => {
  (openSttSocket as jest.Mock).mockResolvedValue(fakeWs);

  await startQuestionRecording("s1");

  expect(LiveAudioStream.init).toHaveBeenCalledWith(
    expect.objectContaining({ sampleRate: 16000, channels: 1, bitsPerSample: 16 })
  );
  expect(LiveAudioStream.start).toHaveBeenCalled();
});

test("live path: stop sends final stop message and returns its transcript", async () => {
  (openSttSocket as jest.Mock).mockResolvedValue(fakeWs);
  (finishSttSocket as jest.Mock).mockResolvedValue({ transcript: "canlı transkript" });

  await startQuestionRecording("s1");
  const result = await stopQuestionRecording();

  expect(LiveAudioStream.stop).toHaveBeenCalled();
  expect(result).toEqual({ transcript: "canlı transkript" });
});

test("fallback path: batch-records with expo-av when socket fails to open", async () => {
  (openSttSocket as jest.Mock).mockResolvedValue(null);
  (transcribeAudioFile as jest.Mock).mockResolvedValue({ transcript: "batch transkript" });

  await startQuestionRecording("s1");
  const result = await stopQuestionRecording();

  expect(transcribeAudioFile).toHaveBeenCalledWith("file:///tmp/rec.m4a", "audio/m4a");
  expect(result).toEqual({ transcript: "batch transkript" });
});
