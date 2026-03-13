import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
  duration?: number;
}

export function Toast({
  message,
  visible,
  onDismiss,
  onRetry,
  duration = 4000,
}: ToastProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });

      if (!onRetry) {
        opacity.value = withDelay(duration, withTiming(0, { duration: 200 }));
        translateY.value = withDelay(
          duration,
          withTiming(-20, { duration: 200 })
        );
        const timer = setTimeout(onDismiss, duration + 200);
        return () => clearTimeout(timer);
      }
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(-20, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        animatedStyle,
      ]}
    >
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={[styles.retry, { color: colors.accent }]}>Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1000,
  },
  message: { fontSize: 14, flex: 1 },
  retry: { fontSize: 14, fontWeight: "600", marginLeft: 12 },
});
