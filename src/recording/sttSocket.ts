const WS_BASE = process.env.EXPO_PUBLIC_API_BASE_URL!.replace(/^http/, "ws");

export function openSttSocket(sessionId: string, timeoutMs = 2000): Promise<WebSocket | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: WebSocket | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const ws = new WebSocket(`${WS_BASE}/ws/stt?sessionId=${sessionId}&encoding=linear16&sampleRate=16000`);

    const timer = setTimeout(() => {
      ws.onopen = null;
      ws.onerror = null;
      settle(null);
    }, timeoutMs);

    ws.onopen = () => {
      clearTimeout(timer);
      settle(ws);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      settle(null);
    };
  });
}

export function sendAudioChunk(ws: WebSocket, bytes: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(bytes.buffer as ArrayBuffer);
  }
}

export function finishSttSocket(ws: WebSocket, timeoutMs = 8000): Promise<{ transcript: string }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.onmessage = null;
      resolve({ transcript: "" });
    }, timeoutMs);

    ws.onmessage = (event: { data: string }) => {
      let msg: { type?: string; transcript?: string };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "final") {
        clearTimeout(timer);
        resolve({ transcript: msg.transcript || "" });
      }
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop" }));
    }
  });
}
