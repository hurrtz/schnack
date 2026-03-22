import React from "react";
import { Text, TextInput, View } from "react-native";

import { useLocalization } from "../../i18n";
import {
  AssistantResponseLength,
  AssistantResponseTone,
  Settings,
} from "../../types";
import { useTheme } from "../../theme/ThemeContext";

import { getResponseLengthOptions, getResponseToneOptions } from "./helpers";
import { PickerSection, RadioGroup } from "./shared";
import { styles } from "./styles";
import { TextInputFocusHandler } from "./types";

interface InstructionsTabProps {
  settings: Settings;
  onUpdate: (
    partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>,
  ) => void;
  onTextInputFocus: TextInputFocusHandler;
}

export function InstructionsTab({
  settings,
  onUpdate,
  onTextInputFocus,
}: InstructionsTabProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const responseLengthOptions = getResponseLengthOptions(t);
  const responseToneOptions = getResponseToneOptions(t);
  const selectedLength = responseLengthOptions.find(
    (option) => option.value === settings.responseLength,
  );
  const selectedTone = responseToneOptions.find(
    (option) => option.value === settings.responseTone,
  );

  return (
    <>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {t("assistantInstructions")}
        </Text>
        <Text style={[styles.sectionIntro, { color: colors.textMuted }]}>
          {t("assistantInstructionsIntro")}
        </Text>

        <View
          style={[
            styles.promptCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.promptLabel, { color: colors.textSecondary }]}>
            {t("baseInstructions")}
          </Text>
          <TextInput
            value={settings.assistantInstructions}
            onChangeText={(value) => onUpdate({ assistantInstructions: value })}
            onFocus={onTextInputFocus}
            multiline
            placeholder={t("assistantInstructionsPlaceholder")}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            style={[
              styles.promptInput,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            {t("assistantInstructionsHint")}
          </Text>
        </View>
      </View>

      <PickerSection>
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
          {t("adaptiveLength")}
        </Text>
        <RadioGroup<AssistantResponseLength>
          label={t("adaptiveLength")}
          options={responseLengthOptions}
          value={settings.responseLength}
          onChange={(value) => onUpdate({ responseLength: value })}
        />
        {selectedLength ? (
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            {selectedLength.description}
          </Text>
        ) : null}
      </PickerSection>

      <PickerSection>
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
          {t("responseTone")}
        </Text>
        <RadioGroup<AssistantResponseTone>
          label={t("responseTone")}
          options={responseToneOptions}
          value={settings.responseTone}
          onChange={(value) => onUpdate({ responseTone: value })}
        />
        {selectedTone ? (
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            {selectedTone.description}
          </Text>
        ) : null}
      </PickerSection>
    </>
  );
}
