import { interviewReducer, initialInterviewState } from "../interviewReducer";

test("SET_SESSION stores sessionId and advances to consent", () => {
  const next = interviewReducer(initialInterviewState, { type: "SET_SESSION", sessionId: "s1" });
  expect(next).toEqual({ sessionId: "s1", page: "consent", error: null, resumeTarget: null });
});

// CRITICAL 2: a resumed session that was mid-recording (intro/questions/
// evaluating) must restart proctoring via PrepScreen before continuing, but
// PrepScreen still needs to know where to send the user afterwards instead
// of always going to /intro. resumeTarget carries that "continue here once
// recording has restarted" destination.
test("SET_RESUME_TARGET stores the page to continue to once recording restarts", () => {
  const next = interviewReducer(initialInterviewState, { type: "SET_RESUME_TARGET", target: "question" });
  expect(next.resumeTarget).toBe("question");
});

test("SET_RESUME_TARGET can be cleared back to null once consumed", () => {
  const withTarget = { ...initialInterviewState, resumeTarget: "question" as const };
  const next = interviewReducer(withTarget, { type: "SET_RESUME_TARGET", target: null });
  expect(next.resumeTarget).toBeNull();
});

test("SET_PAGE changes page and clears error", () => {
  const withError = { ...initialInterviewState, error: "boom" };
  const next = interviewReducer(withError, { type: "SET_PAGE", page: "prep" });
  expect(next.page).toBe("prep");
  expect(next.error).toBeNull();
});

test("SET_ERROR stores the error message", () => {
  const next = interviewReducer(initialInterviewState, { type: "SET_ERROR", error: "ağ hatası" });
  expect(next.error).toBe("ağ hatası");
});

test("RESET returns to initial state", () => {
  const modified = { sessionId: "s1", page: "question" as const, error: "x", resumeTarget: "question" as const };
  expect(interviewReducer(modified, { type: "RESET" })).toEqual(initialInterviewState);
});
