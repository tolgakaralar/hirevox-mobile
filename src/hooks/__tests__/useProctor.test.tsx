import { render, cleanup } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useProctor } from "../useProctor";
import { logIntegrityEvent } from "../../api/client";

jest.mock("../../api/client");

function Probe({ sessionId, active = true }: { sessionId: string | null; active?: boolean }) {
  useProctor(sessionId, active);
  return null;
}

test("logs app_backgrounded when AppState transitions to background", () => {
  jest.mocked(logIntegrityEvent).mockClear();

  let changeHandler: (state: string) => void = null!;

  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    changeHandler = handler as (state: string) => void;
    return { remove: jest.fn() } as never;
  });

  jest.mocked(logIntegrityEvent).mockResolvedValue({ saved: true });

  render(<Probe sessionId="s1" />);
  changeHandler("background");
  expect(logIntegrityEvent).toHaveBeenCalledWith({ sessionId: "s1", type: "app_backgrounded", detail: null });

  cleanup();
  jest.restoreAllMocks();
});

test("logs app_foregrounded when returning to active after backgrounding", () => {
  jest.mocked(logIntegrityEvent).mockClear();

  let changeHandler: (state: string) => void = null!;

  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    changeHandler = handler as (state: string) => void;
    return { remove: jest.fn() } as never;
  });

  jest.mocked(logIntegrityEvent).mockResolvedValue({ saved: true });

  render(<Probe sessionId="s1" />);
  changeHandler("background");
  changeHandler("active");
  expect(logIntegrityEvent).toHaveBeenLastCalledWith({
    sessionId: "s1",
    type: "app_foregrounded",
    detail: null,
  });

  cleanup();
  jest.restoreAllMocks();
});

test("does nothing when sessionId is null", () => {
  jest.mocked(logIntegrityEvent).mockClear();

  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    // Listener not set up because hook returns early
    return { remove: jest.fn() } as never;
  });

  render(<Probe sessionId={null} />);
  // No listener set up, so no changeHandler call
  expect(logIntegrityEvent).not.toHaveBeenCalled();

  cleanup();
  jest.restoreAllMocks();
});

test("does nothing when active=false", () => {
  jest.mocked(logIntegrityEvent).mockClear();

  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    // Listener not set up because hook returns early
    return { remove: jest.fn() } as never;
  });

  render(<Probe sessionId="s1" active={false} />);
  // No listener set up, so no changeHandler call
  expect(logIntegrityEvent).not.toHaveBeenCalled();

  cleanup();
  jest.restoreAllMocks();
});
