process.env.EXPO_PUBLIC_API_BASE_URL = "https://test.local";

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
