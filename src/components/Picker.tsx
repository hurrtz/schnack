import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";

interface PickerProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function Picker({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: PickerProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <TouchableOpacity
        style={[
          styles.dropdown,
          {
            backgroundColor: disabled ? colors.surface : colors.surfaceElevated,
            borderColor: colors.border,
            shadowColor: colors.glow,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
        onPress={() => {
          if (!disabled) {
            setOpen(true);
          }
        }}
        disabled={disabled}
      >
        <View style={styles.dropdownText}>
          <Text style={[styles.dropdownLabel, { color: colors.textSecondary }]}>
            {disabled ? "Unavailable" : "Selection"}
          </Text>
          <Text style={[styles.dropdownValue, { color: colors.text }]}>
            {disabled ? "Choose a compatible provider first" : selected?.label || value}
          </Text>
        </View>
        <View
          style={[
            styles.chevronWrap,
            { backgroundColor: colors.accentSoft, borderColor: colors.border },
          ]}
        >
          <Feather name="chevron-down" size={16} color={colors.accent} />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View
            style={[
              styles.list,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={[
                styles.listHeader,
                { borderBottomColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.listTitle, { color: colors.text }]}>
                {label}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    {
                      backgroundColor:
                        item.value === value
                          ? colors.accentSoft
                          : colors.surface,
                      borderColor:
                        item.value === value
                          ? colors.borderStrong
                          : colors.border,
                    },
                  ]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>
                    {item.label}
                  </Text>
                  {item.value === value ? (
                    <Feather name="check" size={16} color={colors.accent} />
                  ) : null}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 10,
    fontFamily: fonts.mono,
  },
  dropdown: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  dropdownText: {
    flex: 1,
    gap: 4,
  },
  dropdownLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontFamily: fonts.mono,
  },
  dropdownValue: {
    fontSize: 15,
    fontFamily: fonts.display,
  },
  chevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  list: {
    width: "80%",
    maxHeight: "60%",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  listTitle: {
    fontSize: 18,
    fontFamily: fonts.display,
  },
  listContent: {
    padding: 10,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: {
    fontSize: 15,
    fontFamily: fonts.body,
  },
});
