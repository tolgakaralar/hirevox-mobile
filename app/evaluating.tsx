import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { evaluateSession } from "../src/api/client";
import { colors, typography, spacing, cardStyle } from "../src/theme/tokens";
import { OrionLogo } from "../src/components/OrionLogo";

function Spinner() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />;
}

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
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.card}>
        <OrionLogo />
        <Spinner />
        <Text style={styles.title}>Cevaplarınız Değerlendiriliyor</Text>
        <Text style={styles.subtitle}>Bu işlem birkaç saniye sürebilir. Lütfen uygulamayı kapatmayın.</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: spacing.screenPaddingTopLarge,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: 34,
    justifyContent: "center",
  },
  card: { ...cardStyle, paddingVertical: 34, paddingHorizontal: 22, alignItems: "center" },
  spinner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: colors.border,
    borderTopColor: colors.primary,
  },
  title: { ...typography.resultTitle, fontSize: 24, color: colors.heading, marginTop: 22, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.muted, marginTop: 12, textAlign: "center" },
  error: { ...typography.body, color: colors.errorFg, marginTop: 12, textAlign: "center" },
});
