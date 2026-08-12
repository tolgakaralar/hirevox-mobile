import { openSttSocket, sendAudioChunk, finishSttSocket } from "../sttSocket";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: unknown[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {}
  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  triggerMessage(data: string) {
    this.onmessage?.({ data });
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  // @ts-expect-error test double
  global.WebSocket = FakeWebSocket;
});

test("openSttSocket includes sessionId, encoding and sampleRate in URL", async () => {
  const promise = openSttSocket("s1", 1000);
  const ws = FakeWebSocket.instances[0];
  expect(ws.url).toBe("wss://test.local/ws/stt?sessionId=s1&encoding=linear16&sampleRate=16000");
  ws.triggerOpen();
  await expect(promise).resolves.toBe(ws as unknown as WebSocket);
});

test("openSttSocket resolves null if connection does not open before timeout", async () => {
  const promise = openSttSocket("s1", 10);
  await expect(promise).resolves.toBeNull();
});

test("sendAudioChunk sends bytes only when socket is OPEN", () => {
  const ws = new FakeWebSocket("wss://x");
  sendAudioChunk(ws as unknown as WebSocket, new Uint8Array([1, 2, 3]));
  expect(ws.sent).toHaveLength(0); // henüz OPEN değil

  ws.readyState = FakeWebSocket.OPEN;
  sendAudioChunk(ws as unknown as WebSocket, new Uint8Array([1, 2, 3]));
  expect(ws.sent).toHaveLength(1);
});

test("finishSttSocket sends stop and resolves with final transcript", async () => {
  const ws = new FakeWebSocket("wss://x");
  ws.readyState = FakeWebSocket.OPEN;

  const promise = finishSttSocket(ws as unknown as WebSocket, 1000);
  expect(JSON.parse(ws.sent[0] as string)).toEqual({ type: "stop" });

  ws.triggerMessage(JSON.stringify({ type: "final", transcript: "merhaba dünya" }));
  await expect(promise).resolves.toEqual({ transcript: "merhaba dünya" });
});

test("finishSttSocket resolves with empty transcript on timeout", async () => {
  const ws = new FakeWebSocket("wss://x");
  ws.readyState = FakeWebSocket.OPEN;
  await expect(finishSttSocket(ws as unknown as WebSocket, 10)).resolves.toEqual({ transcript: "" });
});
