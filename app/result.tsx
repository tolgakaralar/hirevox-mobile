import { useEffect } from "react";
import { View, Text } from "react-native";
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
    <View>
      <Text>Mülakat Tamamlandı</Text>
      <Text>Katılımınız için teşekkür ederiz.</Text>
    </View>
  );
}
