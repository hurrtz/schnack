import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Provider } from "../types";

interface ProviderToggleProps {
  selected: Provider;
  onSelect: (provider: Provider) => void;
}

export function ProviderToggle({ selected, onSelect }: ProviderToggleProps) {
  const { colors } = useTheme();

  const button = (provider: Provider, label: string) => {
    const active = selected === provider;
    return (
      <TouchableOpacity
        style={[
          styles.button,
          {
            borderColor: active ? colors.accent : "transparent",
            backgroundColor: colors.surface,
          },
        ]}
        onPress={() => onSelect(provider)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.label,
            { color: active ? colors.accent : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {button("openai", "OpenAI")}
      {button("anthropic", "Anthropic")}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
  },
  label: { fontSize: 14, fontWeight: "600" },
});
