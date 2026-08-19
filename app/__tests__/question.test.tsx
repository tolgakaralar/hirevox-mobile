import { useEffect } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import QuestionScreen from "../question";
import { InterviewProvider, useInterview } from "../../src/state/InterviewContext";
import { getNextQuestion, submitAnswer, finishQuestions } from "../../src/api/client";
import { startQuestionRecording, stopQuestionRecording } from "../../src/recording/questionRecorder";
import { playRemoteAudio } from "../../src/audio/playRemoteAudio";

jest.mock("../../src/api/client");
jest.mock("../../src/recording/questionRecorder");
jest.mock("../../src/audio/playRemoteAudio");
jest.mock("../../src/hooks/useNetworkTolerance", () => ({ useNetworkTolerance: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
// questionRecorder.ts and playRemoteAudio.ts both import expo-audio, and
// questionRecorder.ts also imports react-native-live-audio-stream.
// Automocking them (no factory above) still requires the real modules first
// to infer their shape, and neither has a jest-expo native mock (see
// src/recording/__tests__/questionRecorder.test.ts and app/__tests__/intro.test.tsx,
// which mock both the same way), so without this the requires above crash —
// first with "Cannot find native module 'ExpoAudio'", then with a
// NativeEventEmitter invariant violation from react-native-live-audio-stream.
jest.mock("react-native-live-audio-stream", () => ({
  init: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
}));
jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(),
  RecordingPresets: { HIGH_QUALITY: {} },
  AudioModule: {
    AudioRecorder: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(),
      record: jest.fn(),
      stop: jest.fn(),
      uri: "file:///tmp/rec.m4a",
    })),
  },
  createAudioPlayer: jest.fn().mockImplementation(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  })),
}));

// QuestionScreen guards loadNextQuestion on state.sessionId (same convention
// as intro.tsx / prep.tsx). The real InterviewProvider starts with
// sessionId: null, so this seeds it the way login.tsx would before a user
// ever reaches /question.
//
// QuestionScreen only mounts QuestionScreen itself once seeding is done
// (rather than mounting SeedSession and QuestionScreen as siblings from the
// start). QuestionScreen's own effect has an empty dependency array and runs
// exactly once on mount, closing over state.sessionId as of that first
// render; if QuestionScreen mounted before the seed dispatch's re-render
// landed, that closure would be permanently stuck with sessionId: null (a
// test-harness artifact — in the real app QuestionScreen is only ever
// reached by navigation after login.tsx has already set sessionId, so it
// never mounts with a null value in the first place).
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
  return <QuestionScreen />;
}

function renderQuestion() {
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
  jest.mocked(stopQuestionRecording).mockResolvedValue({ transcript: "cevabım budur" });
  jest.mocked(submitAnswer).mockResolvedValue({ saved: true });
});

test("loads first question, records answer, and submits it always as verbal — even for code-type questions", async () => {
  jest
    .mocked(getNextQuestion)
    .mockResolvedValueOnce({
      done: false,
      question: {
        id: 1,
        topic: "JavaScript",
        text: "Closure nedir, sözlü açıklayın",
        audioFile: null,
        difficulty: 1,
        type: "code",
        language: "javascript",
        starterCode: null,
      },
      topicNumber: 1,
      totalTopics: 6,
    })
    .mockResolvedValueOnce({ done: true });

  renderQuestion();

  await waitFor(() => expect(startQuestionRecording).toHaveBeenCalled());
  fireEvent.press(screen.getByText("Cevabı Gönder"));

  await waitFor(() =>
    expect(submitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 1, transcript: "cevabım budur" })
    )
  );
  const call = jest.mocked(submitAnswer).mock.calls[0][0];
  expect(call).not.toHaveProperty("type", "code");
});

test("elapsed counts up and the 2-minute countdown counts down together, once recording", async () => {
  jest.mocked(getNextQuestion).mockResolvedValueOnce({
    done: false,
    question: {
      id: 1,
      topic: "JavaScript",
      text: "Closure nedir, sözlü açıklayın",
      audioFile: null,
      difficulty: 1,
      type: "verbal",
      language: null,
      starterCode: null,
    },
    topicNumber: 1,
    totalTopics: 6,
  });

  jest.useFakeTimers({ advanceTimers: true });
  render(
    <InterviewProvider>
      <RenderAfterSeed />
    </InterviewProvider>
  );

  await waitFor(() => expect(startQuestionRecording).toHaveBeenCalled());
  expect(screen.getByText("02:00")).toBeTruthy();
  expect(screen.getByText("Geçen süre: 0:00")).toBeTruthy();

  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(screen.getByText("01:57")).toBeTruthy();
  expect(screen.getByText("Geçen süre: 0:03")).toBeTruthy();

  jest.useRealTimers();
});

test("done:true finishes questions and navigates to evaluating", async () => {
  jest.mocked(getNextQuestion).mockResolvedValueOnce({ done: true });
  jest.mocked(finishQuestions).mockResolvedValue({ status: "evaluating" });

  renderQuestion();

  await waitFor(() => expect(finishQuestions).toHaveBeenCalled());
});

// CRITICAL 4: stopQuestionRecording() tears down the recorder (mode/socket/
// recording all go back to null in questionRecorder.ts). If submitAnswer
// rejects (e.g. a network blip) and the user retries, calling
// stopQuestionRecording() a second time hits that torn-down recorder and
// resolves with {transcript: ""} — silently replacing the user's real
// answer with the "(Ses alınamadı)" fallback on the retried submission.
test("submitAnswer network error then retry resends the real transcript, not the fallback", async () => {
  jest.mocked(getNextQuestion).mockResolvedValueOnce({
    done: false,
    question: {
      id: 1,
      topic: "JavaScript",
      text: "Closure nedir, sözlü açıklayın",
      audioFile: null,
      difficulty: 1,
      type: "verbal",
      language: null,
      starterCode: null,
    },
    topicNumber: 1,
    totalTopics: 6,
  });
  jest.mocked(submitAnswer).mockRejectedValueOnce(new Error("Ağ hatası")).mockResolvedValueOnce({ saved: true });

  renderQuestion();

  await waitFor(() => expect(startQuestionRecording).toHaveBeenCalled());
  fireEvent.press(screen.getByText("Cevabı Gönder"));

  await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(1));
  await waitFor(() => screen.getByText("Cevabı Gönder"));

  fireEvent.press(screen.getByText("Cevabı Gönder"));

  await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(2));
  const secondCallArgs = jest.mocked(submitAnswer).mock.calls[1][0];
  expect(secondCallArgs).toMatchObject({ questionId: 1, transcript: "cevabım budur" });
  expect(stopQuestionRecording).toHaveBeenCalledTimes(1);
});
