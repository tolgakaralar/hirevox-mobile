import { useEffect, useState } from "react";
import { View, Text, StyleSheet, AppState } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { usePathname } from "expo-router";
import { useCameraRef } from "./CameraRefContext";
import { subscribeCameraReset } from "./cameraResetSignal";
import { colors } from "../theme/tokens";

// How long to hold the camera off before turning it back on. Long enough
// for the native capture session to actually tear down (a same-tick
// off/on wouldn't give it a chance to), short enough to be an
// imperceptible blip on screen.
const RESET_HOLD_MS = 150;

type Mode = "prep" | "pip" | "hidden";

const PATHNAME_TO_MODE: Record<string, Mode> = {
  "/prep": "prep",
  "/intro": "pip",
  "/question": "pip",
};

export function CameraHost() {
  const cameraRef = useCameraRef();
  const pathname = usePathname();
  const routeMode: Mode = PATHNAME_TO_MODE[pathname] ?? "hidden";
  const [cameraPerm, , getCameraPerm] = useCameraPermissions();
  const [micPerm, , getMicPerm] = useMicrophonePermissions();
  const permissionGranted = cameraPerm?.granted && micPerm?.granted;

  // Without permission there's no live feed to show — the "prep" box (and
  // its "you're not being recorded, this is just a preview" banner) must
  // hide along with it instead of sitting there over a black box. Re-check
  // on foreground so granting permission in Settings brings it back without
  // requiring a reload (mirrors PrepScreen's own re-check for the same
  // reason).
  const mode: Mode = routeMode === "prep" && !permissionGranted ? "hidden" : routeMode;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        getCameraPerm();
        getMicPerm();
      }
    });
    return () => subscription.remove();
  }, [getCameraPerm, getMicPerm]);

  // GitHub finding: the live preview could come back frozen (stuck on the
  // last frame) when starting a fresh interview later in the same app run
  // (Result -> Bitti -> Login -> re-login -> Consent -> Prep) — the native
  // capture session doesn't reliably resume live frames on its own after
  // stopSessionRecording()'s stopRecording() call. `active` is exactly the
  // prop expo-camera provides to force-restart the session without
  // unmounting (CameraView must never unmount — see CLAUDE.md);
  // stopSessionRecording() signals this once recording is fully done.
  const [cameraActive, setCameraActive] = useState(true);

  useEffect(() => {
    return subscribeCameraReset(() => {
      setCameraActive(false);
      setTimeout(() => setCameraActive(true), RESET_HOLD_MS);
    });
  }, []);

  if (mode === "prep") {
    return (
      <View style={styles.prepContainer} pointerEvents="none">
        <CameraView ref={cameraRef} active={cameraActive} facing="front" mode="video" videoQuality="480p" style={styles.prepCamera} />
        <View style={styles.prepOverlay}>
          <View style={styles.prepOverlayDot} />
          <Text style={styles.prepOverlayText}>Şu an kaydedilmiyorsunuz — bu yalnızca bir önizlemedir</Text>
        </View>
      </View>
    );
  }

  if (mode === "pip") {
    return (
      <View style={styles.pipContainer} pointerEvents="none">
        <CameraView ref={cameraRef} active={cameraActive} facing="front" mode="video" videoQuality="480p" style={styles.pipCamera} />
        <View style={styles.pipStrip}>
          <View style={styles.pipDot} />
          <Text style={styles.pipLabel}>Kayıt</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <CameraView ref={cameraRef} active={cameraActive} facing="front" mode="video" videoQuality="480p" style={styles.hidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: { position: "absolute", top: -1000, width: 1, height: 1, opacity: 0 },
  hidden: { position: "absolute", top: -1000, width: 1, height: 1, opacity: 0 },

  prepContainer: { position: "absolute", top: 0, left: 0, right: 0, aspectRatio: 3 / 4 },
  prepCamera: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  prepOverlay: {
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
  prepOverlayDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.overlayDot },
  prepOverlayText: { fontSize: 12, fontWeight: "400", lineHeight: 12 * 1.3, color: colors.overlayFg, flex: 1 },

  // Floating bottom-right PiP for Intro/Question. The design places this
  // directly below each screen's card, but CameraHost renders as an
  // absolutely-positioned sibling with no knowledge of that card's
  // (variable-height) content, so a fixed corner position is used instead —
  // simpler and more robust than measuring card layout, at the cost of not
  // being pixel-exact to the handoff on very short/tall content.
  pipContainer: {
    position: "absolute",
    right: 14,
    bottom: 40,
    width: 112,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: colors.heading,
    shadowOpacity: 0.14,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  pipCamera: { width: 112, aspectRatio: 3 / 4 },
  pipStrip: {
    backgroundColor: colors.surface,
    paddingVertical: 5,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.recording },
  pipLabel: { fontSize: 10, fontWeight: "600", color: colors.heading },
});
