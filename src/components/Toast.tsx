import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useLocalization } from "../i18n";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";

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
  const { t } = useLocalization();
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
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={[colors.accentGradientStart, colors.accentGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.accentStripe}
      />
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.accentSoft, borderColor: colors.border },
        ]}
      >
        <Feather name="alert-circle" size={16} color={colors.accent} />
      </View>
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          style={[
            styles.retryButton,
            { backgroundColor: colors.accentSoft, borderColor: colors.border },
          ]}
          onPress={onRetry}
        >
          <Text style={[styles.retry, { color: colors.accent }]}>
            {t("retry")}
          </Text>
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
    paddingLeft: 0,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1000,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 8,
  },
  accentStripe: {
    alignSelf: "stretch",
    width: 5,
    marginRight: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    fontFamily: fonts.body,
  },
  retryButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  retry: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
});
