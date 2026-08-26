// RMS amplitude of 16-bit little-endian PCM samples, normalized to 0-1.
// Speech RMS sits well below the 16-bit ceiling (32768), so this divides
// by a much smaller reference to keep the meter responsive to normal
// speaking volume rather than only reacting near clipping.
export function computeRmsLevel(pcmBytes: Uint8Array): number {
  const sampleCount = Math.floor(pcmBytes.length / 2);
  if (sampleCount === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i++) {
    let sample = pcmBytes[i * 2] | (pcmBytes[i * 2 + 1] << 8);
    if (sample >= 0x8000) sample -= 0x10000;
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / sampleCount);
  return Math.min(1, rms / 3000);
}
