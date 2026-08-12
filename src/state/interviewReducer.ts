export type InterviewPage = "login" | "consent" | "prep" | "intro" | "question" | "evaluating" | "result";

export interface InterviewState {
  sessionId: string | null;
  page: InterviewPage;
  error: string | null;
}

export type InterviewAction =
  | { type: "SET_SESSION"; sessionId: string }
  | { type: "SET_PAGE"; page: InterviewPage }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

export const initialInterviewState: InterviewState = {
  sessionId: null,
  page: "login",
  error: null,
};

export function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case "SET_SESSION":
      return { ...state, sessionId: action.sessionId, page: "consent", error: null };
    case "SET_PAGE":
      return { ...state, page: action.page, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "RESET":
      return initialInterviewState;
    default:
      return state;
  }
}
