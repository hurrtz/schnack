import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  staticRing: {
    position: "absolute",
    borderWidth: 1,
    opacity: 0.7,
  },
  staticRingOuter: {
    width: 244,
    height: 244,
    borderRadius: 122,
  },
  staticRingInner: {
    width: 208,
    height: 208,
    borderRadius: 104,
  },
  circle: {
    width: 188,
    height: 188,
    borderRadius: 94,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  innerFrame: {
    position: "absolute",
    top: 14,
    right: 14,
    bottom: 14,
    left: 14,
    borderRadius: 80,
    borderWidth: 1,
  },
  micIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  waveformWrap: {
    marginTop: 18,
  },
  waveformWrapOscilloscope: {
    marginTop: 0,
  },
  nativeWaveform: {
    alignSelf: "center",
  },
  nativeWaveformInput: {
    width: 164,
    height: 84,
  },
  nativeWaveformOutput: {
    width: 164,
    height: 84,
  },
  backgroundGradient: {
    position: "absolute",
    inset: -18,
  },
  backgroundGradientFill: {
    flex: 1,
    borderRadius: 112,
  },
  recordingGradientOverlay: {
    position: "absolute",
    inset: 0,
  },
  recordingGradientOverlayFill: {
    flex: 1,
    borderRadius: 94,
  },
  coreAura: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    overflow: "hidden",
  },
  coreAuraTop: {
    top: 12,
    left: 18,
  },
  coreAuraBottom: {
    bottom: 10,
    right: 12,
  },
  auraFill: {
    flex: 1,
  },
  sheen: {
    position: "absolute",
    width: 210,
    height: 72,
    borderRadius: 36,
    top: 24,
    left: -4,
    overflow: "hidden",
  },
  rippleRing: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
  },
});
