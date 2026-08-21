import { renderHook, act } from "@testing-library/react-native";
import LiveAudioStream from "react-native-live-audio-stream";
import { fromByteArray } from "base64-js";
import { useMicLevel } from "../useMicLevel";

jest.mock("react-native-live-audio-stream", () => ({
  init: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
}));

function loudChunkBase64(): string {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    bytes[i * 2] = 0xff;
    bytes[i * 2 + 1] = 0x7f;
  }
  return fromByteArray(bytes);
}

function emitData(chunkBase64: string) {
  const dataCall = (LiveAudioStream.on as jest.Mock).mock.calls.find(([event]) => event === "data");
  const onData = dataCall![1] as (chunk: string) => void;
  act(() => onData(chunkBase64));
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("inactive: does not start the audio stream, level stays 0", () => {
  const { result } = renderHook(() => useMicLevel(false));
  expect(LiveAudioStream.init).not.toHaveBeenCalled();
  expect(LiveAudioStream.start).not.toHaveBeenCalled();
  expect(result.current.level).toBe(0);
});

test("active: starts the same PCM stream config the real question recorder uses", () => {
  renderHook(() => useMicLevel(true));
  expect(LiveAudioStream.init).toHaveBeenCalledWith(
    expect.objectContaining({ sampleRate: 16000, channels: 1, bitsPerSample: 16 })
  );
  expect(LiveAudioStream.start).toHaveBeenCalled();
});

test("active: incoming audio data updates the level", () => {
  const { result } = renderHook(() => useMicLevel(true));
  emitData(loudChunkBase64());
  expect(result.current.level).toBeGreaterThan(0);
});

test("becoming inactive stops the stream and resets the level to 0", () => {
  const { result, rerender } = renderHook(({ active }: { active: boolean }) => useMicLevel(active), {
    initialProps: { active: true },
  });
  emitData(loudChunkBase64());
  expect(result.current.level).toBeGreaterThan(0);

  rerender({ active: false });
  expect(LiveAudioStream.stop).toHaveBeenCalled();
  expect(result.current.level).toBe(0);
});

test("unmounting while active stops the stream", () => {
  const { unmount } = renderHook(() => useMicLevel(true));
  unmount();
  expect(LiveAudioStream.stop).toHaveBeenCalled();
});

// PrepScreen must be able to guarantee the metering stream is torn down
// before handing off to the real interview recording (which starts its own
// LiveAudioStream session) — waiting for the unmount-on-navigate cleanup
// isn't reliable enough for that ordering, so `stop` is exposed directly.
test("calling the returned stop() stops the stream immediately, for callers that must guarantee ordering before starting the real recording", () => {
  const { result } = renderHook(() => useMicLevel(true));
  act(() => result.current.stop());
  expect(LiveAudioStream.stop).toHaveBeenCalled();
});
