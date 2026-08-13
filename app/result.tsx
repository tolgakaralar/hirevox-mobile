import { useEffect } from "react";
import { View, Text } from "react-native";
import { deactivateKeepAwake } from "expo-keep-awake";
import { playRemoteAudio } from "../src/audio/playRemoteAudio";
import { stopSessionRecording } from "../src/recording/sessionRecorder";
import { clearSessionId } from "../src/storage/session";

export default function ResultScreen() {
  useEffect(() => {
    (async () => {
      await playRemoteAudio("kapanis.mp3");
      await stopSessionRecording();
      await clearSessionId();
      deactivateKeepAwake();
    })();
  }, []);

  return (
    <View>
      <Text>Mülakat Tamamlandı</Text>
      <Text>Katılımınız için teşekkür ederiz.</Text>
    </View>
  );
}
