import * as SecureStore from "expo-secure-store";
import { saveSessionId, loadSessionId, clearSessionId } from "../session";

jest.mock("expo-secure-store");

test("saveSessionId writes to SecureStore under fixed key", async () => {
  await saveSessionId("abc-123");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("hirevox.sessionId", "abc-123");
});

test("loadSessionId reads and returns stored value", async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("abc-123");
  await expect(loadSessionId()).resolves.toBe("abc-123");
});

test("loadSessionId returns null when nothing stored", async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  await expect(loadSessionId()).resolves.toBeNull();
});

test("clearSessionId deletes the key", async () => {
  await clearSessionId();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("hirevox.sessionId");
});
