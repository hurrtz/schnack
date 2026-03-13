import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Settings, InputMode, TtsPlayback, ThemeMode } from "../types";
import { OPENAI_MODELS, ANTHROPIC_MODELS, TTS_VOICES } from "../constants/models";
import { Picker } from "./Picker";

interface SettingsModalProps {
  visible: boolean;
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  onClose: () => void;
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.radioRow}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.radioButton,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accentSoft : colors.background,
                },
              ]}
              onPress={() => onChange(opt.value)}
            >
              <Text
                style={[
                  styles.radioLabel,
                  { color: active ? colors.accent : colors.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsModal({
  visible,
  settings,
  onUpdate,
  onClose,
}: SettingsModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.modal, { backgroundColor: colors.surface }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.background }]}
              onPress={onClose}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView>
            <RadioGroup<InputMode>
              label="Input Mode"
              options={[
                { value: "push-to-talk", label: "Push to Talk" },
                { value: "toggle-to-talk", label: "Toggle to Talk" },
              ]}
              value={settings.inputMode}
              onChange={(v) => onUpdate({ inputMode: v })}
            />

            <RadioGroup<TtsPlayback>
              label="TTS Playback"
              options={[
                { value: "stream", label: "Stream" },
                { value: "wait", label: "Wait" },
              ]}
              value={settings.ttsPlayback}
              onChange={(v) => onUpdate({ ttsPlayback: v })}
            />

            <Picker
              label="OpenAI Model"
              value={settings.openaiModel}
              options={OPENAI_MODELS.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              onChange={(v) => onUpdate({ openaiModel: v })}
            />

            <Picker
              label="Anthropic Model"
              value={settings.anthropicModel}
              options={ANTHROPIC_MODELS.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              onChange={(v) => onUpdate({ anthropicModel: v })}
            />

            <Picker
              label="TTS Voice"
              value={settings.ttsVoice}
              options={TTS_VOICES.map((v) => ({
                value: v,
                label: v.charAt(0).toUpperCase() + v.slice(1),
              }))}
              onChange={(v) => onUpdate({ ttsVoice: v })}
            />

            <RadioGroup<ThemeMode>
              label="Theme"
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              value={settings.theme}
              onChange={(v) => onUpdate({ theme: v })}
            />
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    width: "90%",
    maxHeight: "80%",
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: "700" },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { marginBottom: 18 },
  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  radioRow: { flexDirection: "row", gap: 6 },
  radioButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },
  radioLabel: { fontSize: 12, fontWeight: "600" },
});
