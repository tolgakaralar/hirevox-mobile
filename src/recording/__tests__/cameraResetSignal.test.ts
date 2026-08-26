import { subscribeCameraReset, triggerCameraReset } from "../cameraResetSignal";

test("subscribers are notified when triggerCameraReset is called", () => {
  const listener = jest.fn();
  subscribeCameraReset(listener);

  triggerCameraReset();

  expect(listener).toHaveBeenCalledTimes(1);
});

test("unsubscribing stops further notifications", () => {
  const listener = jest.fn();
  const unsubscribe = subscribeCameraReset(listener);
  unsubscribe();

  triggerCameraReset();

  expect(listener).not.toHaveBeenCalled();
});

test("multiple subscribers are all notified", () => {
  const a = jest.fn();
  const b = jest.fn();
  subscribeCameraReset(a);
  subscribeCameraReset(b);

  triggerCameraReset();

  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(1);
});
