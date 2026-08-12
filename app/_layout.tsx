import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { InterviewProvider, useInterview } from "../src/state/InterviewContext";
import { loadSessionId } from "../src/storage/session";
import { getSession } from "../src/api/client";
import type { InterviewPage } from "../src/state/interviewReducer";

const STATUS_TO_PAGE: Record<string, InterviewPage> = {
  created: "consent",
  intro: "intro",
  questions: "question",
  evaluating: "evaluating",
  done: "result",
};

function ResumeGate({ children }: { children: React.ReactNode }) {
  const { dispatch } = useInterview();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const sessionId = await loadSessionId();
      if (!sessionId) {
        setReady(true);
        return;
      }
      try {
        const session = await getSession(sessionId);
        const page = STATUS_TO_PAGE[session.status] ?? "consent";
        dispatch({ type: "SET_SESSION", sessionId });
        dispatch({ type: "SET_PAGE", page });
        router.replace(`/${page}`);
      } catch {
        // Session backend'de bulunamadıysa (ör. süresi dolmuş) login'de kal
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <InterviewProvider>
      <ResumeGate>
        <Stack screenOptions={{ headerShown: false }} />
      </ResumeGate>
    </InterviewProvider>
  );
}
