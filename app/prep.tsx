import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { useInterview } from "../src/state/InterviewContext";
import { useCameraRef } from "../src/recording/CameraRefContext";
import { startSessionRecording } from "../src/recording/sessionRecorder";

// CameraHost's "/prep" preview band is full-width with aspectRatio 3/4
// (see src/recording/CameraHost.tsx), so it's screenWidth * (4/3) tall.
// It renders as a sibling positioned absolutely on top of this screen, so
// content here must be pushed below it or it sits underneath the preview
// and becomes untappable (including the "Mülakata Başla" button).
const PREVIEW_HEIGHT = Dimensions.get("window").width * (4 / 3);

export default function PrepScreen() {
  const router = useRouter();
  const { state, dispatch } = useInterview();
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
      <View testID="prep-content" style={styles.content}>
        <Text>Görüşmeye Hazırlık</Text>
        <Text>Kamera ve mikrofon erişimi gerekli. İzin vermeden mülakata devam edilemez.</Text>
        <Pressable onPress={handleRequestPermissions}>
          <Text>İzin Ver ve Devam Et</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View testID="prep-content" style={styles.content}>
      <Text>Görüşmeye Hazırlık</Text>
      <Text>Aşağıda kamera önizlemenizi görüyorsunuz — bu önizleme, kalıcı olarak arka planda çalışan CameraHost bileşenindendir (bkz. Task 14).</Text>
      <Pressable onPress={handleStart} disabled={starting}>
        <Text>Mülakata Başla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: PREVIEW_HEIGHT },
});
