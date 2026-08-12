import { interviewReducer, initialInterviewState } from "../interviewReducer";

test("SET_SESSION stores sessionId and advances to consent", () => {
  const next = interviewReducer(initialInterviewState, { type: "SET_SESSION", sessionId: "s1" });
  expect(next).toEqual({ sessionId: "s1", page: "consent", error: null });
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
  const modified = { sessionId: "s1", page: "question" as const, error: "x" };
  expect(interviewReducer(modified, { type: "RESET" })).toEqual(initialInterviewState);
});
