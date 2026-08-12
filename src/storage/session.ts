import * as SecureStore from "expo-secure-store";

const KEY = "hirevox.sessionId";

export async function saveSessionId(sessionId: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, sessionId);
}

export async function loadSessionId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function clearSessionId(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
