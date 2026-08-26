import type { TextStyle, ViewStyle } from "react-native";

// Design tokens per docs/design/2026-08-19-mobil-arayuz-tasarimi/README.md.
// iOS 402x874pt reference frame; all horizontal measurements are flexible.

export const colors = {
  bg: "#F3ECE3",
  surface: "#FAF5EA",
  surfaceAlt: "#F5EEE1",
  quoteBg: "#F1E8D7",
  border: "#E5DBCB",
  borderInput: "#E3D8C7",
  textStrong: "#3D3226",
  heading: "#4A3B2C",
  headingAlt: "#5A4A38",
  body: "#6E5D4C",
  muted: "#8A7A69",
  mutedSoft: "#9A8977",
  primary: "#C97B34",
  primaryDisabledBg: "#DED3C2",
  primaryDisabledFg: "#A0907C",
  danger: "#B23A2E",
  recording: "#C4392C",
  errorBg: "#F7DDD9",
  errorFg: "#9E3226",
  badgeBg: "#1D5A38",
  badgeFg: "#EAF3EC",
  micLevel: "#1D9A55",
  micTrack: "#EAE0CF",
  overlay: "rgba(58,47,36,.82)",
  overlayFg: "#F3E7D6",
  overlayDot: "#E0A03C",
  checkboxBorder: "#C6B69F",
  chevron: "#A2917E",
  logo: "#0F0F0F",
} as const;

export const typography: Record<string, TextStyle> = {
  screenTitleLogin: { fontSize: 27, fontWeight: "700", lineHeight: 27 * 1.15, letterSpacing: -0.4 },
  screenTitle: { fontSize: 25, fontWeight: "700", lineHeight: 25 * 1.2, letterSpacing: -0.4 },
  questionTitle: { fontSize: 23, fontWeight: "700", lineHeight: 23 * 1.2, letterSpacing: -0.3 },
  resultTitle: { fontSize: 26, fontWeight: "700", lineHeight: 26 * 1.25, letterSpacing: -0.4 },
  subtitle: { fontSize: 16, fontWeight: "400", lineHeight: 16 * 1.35 },
  body: { fontSize: 14.5, fontWeight: "400", lineHeight: 14.5 * 1.6 },
  listItem: { fontSize: 14.5, fontWeight: "400", lineHeight: 14.5 * 1.45 },
  boxTitle: { fontSize: 14.5, fontWeight: "700", lineHeight: 14.5 * 1.4 },
  meta: { fontSize: 13, fontWeight: "400", lineHeight: 13 * 1.4 },
  button: { fontSize: 16, fontWeight: "700" },
  counterIntro: { fontSize: 54, fontWeight: "700", lineHeight: 54 * 1.1, letterSpacing: -1, color: colors.primary, textAlign: "center" },
  counterQuestion: { fontSize: 52, fontWeight: "700", lineHeight: 52 * 1.1, letterSpacing: -1, color: colors.primary, textAlign: "center" },
  badge: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" },
  recordingLabel: { fontSize: 14.5, fontWeight: "700", color: colors.recording },
  logoWordmark: { fontSize: 15, fontWeight: "600", lineHeight: 15 * 1.08, letterSpacing: -0.2 },
  logoWordmarkSmall: { fontSize: 13, fontWeight: "600", lineHeight: 13 * 1.08, letterSpacing: -0.2 },
};

export const spacing = {
  screenPaddingHorizontal: 14,
  screenPaddingTop: 52,
  screenPaddingTopLarge: 56, // Login / Evaluating / Result
  screenPaddingBottom: 32,
} as const;

export const radius = {
  card: 22,
  box: 12,
  button: 10,
  input: 10,
  questionBlock: 8,
  badge: 999,
  checkbox: 5,
  cameraPip: 12,
  bar: 999,
} as const;

export const cardShadow: ViewStyle = {
  shadowColor: colors.heading,
  shadowOpacity: 0.07,
  shadowRadius: 15,
  shadowOffset: { width: 0, height: 10 },
  elevation: 3,
};

export const cardStyle: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.card,
  padding: 28,
  ...cardShadow,
};

export const boxStyle: ViewStyle = {
  backgroundColor: colors.surfaceAlt,
  borderRadius: radius.box,
  borderWidth: 1,
  borderColor: colors.border,
  paddingVertical: 15,
  paddingHorizontal: 16,
};

export const buttonStyle: ViewStyle = {
  borderRadius: radius.button,
  paddingVertical: 16,
  alignItems: "center",
  width: "100%",
};

export const inputStyle: ViewStyle = {
  borderRadius: radius.input,
  borderWidth: 1,
  borderColor: colors.borderInput,
  backgroundColor: colors.surfaceAlt,
  paddingVertical: 14,
  paddingHorizontal: 15,
};
