import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { login } from "../src/api/client";
import { saveSessionId } from "../src/storage/session";
import { colors, typography, spacing, radius, cardStyle, inputStyle, buttonStyle } from "../src/theme/tokens";
import { OrionLogo } from "../src/components/OrionLogo";

export default function LoginScreen() {
  const router = useRouter();
  const { dispatch } = useInterview();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await login(code.trim());
      await saveSessionId(data.sessionId);
      dispatch({ type: "SET_SESSION", sessionId: data.sessionId });
      router.replace("/consent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && !!code.trim();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <OrionLogo />
            <Text style={styles.title}>HireVox</Text>
            <Text style={styles.subtitle}>Online Mülakat Platformu</Text>
            <Text style={styles.description}>
              Hoş geldiniz! Mülakata başlamak için size verilen erişim kodunu girin.
            </Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder="Erişim kodunu girin"
              placeholderTextColor={colors.muted}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setError(null);
              }}
              secureTextEntry
              editable={!loading}
            />
            <Pressable
              style={[styles.button, { backgroundColor: canSubmit ? colors.primary : colors.primaryDisabledBg }]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryDisabledFg} />
              ) : (
                <Text style={[styles.buttonText, { color: canSubmit ? "#fff" : colors.primaryDisabledFg }]}>
                  Mülakata Başla
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: spacing.screenPaddingTopLarge,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.screenPaddingBottom,
  },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  card: {
    ...cardStyle,
    paddingTop: 30,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  title: { ...typography.screenTitleLogin, color: colors.heading },
  subtitle: { ...typography.subtitle, color: colors.body, marginTop: 6 },
  description: { ...typography.body, lineHeight: 14.5 * 1.5, color: colors.muted, marginTop: 16 },
  errorBanner: {
    marginTop: 16,
    backgroundColor: colors.errorBg,
    borderRadius: radius.input,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  errorText: { fontSize: 13.5, lineHeight: 13.5 * 1.45, color: colors.errorFg },
  input: { ...inputStyle, marginTop: 16, fontSize: 16, color: colors.heading, letterSpacing: 0.5 },
  button: { ...buttonStyle, marginTop: 12 },
  buttonText: typography.button,
});
