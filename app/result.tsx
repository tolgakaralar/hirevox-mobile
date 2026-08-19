import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { deactivateKeepAwake } from "expo-keep-awake";
import { playRemoteAudio } from "../src/audio/playRemoteAudio";
import { stopSessionRecording } from "../src/recording/sessionRecorder";
import { clearSessionId } from "../src/storage/session";
import { colors, typography, spacing, cardStyle } from "../src/theme/tokens";
import { OrionLogo } from "../src/components/OrionLogo";

export default function ResultScreen() {
  useEffect(() => {
    (async () => {
      // Her adım kendi try/catch'i içinde: biri reddederse (ör. ağ hatası
      // yüzünden playRemoteAudio) sonraki adımlar yine de çalışmalı.
      // stopSessionRecording atlanırsa kuyruktaki video segmentleri hiç
      // yüklenmez; clearSessionId atlanırsa _layout.tsx'in resume mantığı
      // bir sonraki açılışta yine /result'a yönlendirip sonsuz döngüye
      // sokar. deactivateKeepAwake her koşulda (finally) çağrılır, aksi
      // halde ekran hiç uyumaz.
      try {
        await playRemoteAudio("kapanis.mp3");
      } catch {
        // Sessizce geç, temizlik adımları devam etmeli.
      }
      try {
        await stopSessionRecording();
      } catch {
        // Sessizce geç, sessionId temizliği yine de yapılmalı.
      }
      try {
        await clearSessionId();
      } catch {
        // Sessizce geç.
      } finally {
        deactivateKeepAwake();
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.card}>
        <OrionLogo />
        <Text style={styles.title}>Mülakat Tamamlandı</Text>
        <Text style={styles.subtitle}>Katılımınız için teşekkür ederiz.</Text>
        <Text style={styles.paragraph}>
          Değerlendirme sonuçlarınız ilgili ekibimiz tarafından incelenecektir.
        </Text>
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
  card: { ...cardStyle, paddingVertical: 40, paddingHorizontal: 22, alignItems: "center" },
  title: { ...typography.resultTitle, color: colors.heading, textAlign: "center" },
  subtitle: { fontSize: 15.5, fontWeight: "400", lineHeight: 15.5 * 1.5, color: colors.muted, marginTop: 16, textAlign: "center" },
  paragraph: { fontSize: 15, fontWeight: "400", lineHeight: 15 * 1.55, color: colors.muted, marginTop: 18, textAlign: "center" },
});
