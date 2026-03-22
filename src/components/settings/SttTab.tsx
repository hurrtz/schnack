import React from "react";
import { Text } from "react-native";

import { useLocalization } from "../../i18n";
import { InputMode, Provider, Settings, SttBackendMode } from "../../types";
import { useTheme } from "../../theme/ThemeContext";
import { Picker } from "../Picker";

import { renderProviderPickerOptions } from "./helpers";
import { PickerSection, RadioGroup } from "./shared";

interface SttTabProps {
  settings: Settings;
  enabledSttProviders: Provider[];
  providerPickerDisabled: boolean;
  selectedSttProviderModelOptions: { id: string; name: string }[];
  selectedSttProviderModel: string;
  sttLanguageNote: string | null;
  onUpdate: (
    partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>,
  ) => void;
  onUpdateProviderSttModel: (provider: Provider, model: string) => void;
}

export function SttTab({
  settings,
  enabledSttProviders,
  providerPickerDisabled,
  selectedSttProviderModelOptions,
  selectedSttProviderModel,
  sttLanguageNote,
  onUpdate,
  onUpdateProviderSttModel,
}: SttTabProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();

  return (
    <>
      <RadioGroup<InputMode>
        label={t("inputMode")}
        options={[
          {
            value: "push-to-talk",
            label: t("pushToTalk"),
            description: t("pushToTalkDescription"),
          },
          {
            value: "toggle-to-talk",
            label: t("toggleToTalk"),
            description: t("toggleToTalkDescription"),
          },
        ]}
        value={settings.inputMode}
        onChange={(value) => onUpdate({ inputMode: value })}
      />

      <RadioGroup<SttBackendMode>
        label={t("speechToText")}
        options={[
          {
            value: "native",
            label: t("appNative"),
            description: t("nativeSttDescription"),
          },
          {
            value: "provider",
            label: t("provider"),
            description: t("providerSttDescription"),
          },
        ]}
        value={settings.sttMode}
        onChange={(value) => onUpdate({ sttMode: value })}
      />

      <PickerSection>
        <Picker
          label={t("sttProvider")}
          value={settings.sttProvider ?? ""}
          options={renderProviderPickerOptions(enabledSttProviders)}
          onChange={(value) => onUpdate({ sttProvider: value as Provider })}
          disabled={providerPickerDisabled}
        />
        {settings.sttProvider && selectedSttProviderModelOptions.length > 1 ? (
          <Picker
            label={t("model")}
            value={selectedSttProviderModel}
            options={selectedSttProviderModelOptions.map((model) => ({
              value: model.id,
              label: model.name,
            }))}
            onChange={(value) =>
              onUpdateProviderSttModel(settings.sttProvider!, value)
            }
          />
        ) : null}
        <Text style={{ color: colors.textMuted }}>
          {settings.sttMode === "provider"
            ? enabledSttProviders.length > 0
              ? t("sttProviderEnabledHint")
              : t("sttProviderMissingHint")
            : t("nativeSttHint")}
        </Text>
        {sttLanguageNote ? (
          <Text style={{ color: colors.textMuted }}>
            {t("languageCoverage", { note: sttLanguageNote })}
          </Text>
        ) : null}
      </PickerSection>
    </>
  );
}
