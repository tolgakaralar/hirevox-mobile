import { useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useNetworkTolerance(onToleranceExceeded: () => void, toleranceMs = 45000): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onToleranceExceeded);
  callbackRef.current = onToleranceExceeded;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) {
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            callbackRef.current();
          }, toleranceMs);
        }
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toleranceMs]);
}
