import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import type { CameraView } from "expo-camera";

const CameraRefContext = createContext<RefObject<CameraView | null> | null>(null);

export function CameraRefProvider({ children }: { children: ReactNode }) {
  const ref = useRef<CameraView>(null);
  return <CameraRefContext.Provider value={ref}>{children}</CameraRefContext.Provider>;
}

export function useCameraRef(): RefObject<CameraView | null> {
  const ctx = useContext(CameraRefContext);
  if (!ctx) throw new Error("useCameraRef must be used within CameraRefProvider");
  return ctx;
}
