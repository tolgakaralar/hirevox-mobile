export interface NextQuestionResponse {
  done: boolean;
  question?: {
    id: number;
    topic: string;
    text: string;
    audioFile: string | null;
    difficulty: number;
    type: "verbal" | "code";
    language: string | null;
    starterCode: string | null;
  };
  topicNumber?: number;
  totalTopics?: number;
}

export interface AnswerPayload {
  sessionId: string;
  questionId?: number;
  phase: "intro" | "main";
  topic?: string;
  askedText?: string;
  transcript: string;
  difficulty?: number;
}

export interface SessionRecord {
  id: string;
  code: string;
  status: "created" | "intro" | "questions" | "evaluating" | "done";
  start_difficulty: number;
  video_path: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface EvaluationResult {
  evaluationId: number;
  scores: Array<{ topic: string; rating: number; justification: string }>;
  overall_comment: string;
}

export interface IntegrityEventPayload {
  sessionId: string;
  type: string;
  detail?: Record<string, unknown> | null;
  questionId?: number | null;
}
