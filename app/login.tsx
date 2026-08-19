import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useInterview } from "../src/state/InterviewContext";
import { login } from "../src/api/client";
import { saveSessionId } from "../src/storage/session";

export default function LoginScreen() {
  const router = useRouter();
  const { dispatch } = useInterview();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await login(code.trim());
      await saveSessionId(data.sessionId);
      dispatch({ type: "SET_SESSION", sessionId: data.sessionId });
      router.replace("/consent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text>HireVox</Text>
      {error && <Text>{error}</Text>}
      <TextInput
        placeholder="Erişim kodunu girin"
        value={code}
        onChangeText={setCode}
        secureTextEntry
        editable={!loading}
      />
      <Pressable onPress={handleSubmit} disabled={loading || !code.trim()}>
        {loading ? <ActivityIndicator /> : <Text>Mülakata Başla</Text>}
      </Pressable>
    </View>
  );
}
