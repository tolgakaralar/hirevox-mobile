import { computeRmsLevel } from "../audioLevel";

test("silence (all-zero samples) returns level 0", () => {
  expect(computeRmsLevel(new Uint8Array(64))).toBe(0);
});

test("empty buffer returns level 0", () => {
  expect(computeRmsLevel(new Uint8Array(0))).toBe(0);
});

test("a loud constant-amplitude tone clamps at the ceiling", () => {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    bytes[i * 2] = 0xff;
    bytes[i * 2 + 1] = 0x7f; // 16-bit little-endian max positive amplitude
  }
  expect(computeRmsLevel(bytes)).toBe(1);
});

test("a moderate-amplitude tone returns a level strictly between silence and the ceiling", () => {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    bytes[i * 2] = 1500 & 0xff;
    bytes[i * 2 + 1] = (1500 >> 8) & 0xff;
  }
  const level = computeRmsLevel(bytes);
  expect(level).toBeGreaterThan(0);
  expect(level).toBeLessThan(1);
});

test("louder amplitude produces a higher level than quieter amplitude", () => {
  const makeBytes = (amplitude: number) => {
    const bytes = new Uint8Array(64);
    for (let i = 0; i < 32; i++) {
      bytes[i * 2] = amplitude & 0xff;
      bytes[i * 2 + 1] = (amplitude >> 8) & 0xff;
    }
    return bytes;
  };
  expect(computeRmsLevel(makeBytes(2000))).toBeGreaterThan(computeRmsLevel(makeBytes(500)));
});
