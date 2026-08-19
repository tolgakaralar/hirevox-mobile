import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { getNextQuestion, submitAnswer, finishQuestions } from "../src/api/client";
import type { NextQuestionResponse } from "../src/api/types";
import { startQuestionRecording, stopQuestionRecording } from "../src/recording/questionRecorder";
import { playRemoteAudio } from "../src/audio/playRemoteAudio";
import { useProctor } from "../src/hooks/useProctor";
import { useNetworkTolerance } from "../src/hooks/useNetworkTolerance";
import { colors, typography, spacing, radius, cardStyle } from "../src/theme/tokens";
import { OrionLogo } from "../src/components/OrionLogo";
import { formatCountdown, formatElapsed } from "../src/utils/time";

type Phase = "idle" | "speaking" | "recording" | "processing";

// Visual only, not enforced — matches IntroScreen's countdown (see that
// file's comment); confirmed with the user rather than inventing a real
// per-question time limit that doesn't exist in the backend today.
const ANSWER_SECONDS = 120;

const DIFFICULTY_LABELS: Record<number, string> = { 1: "Kolay", 2: "Orta", 3: "Zor" };

export default function QuestionScreen() {
  const router = useRouter();
  const { state, dispatch } = useInterview();
  useProctor(state.sessionId);
  useNetworkTolerance(() => {
    dispatch({ type: "SET_ERROR", error: "Bağlantı kesintisi çok uzun sürdü, mülakat sonlandırıldı." });
    router.replace("/result");
  });

  const [question, setQuestion] = useState<NextQuestionResponse["question"] | null>(null);
  const [topicNumber, setTopicNumber] = useState(0);
  const [totalTopics, setTotalTopics] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(ANSWER_SECONDS);
  const loadingRef = useRef(false);
  // stopQuestionRecording() tears down the recorder (questionRecorder.ts
  // resets mode/socket/recording to null). If submitAnswer rejects and the
  // user retries, calling stopQuestionRecording() again would hit that
  // torn-down recorder and return an empty transcript — silently replacing
  // the real answer with the "(Ses alınamadı)" fallback. Caching the result
  // here means a retry resubmits the transcript we already captured instead
  // of re-stopping a dead recorder. Reset to null whenever a new question's
  // recording starts, since QuestionScreen stays mounted across the whole
  // question loop and each question needs its own capture.
  const lastTranscriptRef = useRef<string | null>(null);

  const loadNextQuestion = async () => {
    if (loadingRef.current || !state.sessionId) return;
    loadingRef.current = true;
    setPhase("idle");

    try {
      const data = await getNextQuestion(state.sessionId);

      if (data.done) {
        await finishQuestions(state.sessionId);
        router.replace("/evaluating");
        return;
      }

      setQuestion(data.question!);
      setTopicNumber(data.topicNumber!);
      setTotalTopics(data.totalTopics!);

      if (data.question!.audioFile) {
        setPhase("speaking");
        await playRemoteAudio(data.question!.audioFile);
      }

      setPhase("recording");
      setElapsed(0);
      setRemaining(ANSWER_SECONDS);
      lastTranscriptRef.current = null;
      await startQuestionRecording(state.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      loadingRef.current = false;
    }
  };

  const handleFinish = async () => {
    if (phase !== "recording" || !question || !state.sessionId) return;
    setPhase("processing");

    try {
      if (lastTranscriptRef.current === null) {
        const { transcript } = await stopQuestionRecording();
        lastTranscriptRef.current = transcript || "(Ses alınamadı)";
      }
      await submitAnswer({
        sessionId: state.sessionId,
        questionId: question.id,
        phase: "main",
        topic: question.topic,
        askedText: question.text,
        transcript: lastTranscriptRef.current,
        difficulty: question.difficulty,
      });
      lastTranscriptRef.current = null;
      await loadNextQuestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setPhase("recording");
    }
  };

  useEffect(() => {
    void loadNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      setElapsed((s) => s + 1);
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const progress = totalTopics > 0 ? topicNumber / totalTopics : 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.card}>
        <OrionLogo small />
        <Text style={styles.title}>
          Konu {topicNumber}/{totalTopics}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Geçen süre: {formatElapsed(elapsed)}</Text>
          <Text style={styles.meta}>Tahmini kalan: ~3 dk</Text>
        </View>

        {question && (
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{question.topic.toLocaleUpperCase("tr-TR")}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {(DIFFICULTY_LABELS[question.difficulty] ?? "").toLocaleUpperCase("tr-TR")}
              </Text>
            </View>
          </View>
        )}

        {question && (
          <View style={styles.questionBlock}>
            <Text style={styles.questionText}>{question.text}</Text>
          </View>
        )}

        {(phase === "recording" || phase === "processing") && <Text style={styles.counter}>{formatCountdown(remaining)}</Text>}
        {phase === "recording" && (
          <View style={styles.recordingRow}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>Kayıt yapılıyor...</Text>
          </View>
        )}
        {phase === "speaking" && <Text style={styles.paragraph}>Soru okunuyor...</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        {phase === "recording" && (
          <Pressable style={styles.button} onPress={handleFinish}>
            <Text style={styles.buttonText}>Cevabı Gönder</Text>
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
  },
  card: { ...cardStyle, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 22 },
  title: { ...typography.questionTitle, color: colors.heading },
  progressTrack: { marginTop: 10, height: 4, borderRadius: radius.bar, backgroundColor: colors.border, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.bar, backgroundColor: colors.primary },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 9 },
  meta: { fontSize: 12.5, fontWeight: "400", color: colors.muted },
  badgeRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 16 },
  badge: { backgroundColor: colors.badgeBg, borderRadius: radius.badge, paddingVertical: 8, paddingHorizontal: 14 },
  badgeText: { ...typography.badge, color: colors.badgeFg },
  questionBlock: {
    marginTop: 16,
    backgroundColor: colors.quoteBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: radius.questionBlock,
    padding: 15,
  },
  questionText: { fontSize: 15, fontWeight: "400", lineHeight: 15 * 1.5, color: colors.textStrong },
  counter: { ...typography.counterQuestion, marginTop: 18 },
  recordingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  recordingDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.recording },
  recordingLabel: typography.recordingLabel,
  paragraph: { ...typography.body, color: colors.body, marginTop: 14 },
  error: { ...typography.body, color: colors.errorFg, marginTop: 14 },
  button: { marginTop: 16, borderRadius: 10, paddingVertical: 16, alignItems: "center", backgroundColor: colors.danger },
  buttonText: { ...typography.button, color: "#fff" },
});
