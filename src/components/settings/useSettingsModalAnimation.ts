import { useEffect } from "react";

import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function useSettingsModalAnimation(visible: boolean) {
  const scale = useSharedValue(0.96);
  const translateY = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.96;
      translateY.value = 16;
      opacity.value = 0;
      return;
    }

    scale.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.ease),
    });
    translateY.value = withTiming(0, {
      duration: 240,
      easing: Easing.out(Easing.ease),
    });
    opacity.value = withTiming(1, { duration: 220 });
  }, [opacity, scale, translateY, visible]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));
}
