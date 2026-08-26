import { render } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";
import { useNetworkTolerance } from "../useNetworkTolerance";

jest.mock("@react-native-community/netinfo");
jest.useFakeTimers();

let listener: (state: { isConnected: boolean | null }) => void;

beforeEach(() => {
  jest.mocked(NetInfo.addEventListener).mockImplementation((cb) => {
    listener = cb as never;
    return jest.fn();
  });
});

function Probe({ onExceeded, toleranceMs }: { onExceeded: () => void; toleranceMs?: number }) {
  useNetworkTolerance(onExceeded, toleranceMs);
  return null;
}

test("does not fire callback if reconnected before tolerance elapses", () => {
  const onExceeded = jest.fn();
  render(<Probe onExceeded={onExceeded} toleranceMs={45000} />);

  listener({ isConnected: false });
  jest.advanceTimersByTime(30000);
  listener({ isConnected: true });
  jest.advanceTimersByTime(20000);

  expect(onExceeded).not.toHaveBeenCalled();
});

test("fires callback once tolerance elapses while disconnected", () => {
  const onExceeded = jest.fn();
  render(<Probe onExceeded={onExceeded} toleranceMs={45000} />);

  listener({ isConnected: false });
  jest.advanceTimersByTime(45000);

  expect(onExceeded).toHaveBeenCalledTimes(1);
});

test("reconnecting after firing does not fire again", () => {
  const onExceeded = jest.fn();
  render(<Probe onExceeded={onExceeded} toleranceMs={45000} />);

  listener({ isConnected: false });
  jest.advanceTimersByTime(45000);
  listener({ isConnected: true });
  listener({ isConnected: false });
  jest.advanceTimersByTime(10000);

  expect(onExceeded).toHaveBeenCalledTimes(1);
});
