import { View, Text, StyleSheet } from "react-native";
import { colors, typography } from "../theme/tokens";

// Placeholder for the real Orion Innovation logo asset — geometry mimics the
// design handoff's circle + skewed bar mark until a real SVG/PNG lands.
// See docs/design/2026-08-19-mobil-arayuz-tasarimi/README.md "Assets".
export function OrionLogo({ small = false }: { small?: boolean }) {
  const height = small ? 23 : 26;
  const circleSize = height;
  const borderWidth = small ? 6 : 7;

  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, { width: height * (46 / 26), height }]}>
        <View
          style={[
            styles.circle,
            { width: circleSize, height: circleSize, borderRadius: circleSize / 2, borderWidth },
          ]}
        />
        <View style={[styles.bar, { height, right: 4 }]} />
      </View>
      <Text style={[small ? typography.logoWordmarkSmall : typography.logoWordmark, { color: colors.logo }]}>
        Orion{"\n"}Innovation
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 26,
  },
  iconBox: {
    position: "relative",
  },
  circle: {
    position: "absolute",
    left: 0,
    top: 0,
    borderColor: colors.logo,
  },
  bar: {
    position: "absolute",
    top: 0,
    width: 9,
    backgroundColor: colors.logo,
    transform: [{ skewX: "-19deg" }],
  },
});
