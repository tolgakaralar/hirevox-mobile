import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet, Dimensions, Linking, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { useInterview } from "../src/state/InterviewContext";
import { useCameraRef } from "../src/recording/CameraRefContext";
import { startSessionRecording } from "../src/recording/sessionRecorder";
import { colors, typography, radius } from "../src/theme/tokens";
import { OrionLogo } from "../src/components/OrionLogo";

// CameraHost's "/prep" preview band is full-width with aspectRatio 3/4
// (see src/recording/CameraHost.tsx), so it's screenWidth * (4/3) tall.
// It renders as a sibling positioned absolutely on top of this screen, so
// content here must be pushed below it or it sits underneath the preview
// and becomes untappable (including the "Mülakata Başla" button).
//
// Design deviation: the handoff (docs/design/2026-08-19-mobil-arayuz-tasarimi)
// puts logo/title/subtitle ABOVE the camera preview inside one card. That's
// not possible here without moving CameraView out of CameraHost — the one
// place it's allowed to live (CLAUDE.md) — so the preview stays the
// topmost, full-bleed element and the rest of the design (logo, copy, mic
// bar, pickers, info boxes) renders in the surface panel below it instead.
const PREVIEW_HEIGHT = Dimensions.get("window").width * (4 / 3);

const FLOW_ITEMS = [
  "Önce kendinizi kısaca tanıtmanız istenecek (yaklaşık 2 dakika).",
  "Ardından yazılım alanında teknik sorular sorulacak.",
  "Gerekirse bazı konularda ek soru gelebilir.",
  "Son olarak cevaplarınız yapay zekâ ile değerlendirilecek.",
];

const BEFORE_START_ITEMS = [
  "Sessiz ve rahatsız edilmeyeceğiniz bir ortamda olun.",
  "Yüzünüzün iyi aydınlatıldığından emin olun.",
  "İnternet bağlantınızın sabit olduğunu kontrol edin.",
  "Mülakat boyunca yalnız olun ve başka sekme/uygulama açmayın.",
];

