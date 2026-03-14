import { Platform } from "react-native";

export const fonts = {
  display: Platform.select({
    ios: "AvenirNext-DemiBold",
    android: "sans-serif-condensed",
    default: undefined,
  }),
  displayHeavy: Platform.select({
    ios: "AvenirNext-Heavy",
    android: "sans-serif-condensed",
    default: undefined,
  }),
  body: Platform.select({
    ios: "AvenirNext-Regular",
    android: "sans-serif",
    default: undefined,
  }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
};
