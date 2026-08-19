import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { deactivateKeepAwake } from "expo-keep-awake";
import { playRemoteAudio } from "../src/audio/playRemoteAudio";
import { stopSessionRecording } from "../src/recording/sessionRecorder";
import { clearSessionId } from "../src/storage/session";

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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Text>Mülakat Tamamlandı</Text>
        <Text>Katılımınız için teşekkür ederiz.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
});