export default function PrepScreen() {
  const router = useRouter();
  const { state, dispatch } = useInterview();
  const [cameraPerm, requestCameraPerm, getCameraPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm, getMicPerm] = useMicrophonePermissions();
  const cameraRef = useCameraRef();
  const [starting, setStarting] = useState(false);

  const granted = cameraPerm?.granted && micPerm?.granted;
  // iOS/Android only ever show the native permission prompt once per app
  // install; once denied, requesting again is a silent no-op (that's the bug
  // this guards against — "İzin Ver ve Devam Et" doing nothing when the user
  // had already denied access, e.g. via system Settings before opening the
  // app). canAskAgain: false is the OS's signal that we must send the user
  // to Settings instead of requesting again.
  const permanentlyDenied =
    (cameraPerm?.canAskAgain === false && !cameraPerm?.granted) ||
    (micPerm?.canAskAgain === false && !micPerm?.granted);

  // Re-check permission status when the app returns to foreground, so a
  // grant made in Settings is picked up automatically instead of leaving
  // the user stuck on this screen after they come back.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        getCameraPerm();
        getMicPerm();
      }
    });
    return () => subscription.remove();
  }, [getCameraPerm, getMicPerm]);

  const handleRequestPermissions = async () => {
    await requestCameraPerm();
    await requestMicPerm();
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const handleStart = async () => {
    if (!state.sessionId) return;
    setStarting(true);
    await activateKeepAwakeAsync();
    await startSessionRecording(state.sessionId, cameraRef);
    // On a fresh interview resumeTarget is null and we go to /intro as
    // before. On a resumed session (force-quit mid-recording, see
    // _layout.tsx's ResumeGate) resumeTarget holds the page the user was
    // actually on, so recording restarts here but the user continues where
    // they left off instead of restarting the intro.
    const target = state.resumeTarget ?? "intro";
    dispatch({ type: "SET_RESUME_TARGET", target: null });
    router.replace(`/${target}`);
  };

  if (!granted) {
    return (
      <SafeAreaView testID="prep-safe-area" style={styles.screen} edges={["top", "bottom"]}>
        <View testID="prep-content" style={styles.content}>
          <ScrollView contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
            <OrionLogo small />
            <Text style={styles.title}>Görüşmeye Hazırlık</Text>
            <Text style={styles.subtitle}>Kamera ve mikrofon erişimi gerekli. İzin vermeden mülakata devam edilemez.</Text>
            {permanentlyDenied ? (
              <>
                <Text style={styles.subtitle}>
                  İzin, Ayarlar'dan kapatılmış görünüyor. Devam etmek için Ayarlar'dan kamera ve mikrofon erişimini
                  açın.
                </Text>
                <Pressable style={styles.button} onPress={handleOpenSettings}>
                  <Text style={styles.buttonText}>Ayarlar'a Git</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.button} onPress={handleRequestPermissions}>
                <Text style={styles.buttonText}>İzin Ver ve Devam Et</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="prep-safe-area" style={styles.screen} edges={["bottom"]}>
      <View testID="prep-content" style={[styles.content, styles.contentWithPreview]}>
        <ScrollView contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          <OrionLogo small />
          <Text style={styles.title}>Görüşmeye Hazırlık</Text>
          <Text style={styles.subtitle}>Kameranızı ve mikrofonunuzu kontrol edin</Text>

          <Text style={styles.micLabel}>Mikrofon seviyesi</Text>
          <View style={styles.micTrack}>
            <View style={styles.micLevel} />
          </View>
          <Text style={styles.micHint}>Konuştuğunuzda çubuğun hareket etmesi gerekir.</Text>

          <View style={styles.pickerGroup}>
            <View>
              <Text style={styles.pickerLabel}>Kamera</Text>
              <View style={styles.pickerRow}>
                <Text style={styles.pickerValue}>Ön kamera</Text>
                <Text style={styles.pickerChevron}>{"▾"}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.pickerLabel}>Mikrofon</Text>
              <View style={styles.pickerRow}>
                <Text style={styles.pickerValue}>Telefon mikrofonu</Text>
                <Text style={styles.pickerChevron}>{"▾"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.box}>
            <Text style={styles.boxTitle}>Mülakat nasıl işleyecek?</Text>
            <View style={styles.list}>
              {FLOW_ITEMS.map((item, i) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.listNumber}>{i + 1}.</Text>
                  <Text style={styles.listItem}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.boxFootnote}>Tahmini toplam süre: yaklaşık 15–20 dakika.</Text>
          </View>

          <View style={[styles.box, { marginTop: 14 }]}>
            <Text style={styles.boxTitle}>Başlamadan önce</Text>
            <View style={styles.list}>
              {BEFORE_START_ITEMS.map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.bullet}>{"•"}</Text>
                  <Text style={styles.listItem}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable style={styles.button} onPress={handleStart} disabled={starting}>
            {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Mülakata Başla</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  // Only applied once permission is granted and CameraHost actually shows
  // its full-size "/prep" preview band — without permission CameraHost
  // falls back to its hidden mode (see CameraHost.tsx), so there's no
  // preview to reserve space for and content should sit near the top.
  contentWithPreview: { paddingTop: PREVIEW_HEIGHT },
  contentInner: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 22 },
  title: { ...typography.screenTitle, color: colors.heading },
  subtitle: { fontSize: 15.5, fontWeight: "400", lineHeight: 15.5 * 1.35, color: colors.body, marginTop: 6 },
  micLabel: { fontSize: 13, fontWeight: "400", lineHeight: 13 * 1.4, color: colors.muted, marginTop: 16 },
  micTrack: { marginTop: 7, height: 6, borderRadius: radius.bar, backgroundColor: colors.micTrack, overflow: "hidden" },
  micLevel: { height: "100%", width: "12%", borderRadius: radius.bar, backgroundColor: colors.micLevel },
  micHint: { fontSize: 13, fontWeight: "400", lineHeight: 13 * 1.4, color: colors.muted, marginTop: 8 },
  pickerGroup: { marginTop: 16, gap: 12 },
  pickerLabel: { fontSize: 13, fontWeight: "400", lineHeight: 13 * 1.4, color: colors.muted, marginBottom: 6 },
  pickerRow: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 9,
    paddingVertical: 13,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerValue: { fontSize: 15, fontWeight: "400", color: colors.heading },
  pickerChevron: { fontSize: 12, color: colors.chevron },
  box: { marginTop: 18, borderWidth: 1, borderColor: colors.border, borderRadius: radius.box, padding: 15 },
  boxTitle: typography.boxTitle,
  list: { marginTop: 12, gap: 7 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  listNumber: { fontSize: 14, fontWeight: "400", lineHeight: 14 * 1.45, color: colors.body },
  bullet: { fontSize: 14, fontWeight: "400", lineHeight: 14 * 1.45, color: colors.body },
  listItem: { fontSize: 14, fontWeight: "400", lineHeight: 14 * 1.45, color: colors.body, flex: 1 },
  boxFootnote: { fontSize: 13, fontWeight: "400", lineHeight: 13 * 1.5, color: colors.muted, marginTop: 12 },
  button: {
    marginTop: 18,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  buttonText: { ...typography.button, color: "#fff" },
});
