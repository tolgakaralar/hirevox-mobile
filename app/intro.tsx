import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { startQuestionRecording, stopQuestionRecording } from "../src/recording/questionRecorder";
import { submitAnswer, introDone } from "../src/api/client";
import { playRemoteAudio, stopRemoteAudio } from "../src/audio/playRemoteAudio";
import { useProctor } from "../src/hooks/useProctor";

const INTRO_TEXT =
  "Merhaba! Mülakata hoş geldiniz. Lütfen kendinizi kısaca tanıtın. 2 dakikanız var, hazır olduğunuzda konuşmaya başlayabilirsiniz.";

export default function IntroScreen() {
  const router = useRouter();
  const { state } = useInterview();
  useProctor(state.sessionId);
  const [phase, setPhase] = useState<"speaking" | "recording" | "processing">("speaking");
  const [error, setError] = useState<string | null>(null);
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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Text>Kendinizi Tanıtın</Text>
        {phase === "speaking" && <Text>{INTRO_TEXT}</Text>}
        {phase === "recording" && <Text>Kayıt yapılıyor...</Text>}
        {phase === "processing" && <Text>İşleniyor...</Text>}
        {error && <Text>{error}</Text>}
        {phase === "recording" && (
          <Pressable onPress={handleFinish}>
            <Text>Konuşmayı Bitir</Text>
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
