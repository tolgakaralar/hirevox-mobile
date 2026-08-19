import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { consent } from "../src/api/client";
import { colors, typography, spacing, radius, cardStyle, boxStyle, buttonStyle } from "../src/theme/tokens";
import { OrionLogo } from "../src/components/OrionLogo";
import { BackButton } from "../src/components/BackButton";

const FLOW_ITEMS = [
  "Kendinizi kısaca tanıtmanız istenecek (2 dakika)",
  "Yazılım alanında 2 ana soru sorulacak",
  "Gerekirse ek sorular sorulabilir",
  "Son olarak AI tarafından değerlendirme yapılacak",
];

const MONITORING_ITEMS = [
  "Kamera görüntüsü ve mikrofon sesi (tüm oturum boyunca)",
  "Mikrofon kaydı ve otomatik metin dönüşümü",
  "Sekme/pencere değişimi ve odak kaybı takibi",
  "Cevap içeriklerinin özgünlük analizi",
];

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

  const canSubmit = !loading && monitoringConsent;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackButton onPress={() => router.back()} />
      <View style={styles.card}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <OrionLogo small />
          <Text style={styles.title}>Mülakat Hakkında</Text>
          <Text style={styles.subtitle}>Başlamadan önce lütfen okuyun</Text>
          <Text style={styles.paragraph}>
            Bu mülakat yapay zekâ destekli bir değerlendirme sistemi ile gerçekleştirilmektedir.
          </Text>
          <Text style={[styles.paragraph, { marginTop: 14 }]}>
            Mülakat sırasında mikrofonunuz aracılığıyla sesiniz kaydedilecek ve cevaplar otomatik olarak metne
            çevrilecektir.
          </Text>
          <Text style={styles.flowLabel}>Mülakat akışı:</Text>
          <View style={styles.list}>
            {FLOW_ITEMS.map((item) => (
              <View key={item} style={styles.listRow}>
                <Text style={styles.bullet}>{"•"}</Text>
                <Text style={styles.listItem}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.paragraph}>
            Verdiğiniz cevaplar yalnızca bu mülakat değerlendirmesi için kullanılacaktır.
          </Text>

          <View style={styles.box}>
            <Text style={styles.boxTitle}>Gözetim ve Veri Kullanımı</Text>
            <Text style={styles.boxDescription}>
              Mülakat süresince aşağıdaki veriler değerlendirme amacıyla toplanmaktadır:
            </Text>
            <View style={styles.list}>
              {MONITORING_ITEMS.map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.bullet}>{"•"}</Text>
                  <Text style={styles.boxListItem}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.footnote}>
              Bu veriler yalnızca mülakat değerlendirmesi için kullanılır ve üçüncü taraflarla paylaşılmaz.
            </Text>
            <Pressable
              onPress={() => setMonitoringConsent((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: monitoringConsent }}
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: monitoringConsent ? colors.primary : colors.checkboxBorder,
                    backgroundColor: monitoringConsent ? colors.primary : "transparent",
                  },
                ]}
              >
                {monitoringConsent && <Text style={styles.checkMark}>{"✓"}</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                Yukarıdaki bilgileri okudum ve veri toplanmasını kabul ediyorum.
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.button, { backgroundColor: canSubmit ? colors.primary : colors.primaryDisabledBg }]}
            onPress={handleConsent}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryDisabledFg} />
            ) : (
              <Text style={[styles.buttonText, { color: canSubmit ? "#fff" : colors.primaryDisabledFg }]}>
                Görüşmeye Gir
              </Text>
            )}
          </Pressable>
        </ScrollView>
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
  card: {
    ...cardStyle,
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  title: { ...typography.screenTitle, color: colors.heading },
  subtitle: { ...typography.subtitle, color: colors.body, marginTop: 6 },
  paragraph: { ...typography.body, color: colors.body, marginTop: 16 },
  flowLabel: { fontSize: 14.5, fontWeight: "700", lineHeight: 14.5 * 1.5, color: colors.headingAlt, marginTop: 18 },
  list: { marginTop: 10, gap: 6 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  bullet: { ...typography.listItem, color: colors.body },
  listItem: { ...typography.listItem, color: colors.body, flex: 1 },
  box: { ...boxStyle, marginTop: 20, borderRadius: radius.box },
  boxTitle: typography.boxTitle,
  boxDescription: { fontSize: 14, fontWeight: "400", lineHeight: 14 * 1.55, color: colors.body, marginTop: 10 },
  boxListItem: { fontSize: 14, fontWeight: "400", lineHeight: 14 * 1.45, color: colors.body, flex: 1 },
  footnote: { fontSize: 13, fontWeight: "400", lineHeight: 13 * 1.5, color: colors.mutedSoft, marginTop: 12 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 14 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.checkbox,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkMark: { fontSize: 12, fontWeight: "700", color: "#fff" },
  checkboxLabel: { fontSize: 14, fontWeight: "400", lineHeight: 14 * 1.4, color: colors.body, flex: 1 },
  button: { ...buttonStyle, marginTop: 18 },
  buttonText: typography.button,
});
