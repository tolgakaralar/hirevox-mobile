// Plain module-level pub/sub (not React Context) so non-component code
// (sessionRecorder.ts) can signal CameraHost — a React component — to
// force-refresh the camera session, without needing to be a hook itself.
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeCameraReset(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function triggerCameraReset(): void {
  listeners.forEach((listener) => listener());
}
