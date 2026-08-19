import { formatCountdown, formatElapsed } from "../time";

test("formatCountdown zero-pads both minutes and seconds", () => {
  expect(formatCountdown(100)).toBe("01:40");
  expect(formatCountdown(5)).toBe("00:05");
  expect(formatCountdown(0)).toBe("00:00");
});

test("formatCountdown clamps negative values to 00:00", () => {
  expect(formatCountdown(-5)).toBe("00:00");
});

test("formatElapsed does not zero-pad minutes", () => {
  expect(formatElapsed(22)).toBe("0:22");
  expect(formatElapsed(82)).toBe("1:22");
});
