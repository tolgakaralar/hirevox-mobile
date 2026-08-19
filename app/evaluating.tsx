import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { evaluateSession } from "../src/api/client";

export default function EvaluatingScreen() {
  const router = useRouter();
  const { state } = useInterview();
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current || !state.sessionId) return;
    calledRef.current = true;

    (async () => {
      try {
        await evaluateSession(state.sessionId!);
        router.replace("/result");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Değerlendirme yapılamadı");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Text>Mülakat Tamamlanıyor</Text>
        <Text>Cevaplarınız işleniyor...</Text>
        <ActivityIndicator />
        {error && <Text>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
});
