import { useState } from "react";
import { View, Text, Switch, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { consent } from "../src/api/client";

export default function ConsentScreen() {
  const router = useRouter();
  const { state, dispatch } = useInterview();
  const [monitoringConsent, setMonitoringConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConsent = async () => {
    if (!state.sessionId) return;
    setLoading(true);
    try {
      await consent(state.sessionId);
      dispatch({ type: "SET_PAGE", page: "prep" });
      router.replace("/prep");
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Bir hata oluştu" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Text>Mülakat Hakkında</Text>
        <Text>
          Mülakat süresince kamera görüntünüz ve mikrofon sesiniz tüm oturum boyunca kaydedilir; sekme/uygulama
          değişimi ve arka plana geçişler bütünlük amacıyla izlenir.
        </Text>
        <Switch
          accessibilityRole="checkbox"
          value={monitoringConsent}
          onValueChange={setMonitoringConsent}
        />
        <Text>Yukarıdaki bilgileri okudum ve veri toplanmasını kabul ediyorum.</Text>
        {state.error && <Text>{state.error}</Text>}
        <Pressable onPress={handleConsent} disabled={loading || !monitoringConsent}>
          {loading ? <ActivityIndicator /> : <Text>Görüşmeye Gir</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, padding: 24 },
});
