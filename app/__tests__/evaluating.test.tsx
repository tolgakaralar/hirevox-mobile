import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react-native";
import EvaluatingScreen from "../evaluating";
import { InterviewProvider, useInterview } from "../../src/state/InterviewContext";
import { evaluateSession } from "../../src/api/client";

jest.mock("../../src/api/client");
// Jest's module-factory hoisting forbids referencing out-of-scope variables
// inside jest.mock() unless the name is prefixed with "mock" (case
// insensitive) — see https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter.
// None of the other app/__tests__/*.test.tsx files assert on router.replace,
// so they can inline `replace: jest.fn()` directly; this test needs to
// capture the fn to assert navigation to /result, hence mockReplace.
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

// EvaluatingScreen guards evaluateSession on state.sessionId (same convention
// as intro.tsx / prep.tsx / question.tsx). The real InterviewProvider starts
// with sessionId: null, so this seeds it the way login.tsx would before a
// user ever reaches /evaluating.
//
// EvaluatingScreen only mounts EvaluatingScreen itself once seeding is done
// (rather than mounting SeedSession and EvaluatingScreen as siblings from the
// start). EvaluatingScreen's own effect has an empty dependency array and
// runs exactly once on mount, closing over state.sessionId as of that first
// render; if EvaluatingScreen mounted before the seed dispatch's re-render
// landed, that closure would be permanently stuck with sessionId: null (a
// test-harness artifact — in the real app EvaluatingScreen is only ever
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
  return <EvaluatingScreen />;
}

function renderEvaluating() {
  return render(
    <InterviewProvider>
      <RenderAfterSeed />
    </InterviewProvider>
  );
}

beforeEach(() => {
  mockReplace.mockClear();
});

test("calls evaluateSession once on mount and navigates to result", async () => {
  jest.mocked(evaluateSession).mockResolvedValue({ evaluationId: 1, scores: [], overall_comment: "" });

  renderEvaluating();

  await waitFor(() => expect(evaluateSession).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/result"));
});

test("shows error message if evaluation fails", async () => {
  jest.mocked(evaluateSession).mockRejectedValue(new Error("Değerlendirme yapılamadı"));

  const { findByText } = renderEvaluating();

  expect(await findByText("Değerlendirme yapılamadı")).toBeTruthy();
});
