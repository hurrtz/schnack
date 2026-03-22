import React, { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Feather } from "@expo/vector-icons";

import {
  PROVIDER_API_KEY_URLS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  PROVIDER_ORDER,
  getProviderApiKeyHint,
  getProviderApiKeyPlaceholder,
} from "../../constants/models";
import { useLocalization } from "../../i18n";
import {
  Provider,
  ResponseMode,
  ResponseModeRoute,
  Settings,
} from "../../types";
import { useTheme } from "../../theme/ThemeContext";
import { getEnabledProviders } from "../../utils/providerCapabilities";
import {
  getDefaultModelForProvider,
  getProviderValidationModel,
  isValidModelForProvider,
  RESPONSE_MODE_ORDER,
} from "../../utils/responseModes";
import { Picker } from "../Picker";
import { ProviderIcon } from "../ProviderIcon";

import {
  getResponseModeDescription,
  getResponseModeLabel,
  renderProviderPickerOptions,
} from "./helpers";
import { styles } from "./styles";
import {
  ProviderValidationState,
  TextInputFocusHandler,
} from "./types";

interface ProvidersTabProps {
  settings: Settings;
  focusProvider?: Provider;
  onUpdateResponseModeRoute: (
    mode: ResponseMode,
    route: ResponseModeRoute,
  ) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
  onTextInputFocus: TextInputFocusHandler;
  onValidateProvider: (provider: Provider) => Promise<void>;
}

