import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { getNextQuestion, submitAnswer, finishQuestions } from "../src/api/client";
import type { NextQuestionResponse } from "../src/api/types";
import { startQuestionRecording, stopQuestionRecording } from "../src/recording/questionRecorder";
import { playRemoteAudio } from "../src/audio/playRemoteAudio";
import { useProctor } from "../src/hooks/useProctor";
import { useNetworkTolerance } from "../src/hooks/useNetworkTolerance";

type Phase = "idle" | "speaking" | "recording" | "processing";

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

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Text>
          Konu {topicNumber}/{totalTopics}
        </Text>
        {question && <Text>{question.text}</Text>}
        {phase === "speaking" && <Text>Soru okunuyor...</Text>}
        {phase === "recording" && <Text>Kayıt yapılıyor...</Text>}
        {phase === "processing" && <Text>Cevabınız işleniyor...</Text>}
        {error && <Text>{error}</Text>}
        {phase === "recording" && (
          <Pressable onPress={handleFinish}>
            <Text>Cevabı Gönder</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, padding: 24 },
});
