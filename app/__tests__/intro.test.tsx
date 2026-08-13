import { useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import IntroScreen from "../intro";
import { InterviewProvider, useInterview } from "../../src/state/InterviewContext";
import { startQuestionRecording, stopQuestionRecording } from "../../src/recording/questionRecorder";
import { submitAnswer, introDone } from "../../src/api/client";
import { playRemoteAudio } from "../../src/audio/playRemoteAudio";

jest.mock("../../src/recording/questionRecorder");
jest.mock("../../src/api/client");
jest.mock("../../src/audio/playRemoteAudio");
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
// questionRecorder.ts and playRemoteAudio.ts both import expo-av, and
// questionRecorder.ts also imports react-native-live-audio-stream.
// Automocking them (no factory above) still requires the real modules first
// to infer their shape, and neither has a jest-expo native mock (see
// src/recording/__tests__/questionRecorder.test.ts, which mocks both the
// same way), so without this the requires above crash — first with
// "Cannot find native module 'ExponentAV'", then with a NativeEventEmitter
// invariant violation from react-native-live-audio-stream.
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
    Sound: { createAsync: jest.fn() },
  },
}));

// IntroScreen guards startQuestionRecording/submitAnswer/introDone on
// state.sessionId (same convention as prep.tsx / consent.tsx). The real
// InterviewProvider starts with sessionId: null, so this seeds it the way
// login.tsx would before a user ever reaches /intro.
//
// IntroScreen only mounts IntroScreen itself once seeding is done (rather
// than mounting SeedSession and IntroScreen as siblings from the start).
// IntroScreen's own effect has an empty dependency array and runs exactly
// once on mount, closing over state.sessionId as of that first render; if
// IntroScreen mounted before the seed dispatch's re-render landed, that
// closure would be permanently stuck with sessionId: null (a test-harness
// artifact — in the real app IntroScreen is only ever reached by navigation
// after login.tsx has already set sessionId, so it never mounts with a null
// value in the first place).
function SeedSession() {
  const { dispatch } = useInterview();
  useEffect(() => {
    dispatch({ type: "SET_SESSION", sessionId: "test-session-id" });
  }, [dispatch]);
  return null;
}

function RenderAfterSeed() {
  const { state } = useInterview();
  if (!state.sessionId) return <SeedSession />;
  return <IntroScreen />;
}

function renderIntro() {
  return render(
    <InterviewProvider>
      <RenderAfterSeed />
    </InterviewProvider>
  );
}

beforeEach(() => {
  // Automocked modules keep their call history across tests within this
  // file (jest.config.js has no clearMocks/resetMocks set), which the
  // original tests never noticed since they only asserted with
  // toHaveBeenCalledWith. The retry regression test below asserts on call
  // *counts*, so history from earlier tests needs to be cleared first.
  jest.clearAllMocks();
  jest.mocked(playRemoteAudio).mockResolvedValue();
  jest.mocked(stopQuestionRecording).mockResolvedValue({ transcript: "kendimi tanıtıyorum" });
  jest.mocked(submitAnswer).mockResolvedValue({ saved: true });
  jest.mocked(introDone).mockResolvedValue({ status: "questions" });
});

test("plays welcome audio then starts recording", async () => {
  renderIntro();

  await waitFor(() => expect(playRemoteAudio).toHaveBeenCalledWith("giris-karsilama.mp3"));
  await waitFor(() => expect(startQuestionRecording).toHaveBeenCalled());
});

test("finishing submits intro-phase answer and advances via introDone", async () => {
  renderIntro();

  await waitFor(() => screen.getByText("Konuşmayı Bitir"));
  fireEvent.press(screen.getByText("Konuşmayı Bitir"));

  await waitFor(() =>
    expect(submitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "intro", transcript: "kendimi tanıtıyorum" })
    )
  );
  expect(introDone).toHaveBeenCalled();
});

// CRITICAL 4: stopQuestionRecording() tears down the recorder (mode/socket/
// recording all go back to null in questionRecorder.ts). If submitAnswer
// rejects (e.g. a network blip) and the user retries, calling
// stopQuestionRecording() a second time hits that torn-down recorder and
// resolves with {transcript: ""} — silently replacing the user's real
// answer with the "(Ses alınamadı)" fallback on the retried submission.
test("submitAnswer network error then retry resends the real transcript, not the fallback", async () => {
  jest.mocked(submitAnswer).mockRejectedValueOnce(new Error("Ağ hatası")).mockResolvedValueOnce({ saved: true });

  renderIntro();

  await waitFor(() => screen.getByText("Konuşmayı Bitir"));
  fireEvent.press(screen.getByText("Konuşmayı Bitir"));

  await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(1));
  await waitFor(() => screen.getByText("Konuşmayı Bitir"));

  fireEvent.press(screen.getByText("Konuşmayı Bitir"));

  await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(2));
  const secondCallArgs = jest.mocked(submitAnswer).mock.calls[1][0];
  expect(secondCallArgs).toMatchObject({ transcript: "kendimi tanıtıyorum" });
  expect(stopQuestionRecording).toHaveBeenCalledTimes(1);
});
