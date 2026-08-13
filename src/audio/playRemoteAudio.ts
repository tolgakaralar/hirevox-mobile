import { Audio } from "expo-av";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
let currentSound: Audio.Sound | null = null;

export async function playRemoteAudio(fileName: string): Promise<void> {
  if (currentSound) {
    await currentSound.unloadAsync();
    currentSound = null;
  }
  const { sound } = await Audio.Sound.createAsync({ uri: `${BASE}/sesler/${fileName}` });
  currentSound = sound;
  return new Promise((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        resolve();
      }
    });
    sound.playAsync();
  });
}

export async function stopRemoteAudio(): Promise<void> {
  if (currentSound) {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
    currentSound = null;
  }
}
