import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { interviewReducer, initialInterviewState, type InterviewState, type InterviewAction } from "./interviewReducer";

const InterviewContext = createContext<{ state: InterviewState; dispatch: Dispatch<InterviewAction> } | null>(null);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(interviewReducer, initialInterviewState);
  return <InterviewContext.Provider value={{ state, dispatch }}>{children}</InterviewContext.Provider>;
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error("useInterview must be used within InterviewProvider");
  return ctx;
}
