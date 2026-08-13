import { useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
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
// questionRecorder.ts and playRemoteAudio.ts both import expo-av, and
// questionRecorder.ts also imports react-native-live-audio-stream.
// Automocking them (no factory above) still requires the real modules first
// to infer their shape, and neither has a jest-expo native mock (see
// src/recording/__tests__/questionRecorder.test.ts and app/__tests__/intro.test.tsx,
// which mock both the same way), so without this the requires above crash —
// first with "Cannot find native module 'ExponentAV'", then with a
// NativeEventEmitter invariant violation from react-native-live-audio-stream.
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

test("done:true finishes questions and navigates to evaluating", async () => {
  jest.mocked(getNextQuestion).mockResolvedValueOnce({ done: true });
  jest.mocked(finishQuestions).mockResolvedValue({ status: "evaluating" });

  renderQuestion();

  await waitFor(() => expect(finishQuestions).toHaveBeenCalled());
});
