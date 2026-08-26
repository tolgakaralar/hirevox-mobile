import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { startQuestionRecording, stopQuestionRecording } from "../src/recording/questionRecorder";
import { submitAnswer, introDone } from "../src/api/client";
import { playRemoteAudio, stopRemoteAudio } from "../src/audio/playRemoteAudio";
import { useProctor } from "../src/hooks/useProctor";
import { colors, typography, spacing, cardStyle } from "../src/theme/tokens";
import { OrionLogo } from "../src/components/OrionLogo";
import { formatCountdown } from "../src/utils/time";

const INTRO_TEXT = "Kendinizi tanıtmaya başlayabilirsiniz. Hazır olduğunuzda aşağıdaki butona basın.";
const INTRO_SECONDS = 120;

export default function IntroScreen() {
  const router = useRouter();
  const { state } = useInterview();
  useProctor(state.sessionId);
  const [phase, setPhase] = useState<"speaking" | "recording" | "processing">("speaking");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(INTRO_SECONDS);
  const finishingRef = useRef(false);
  // stopQuestionRecording() tears down the recorder (questionRecorder.ts
  // resets mode/socket/recording to null). If submitAnswer rejects and the
  // user retries, calling stopQuestionRecording() again would hit that
  // torn-down recorder and return an empty transcript — silently replacing
  // the real answer with the "(Ses alınamadı)" fallback. Caching the result
  // here means a retry resubmits the transcript we already captured instead
  // of re-stopping a dead recorder.
  const lastTranscriptRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      await playRemoteAudio("giris-karsilama.mp3");
      if (!state.sessionId) return;
      await startQuestionRecording(state.sessionId);
      setPhase("recording");
    })();
    return () => {
      void stopRemoteAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Visual countdown only — not enforced (no auto-submit at 00:00). Matches
  // the copy's existing "2 dakikanız var" promise with a real, ticking
  // number instead of a static one.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const handleFinish = async () => {
    if (phase !== "recording" || finishingRef.current) return;
    finishingRef.current = true;
    setPhase("processing");

    try {
      if (lastTranscriptRef.current === null) {
        const { transcript } = await stopQuestionRecording();
        lastTranscriptRef.current = transcript || "(Ses alınamadı)";
      }
      await submitAnswer({
        sessionId: state.sessionId!,
        phase: "intro",
        askedText: "Kendinizi kısaca tanıtın",
        transcript: lastTranscriptRef.current,
      });
      await playRemoteAudio("giris-tesekkur.mp3");
      await introDone(state.sessionId!);
      router.replace("/question");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      finishingRef.current = false;
      setPhase("recording");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.card}>
        <OrionLogo small />
        <Text style={styles.title}>Kendinizi Tanıtın</Text>
        <Text style={styles.counter}>{formatCountdown(remaining)}</Text>
        {phase === "recording" && (
          <View style={styles.recordingRow}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>Kayıt yapılıyor...</Text>
          </View>
        )}
        {phase === "speaking" && <Text style={styles.paragraph}>Soru okunuyor...</Text>}
        {phase === "processing" && <Text style={styles.paragraph}>İşleniyor...</Text>}
        {phase !== "processing" && <Text style={styles.paragraph}>{INTRO_TEXT}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {phase === "recording" && (
          <Pressable style={styles.button} onPress={handleFinish}>
            <Text style={styles.buttonText}>Konuşmayı Bitir</Text>
          </Pressable>
        )}
        {phase === "processing" && (
          <View style={styles.button}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: spacing.screenPaddingTop,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: 30,
    justifyContent: "flex-start",
  },
  card: { ...cardStyle, paddingTop: 26, paddingHorizontal: 20, paddingBottom: 22, borderRadius: 22 },
  title: { ...typography.screenTitle, color: colors.heading },
  counter: { ...typography.counterIntro, marginTop: 14 },
  recordingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  recordingDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.recording },
  recordingLabel: typography.recordingLabel,
  paragraph: { ...typography.body, color: colors.body, marginTop: 14 },
  error: { ...typography.body, color: colors.errorFg, marginTop: 14 },
  button: { marginTop: 18, borderRadius: 10, paddingVertical: 16, alignItems: "center", backgroundColor: colors.danger },
  buttonText: { ...typography.button, color: "#fff" },
});
