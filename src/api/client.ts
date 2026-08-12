import type {
  NextQuestionResponse,
  AnswerPayload,
  SessionRecord,
  EvaluationResult,
  IntegrityEventPayload,
} from "./types";

const BASE = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
    throw new ApiError(err.error || `HTTP ${res.status}`, res.status);
  }
  return res.json();
}

export function login(code: string, token: string) {
  return request("/login", { method: "POST", body: JSON.stringify({ code, token }) }) as Promise<{
    sessionId: string;
    message: string;
  }>;
}

export function consent(sessionId: string) {
  return request("/interview/consent", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  }) as Promise<{ status: string }>;
}

export function introDone(sessionId: string) {
  return request("/interview/intro-done", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  }) as Promise<{ status: string }>;
}

export function getNextQuestion(sessionId: string) {
  return request(`/interview/next?sessionId=${sessionId}`) as Promise<NextQuestionResponse>;
}

export function submitAnswer(payload: AnswerPayload) {
  return request("/interview/answer", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<{ saved: true }>;
}

export function finishQuestions(sessionId: string) {
  return request("/interview/finish-questions", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  }) as Promise<{ status: string }>;
}

export function getSession(sessionId: string) {
  return request(`/interview/session?sessionId=${sessionId}`) as Promise<SessionRecord>;
}

export function evaluateSession(sessionId: string) {
  return request("/evaluate", { method: "POST", body: JSON.stringify({ sessionId }) }) as Promise<EvaluationResult>;
}

export function logIntegrityEvent(payload: IntegrityEventPayload) {
  return request("/integrity/event", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<{ saved: true }>;
}

export async function transcribeAudioFile(uri: string, mimeType: string) {
  const form = new FormData();
  // @ts-expect-error React Native FormData dosya nesnesi web File tipinden farklıdır
  form.append("audio", { uri, name: "recording", type: mimeType });
  const res = await fetch(`${BASE}/stt`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || "Ses metne çevrilemedi", res.status);
  }
  return res.json() as Promise<{ transcript: string }>;
}

export async function uploadVideoChunk(sessionId: string, segmentIndex: number, uri: string, mimeType: string) {
  const form = new FormData();
  // @ts-expect-error bkz. yukarısı
  form.append("chunk", { uri, name: `segment-${segmentIndex}`, type: mimeType });
  form.append("sessionId", sessionId);
  form.append("index", "0");
  form.append("segmentIndex", String(segmentIndex));
  const res = await fetch(`${BASE}/interview/video-chunk`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || "Video parçası gönderilemedi", res.status);
  }
  return res.json() as Promise<{ saved: true }>;
}

export function finalizeVideoSegment(sessionId: string, segmentIndex: number) {
  return request("/interview/video-finalize", {
    method: "POST",
    body: JSON.stringify({ sessionId, segmentIndex }),
  }) as Promise<{ saved: true; videoPath: string }>;
}
