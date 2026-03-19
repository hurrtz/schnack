import React from "react";
import {
  Platform,
  View,
  requireNativeComponent,
  type ColorValue,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

type NativeWaveformViewProps = ViewProps & {
  channel?: "input" | "output";
  active?: boolean;
  lineColor?: ColorValue;
  baselineColor?: ColorValue;
  lineWidth?: number;
  renderStyle?: "automatic" | "waveform" | "envelope";
  style?: StyleProp<ViewStyle>;
};

const NativeWaveformComponent =
  Platform.OS === "ios"
    ? requireNativeComponent<NativeWaveformViewProps>(
        "SchnackNativeWaveformView"
      )
    : null;

export function NativeWaveformView(props: NativeWaveformViewProps) {
  if (Platform.OS !== "ios" || !NativeWaveformComponent) {
    return <View pointerEvents="none" style={props.style} />;
  }

  return <NativeWaveformComponent {...props} pointerEvents="none" />;
}
