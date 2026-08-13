import { StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { usePathname } from "expo-router";
import { useCameraRef } from "./CameraRefContext";

export function CameraHost() {
  const cameraRef = useCameraRef();
  const pathname = usePathname();
  const visible = pathname === "/prep";

  return (
    <CameraView
      ref={cameraRef}
      facing="front"
      videoQuality="480p"
      style={visible ? styles.visible : styles.hidden}
    />
  );
}

const styles = StyleSheet.create({
  visible: { width: "100%", aspectRatio: 3 / 4 },
  hidden: { position: "absolute", top: -1000, width: 1, height: 1, opacity: 0 },
});
