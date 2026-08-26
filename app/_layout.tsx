import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { InterviewProvider, useInterview } from "../src/state/InterviewContext";
import { loadSessionId } from "../src/storage/session";
import { getSession } from "../src/api/client";
import type { InterviewPage } from "../src/state/interviewReducer";
import { CameraRefProvider } from "../src/recording/CameraRefContext";
import { CameraHost } from "../src/recording/CameraHost";

const STATUS_TO_PAGE: Record<string, InterviewPage> = {
  created: "consent",
  intro: "intro",
  questions: "question",
  evaluating: "evaluating",
  done: "result",
};

// Pages that mean "an active recording session was in progress". Resuming
// straight into one of these (e.g. after a force-quit) would skip PrepScreen
// entirely — and startSessionRecording/activateKeepAwakeAsync are only ever
// called from PrepScreen's "Mülakata Başla" button — so proctoring would
// silently never restart. These must be routed through /prep first; the
// original page is stashed in resumeTarget so PrepScreen can continue there
// (instead of always going to /intro) once recording is back up.
const RECORDING_PAGES = new Set<InterviewPage>(["intro", "question", "evaluating"]);

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
        const needsRecordingRestart = RECORDING_PAGES.has(page);
        const targetPage = needsRecordingRestart ? "prep" : page;

        dispatch({ type: "SET_SESSION", sessionId });
        dispatch({ type: "SET_PAGE", page: targetPage });
        if (needsRecordingRestart) {
          dispatch({ type: "SET_RESUME_TARGET", target: page });
        }
        // Mark ready (mounting <Stack>) *before* navigating: Expo Router
        // silently drops router.replace() calls made while the Stack has
        // never rendered, since there is no navigator yet to act on them.
        setReady(true);
        router.replace(`/${targetPage}`);
      } catch {
        // Session backend'de bulunamadıysa (ör. süresi dolmuş) login'de kal
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
    <SafeAreaProvider>
      <InterviewProvider>
        <CameraRefProvider>
          <ResumeGate>
            <Stack screenOptions={{ headerShown: false }} />
            <CameraHost />
          </ResumeGate>
        </CameraRefProvider>
      </InterviewProvider>
    </SafeAreaProvider>
  );
}
