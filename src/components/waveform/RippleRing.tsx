import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { styles } from "../WaveformCircle.styles";

export function RippleRing({
  delay,
  color,
  isActive,
  intensity,
}: {
  delay: number;
  color: string;
  isActive: boolean;
  intensity: number;
}) {
  const isActiveSV = useSharedValue(isActive);
  const intensitySV = useSharedValue(intensity);

  useEffect(() => {
    isActiveSV.value = isActive;
  }, [isActive, isActiveSV]);

  useEffect(() => {
    intensitySV.value = intensity;
  }, [intensity, intensitySV]);

  const duration = useDerivedValue(() => 2500 - intensitySV.value * 1300);
  const peakOpacity = useDerivedValue(() => 0.1 + intensitySV.value * 0.25);

  const animatedStyle = useAnimatedStyle(() => {
    if (!isActiveSV.value) {
      return { opacity: 0, transform: [{ scale: 0.8 }] };
    }

    return {
      opacity: withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(peakOpacity.value, {
              duration: 0,
              easing: Easing.linear,
            }),
            withTiming(0, {
              duration: duration.value,
              easing: Easing.out(Easing.ease),
            }),
          ),
          -1,
        ),
      ),
      transform: [
        {
          scale: withDelay(
            delay,
            withRepeat(
              withSequence(
                withTiming(0.7, { duration: 0, easing: Easing.linear }),
                withTiming(1.4, {
                  duration: duration.value,
                  easing: Easing.out(Easing.ease),
                }),
              ),
              -1,
            ),
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.rippleRing, { borderColor: color }, animatedStyle]}
    />
  );
}