function ResponseModesSection({
  settings,
  enabledProviders,
  onUpdateResponseModeRoute,
}: {
  settings: Settings;
  enabledProviders: Provider[];
  onUpdateResponseModeRoute: (
    mode: ResponseMode,
    route: ResponseModeRoute,
  ) => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocalization();

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t("responseModes")}
      </Text>

      <View style={styles.responseModeList}>
        {RESPONSE_MODE_ORDER.map((mode, index) => {
          const route = settings.responseModes[mode];

          return (
            <View
              key={mode}
              style={[
                styles.responseModeItem,
                {
                  borderTopColor: colors.border,
                  borderTopWidth: index === 0 ? 0 : 1,
                  paddingBottom:
                    index === RESPONSE_MODE_ORDER.length - 1 ? 4 : 18,
                  paddingTop: index === 0 ? 8 : 20,
                },
              ]}
            >
              <View style={styles.responseModeCopy}>
                <Text style={[styles.responseModeTitle, { color: colors.text }]}>
                  {getResponseModeLabel(mode, t)}
                </Text>
                <Text
                  style={[
                    styles.responseModeDescription,
                    { color: colors.textMuted },
                  ]}
                >
                  {getResponseModeDescription(mode, t)}
                </Text>
              </View>

              <Picker
                label={t("provider")}
                dropdownLabel={t("provider")}
                hideLabel
                containerStyle={styles.responseModePicker}
                value={route.provider}
                options={renderProviderPickerOptions(enabledProviders)}
                disabled={enabledProviders.length === 0}
                onChange={(value) => {
                  const nextProvider = value as Provider;
                  const preferredModel = settings.providerModels[nextProvider];
                  const nextModel = isValidModelForProvider(
                    nextProvider,
                    preferredModel,
                  )
                    ? preferredModel
                    : getDefaultModelForProvider(nextProvider);

                  onUpdateResponseModeRoute(mode, {
                    provider: nextProvider,
                    model: nextModel,
                  });
                }}
              />

              <Picker
                label={t("model")}
                dropdownLabel={t("model")}
                hideLabel
                containerStyle={styles.responseModePickerLast}
                value={route.model}
                options={PROVIDER_MODELS[route.provider].map((model) => ({
                  value: model.id,
                  label: model.name,
                }))}
                onChange={(value) =>
                  onUpdateResponseModeRoute(mode, {
                    ...route,
                    model: value,
                  })
                }
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ProvidersTab({
  settings,
  focusProvider,
  onUpdateResponseModeRoute,
  onUpdateApiKey,
  onTextInputFocus,
  onValidateProvider,
}: ProvidersTabProps) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();
  const enabledProviders = useMemo(() => getEnabledProviders(settings), [settings]);
  const [selectedProvider, setSelectedProvider] = useState<Provider>(
    focusProvider ?? settings.lastProvider,
  );
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [validationStateByProvider, setValidationStateByProvider] = useState<
    Partial<Record<Provider, ProviderValidationState>>
  >({});

  useEffect(() => {
    setSelectedProvider(focusProvider ?? settings.lastProvider);
  }, [focusProvider, settings.lastProvider]);

  useEffect(() => {
    setApiKeyVisible(false);
  }, [selectedProvider]);

  const selectedProviderApiKey = settings.apiKeys[selectedProvider];
  const selectedProviderModel = getProviderValidationModel(
    settings,
    selectedProvider,
  );
  const trimmedSelectedProviderApiKey = selectedProviderApiKey.trim();

  const handleOpenProviderPortal = React.useCallback(() => {
    void Linking.openURL(PROVIDER_API_KEY_URLS[selectedProvider]);
  }, [selectedProvider]);
  const storedValidationState = validationStateByProvider[selectedProvider];
  const validationStateMatchesCurrentSelection =
    storedValidationState?.apiKey === trimmedSelectedProviderApiKey &&
    storedValidationState?.model === selectedProviderModel;
  const validationState = validationStateMatchesCurrentSelection
    ? storedValidationState ?? { status: "idle" as const }
    : { status: "idle" as const };
  const hasApiKey = trimmedSelectedProviderApiKey.length > 0;
  const shouldShowValidateAction =
    hasApiKey && validationState.status !== "success";
  const secureApiKey = hasApiKey && !apiKeyVisible;

  const handleValidateProviderKey = async () => {
    setValidationStateByProvider((previous) => ({
      ...previous,
      [selectedProvider]: {
        status: "validating",
        apiKey: trimmedSelectedProviderApiKey,
        model: selectedProviderModel,
      },
    }));

    try {
      await onValidateProvider(selectedProvider);
      setValidationStateByProvider((previous) => ({
        ...previous,
        [selectedProvider]: {
          status: "success",
          message: t("providerValidationSuccess", {
            provider: PROVIDER_LABELS[selectedProvider],
          }),
          apiKey: trimmedSelectedProviderApiKey,
          model: selectedProviderModel,
        },
      }));
    } catch (error) {
      setValidationStateByProvider((previous) => ({
        ...previous,
        [selectedProvider]: {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : t("providerValidationFailed"),
          apiKey: trimmedSelectedProviderApiKey,
          model: selectedProviderModel,
        },
      }));
    }
  };

  return (
    <>
      <ResponseModesSection
        settings={settings}
        enabledProviders={enabledProviders}
        onUpdateResponseModeRoute={onUpdateResponseModeRoute}
      />

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
          {t("providers")}
        </Text>

        <View style={styles.providerButtonGrid}>
          {PROVIDER_ORDER.map((provider) => {
            const active = provider === selectedProvider;
            const configured = settings.apiKeys[provider].trim().length > 0;

            return (
              <Pressable
                key={provider}
                style={[
                  styles.providerButton,
                  {
                    backgroundColor: active
                      ? colors.accentSoft
                      : configured
                        ? colors.surface
                        : colors.surfaceElevated,
                    borderColor: active
                      ? colors.accent
                      : configured
                        ? colors.borderStrong
                        : colors.border,
                    shadowColor: active
                      ? colors.accent
                      : configured
                        ? colors.glow
                        : "transparent",
                  },
                ]}
                onPress={() => setSelectedProvider(provider)}
                accessibilityRole="button"
                accessibilityLabel={t("openProviderSettings", {
                  provider: PROVIDER_LABELS[provider],
                })}
                accessibilityState={{ selected: active }}
              >
                <ProviderIcon
                  provider={provider}
                  color={
                    active || configured ? colors.text : colors.textSecondary
                  }
                />
                {configured ? (
                  <View
                    style={[
                      styles.providerButtonBadge,
                      {
                        backgroundColor: active
                          ? colors.surface
                          : colors.accent,
                        borderColor: colors.borderStrong,
                      },
                    ]}
                  >
                    <Feather
                      name="check"
                      size={10}
                      color={active ? colors.accent : colors.surface}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.apiKeyCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.apiKeyHeader}>
            <Text style={[styles.apiKeyTitle, { color: colors.text }]}>
              {PROVIDER_LABELS[selectedProvider]}
            </Text>
            <TouchableOpacity
              style={styles.apiKeyPortalLink}
              onPress={handleOpenProviderPortal}
              accessibilityRole="link"
              accessibilityLabel={t("createProviderApiKey", {
                provider: PROVIDER_LABELS[selectedProvider],
              })}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.apiKeyPortalLinkText, { color: colors.accent }]}
              >
                {t("createApiKey")}
              </Text>
              <Feather name="external-link" size={13} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.apiKeyHint, { color: colors.textMuted }]}>
            {getProviderApiKeyHint(selectedProvider, language)}
          </Text>
          <View style={styles.apiKeyInputRow}>
            <TextInput
              value={settings.apiKeys[selectedProvider]}
              onChangeText={(value) => onUpdateApiKey(selectedProvider, value)}
              onFocus={onTextInputFocus}
              placeholder={getProviderApiKeyPlaceholder(
                selectedProvider,
                language,
              )}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="password"
              importantForAutofill="no"
              spellCheck={false}
              contextMenuHidden={false}
              selectTextOnFocus={apiKeyVisible}
              keyboardType="ascii-capable"
              returnKeyType="done"
              secureTextEntry={secureApiKey}
              style={[
                styles.apiKeyInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.apiKeyVisibilityButton,
                {
                  backgroundColor: colors.surface,
                },
              ]}
              onPress={() => setApiKeyVisible((previous) => !previous)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={apiKeyVisible ? t("hideKey") : t("showKey")}
            >
              <Feather
                name={apiKeyVisible ? "eye-off" : "eye"}
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {shouldShowValidateAction ? (
            <View style={styles.apiKeyMetaRow}>
              <TouchableOpacity
                style={[
                  styles.apiKeyValidateLink,
                  validationState.status === "validating"
                    ? styles.apiKeyValidateLinkDisabled
                    : null,
                ]}
                onPress={() => {
                  void handleValidateProviderKey();
                }}
                activeOpacity={0.75}
                disabled={validationState.status === "validating"}
              >
                <Text
                  style={[styles.apiKeyValidateText, { color: colors.accent }]}
                >
                  {validationState.status === "validating"
                    ? t("validatingKey")
                    : t("validateKey")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <Text
            style={[
              styles.sectionHint,
              {
                color: colors.textMuted,
                marginTop: shouldShowValidateAction ? 8 : 10,
              },
            ]}
          >
            {t("apiKeyProtectedHint")}
          </Text>
          {validationState.status !== "idle" && validationState.message ? (
            <View
              style={[
                styles.validationCard,
                {
                  backgroundColor:
                    validationState.status === "success"
                      ? colors.accentSoft
                      : colors.surfaceElevated,
                  borderColor:
                    validationState.status === "success"
                      ? colors.borderStrong
                      : validationState.status === "error"
                        ? colors.danger
                        : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.validationText,
                  {
                    color:
                      validationState.status === "success"
                        ? colors.accent
                        : validationState.status === "error"
                          ? colors.danger
                          : colors.textSecondary,
                  },
                ]}
              >
                {validationState.message}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );
}
