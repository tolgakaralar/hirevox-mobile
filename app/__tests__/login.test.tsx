import { render, screen } from "@testing-library/react-native";
import LoginScreen from "../login";

test("renders login placeholder", () => {
  render(<LoginScreen />);
  expect(screen.getByText("login")).toBeTruthy();
});
