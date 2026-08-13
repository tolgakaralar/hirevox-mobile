import { render, waitFor, screen } from "@testing-library/react-native";
import ResultScreen from "../result";
import { InterviewProvider } from "../../src/state/InterviewContext";
import { stopSessionRecording } from "../../src/recording/sessionRecorder";
import { playRemoteAudio } from "../../src/audio/playRemoteAudio";
import { clearSessionId } from "../../src/storage/session";

jest.mock("../../src/recording/sessionRecorder");
jest.mock("../../src/audio/playRemoteAudio");
jest.mock("../../src/storage/session");
// playRemoteAudio.ts imports expo-av. Automocking it (no factory above) still
// requires the real module first to infer its shape, and it has no
// jest-expo native mock (see app/__tests__/intro.test.tsx, which mocks it
// the same way), so without this the require above crashes with
// "Cannot find native module 'ExponentAV'".
jest.mock("expo-av", () => ({
  Audio: {
    Sound: { createAsync: jest.fn() },
  },
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
