import { render } from "@testing-library/react-native";
import { CameraHost } from "../CameraHost";
import { CameraRefProvider } from "../CameraRefContext";

const mockUsePathname = jest.fn();
jest.mock("expo-router", () => ({ usePathname: () => mockUsePathname() }));

let lastProps: Record<string, unknown> = {};
jest.mock("expo-camera", () => ({
  CameraView: (props: Record<string, unknown>) => {
    lastProps = props;
    return null;
  },
}));

test("full-size visible style while on /prep", () => {
  mockUsePathname.mockReturnValue("/prep");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ width: "100%" });
});

test("hidden 1x1 style on any other route, e.g. /question", () => {
  mockUsePathname.mockReturnValue("/question");
  render(
    <CameraRefProvider>
      <CameraHost />
    </CameraRefProvider>
  );
  expect(lastProps.style).toMatchObject({ width: 1, height: 1, opacity: 0 });
});
