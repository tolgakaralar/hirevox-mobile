import { View, Text, StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { usePathname } from "expo-router";
import { useCameraRef } from "./CameraRefContext";
import { colors } from "../theme/tokens";

export function CameraHost() {
  const cameraRef = useCameraRef();
  const pathname = usePathname();
  const visible = pathname === "/prep";

  return (
    <View style={visible ? styles.visibleContainer : styles.hiddenContainer} pointerEvents="none">
      <CameraView
        ref={cameraRef}
        facing="front"
        mode="video"
        videoQuality="480p"
        style={visible ? styles.visible : styles.hidden}
      />
      {visible && (
        <View style={styles.overlay}>
          <View style={styles.overlayDot} />
          <Text style={styles.overlayText}>Şu an kaydedilmiyorsunuz — bu yalnızca bir önizlemedir</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  visibleContainer: { position: "absolute", top: 0, left: 0, right: 0, aspectRatio: 3 / 4 },
  hiddenContainer: { position: "absolute", top: -1000, width: 1, height: 1, opacity: 0 },
  visible: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  hidden: { position: "absolute", top: -1000, width: 1, height: 1, opacity: 0 },
  overlay: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: colors.overlay,
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  overlayDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.overlayDot },
  overlayText: { fontSize: 12, fontWeight: "400", lineHeight: 12 * 1.3, color: colors.overlayFg, flex: 1 },
});
