import { render, waitFor, screen, fireEvent } from "@testing-library/react-native";
import ResultScreen from "../result";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { stopSessionRecording } from "../../src/recording/sessionRecorder";
import { playRemoteAudio } from "../../src/audio/playRemoteAudio";
import { clearSessionId } from "../../src/storage/session";
import { deactivateKeepAwake } from "expo-keep-awake";

jest.mock("../../src/recording/sessionRecorder");
jest.mock("../../src/audio/playRemoteAudio");
jest.mock("../../src/storage/session");
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
// playRemoteAudio.ts imports expo-audio. Automocking it (no factory above)
// still requires the real module first to infer its shape, and it has no
// jest-expo native mock (see app/__tests__/intro.test.tsx, which mocks it
// the same way), so without this the require above crashes with
// "Cannot find native module 'ExpoAudio'".
jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn().mockImplementation(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  })),
}));
// Mocked (rather than left as the real module, which works fine unmocked —
// see app/prep.tsx's activateKeepAwakeAsync usage, untouched in
// prep.test.tsx) purely so the resilience test below can assert
// deactivateKeepAwake was reached even when earlier cleanup steps reject.
jest.mock("expo-keep-awake", () => ({
  deactivateKeepAwake: jest.fn(),
  activateKeepAwakeAsync: jest.fn(),
}));

test("plays closing audio, stops session recording, and clears stored session", async () => {
  jest.mocked(playRemoteAudio).mockResolvedValue();
  jest.mocked(stopSessionRecording).mockResolvedValue();

  render(
    <InterviewProvider>
      <ResultScreen />
    </InterviewProvider>
  );

  expect(screen.getByText("Mülakat Tamamlandı")).toBeTruthy();
  await waitFor(() => expect(playRemoteAudio).toHaveBeenCalledWith("kapanis.mp3"));
  await waitFor(() => expect(stopSessionRecording).toHaveBeenCalled());
  await waitFor(() => expect(clearSessionId).toHaveBeenCalled());
});

test("still clears the session and deactivates keep-awake when earlier cleanup steps fail", async () => {
  // playRemoteAudio (network-dependent) and stopSessionRecording both reject
  // here, simulating e.g. a network error during closing-audio playback and
  // an in-flight clip failure. clearSessionId must still run — otherwise the
  // stored sessionId lingers and _layout.tsx's resume logic would keep
  // redirecting back to /result on next launch — and deactivateKeepAwake
  // must still run in all cases, or the screen would never sleep again.
  jest.mocked(playRemoteAudio).mockRejectedValue(new Error("network error"));
  jest.mocked(stopSessionRecording).mockRejectedValue(new Error("clip failed"));

  render(
    <InterviewProvider>
      <ResultScreen />
    </InterviewProvider>
  );

  await waitFor(() => expect(clearSessionId).toHaveBeenCalled());
  await waitFor(() => expect(deactivateKeepAwake).toHaveBeenCalled());
});

test('pressing "Bitti" returns to the login screen', async () => {
  jest.mocked(playRemoteAudio).mockResolvedValue();
  jest.mocked(stopSessionRecording).mockResolvedValue();

  render(
    <InterviewProvider>
      <ResultScreen />
    </InterviewProvider>
  );

  fireEvent.press(screen.getByText("Bitti"));

  expect(mockReplace).toHaveBeenCalledWith("/login");
});
