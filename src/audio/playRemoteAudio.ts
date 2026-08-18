import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
let currentPlayer: AudioPlayer | null = null;

export async function playRemoteAudio(fileName: string): Promise<void> {
  if (currentPlayer) {
    currentPlayer.remove();
    currentPlayer = null;
  }
  const player = createAudioPlayer(`${BASE}/sesler/${fileName}`);
  currentPlayer = player;
  return new Promise((resolve) => {
    const subscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (status.didJustFinish) {
        subscription.remove();
        resolve();
      }
    });
    player.play();
  });
}

export async function stopRemoteAudio(): Promise<void> {
  if (currentPlayer) {
    currentPlayer.pause();
    currentPlayer.remove();
    currentPlayer = null;
  }
}
