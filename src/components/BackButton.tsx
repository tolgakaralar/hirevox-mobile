import { Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Geri"
      style={styles.button}
      hitSlop={8}
    >
      <Text style={styles.chevron}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 66,
    left: 28,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  chevron: {
    fontSize: 22,
    fontWeight: "400",
    color: colors.chevron,
  },
});
