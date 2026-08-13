import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { useInterview } from "../src/state/InterviewContext";
import { useCameraRef } from "../src/recording/CameraRefContext";
import { startSessionRecording } from "../src/recording/sessionRecorder";

export default function PrepScreen() {
  const router = useRouter();
  const { state } = useInterview();
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const cameraRef = useCameraRef();
  const [starting, setStarting] = useState(false);

  const granted = cameraPerm?.granted && micPerm?.granted;

  const handleRequestPermissions = async () => {
    await requestCameraPerm();
    await requestMicPerm();
  };

  const handleStart = async () => {
    if (!state.sessionId) return;
    setStarting(true);
    await activateKeepAwakeAsync();
    await startSessionRecording(state.sessionId, cameraRef);
    router.replace("/intro");
  };

  if (!granted) {
    return (
      <View>
        <Text>Görüşmeye Hazırlık</Text>
        <Text>Kamera ve mikrofon erişimi gerekli. İzin vermeden mülakata devam edilemez.</Text>
        <Pressable onPress={handleRequestPermissions}>
          <Text>İzin Ver ve Devam Et</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text>Görüşmeye Hazırlık</Text>
      <Text>Aşağıda kamera önizlemenizi görüyorsunuz — bu önizleme, kalıcı olarak arka planda çalışan CameraHost bileşenindendir (bkz. Task 14).</Text>
      <Pressable onPress={handleStart} disabled={starting}>
        <Text>Mülakata Başla</Text>
      </Pressable>
    </View>
  );
}
