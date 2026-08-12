import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { logIntegrityEvent } from "../api/client";

export function useProctor(sessionId: string | null, active = true): void {
  const wasBackgrounded = useRef(false);

  useEffect(() => {
    if (!active || !sessionId) return;

    const send = (type: string) => {
      logIntegrityEvent({ sessionId, type, detail: null }).catch(() => {});
    };

    const onChange = (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        wasBackgrounded.current = true;
        send("app_backgrounded");
      } else if (nextState === "active" && wasBackgrounded.current) {
        wasBackgrounded.current = false;
        send("app_foregrounded");
      }
    };

    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [sessionId, active]);
}
