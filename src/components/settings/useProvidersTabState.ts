import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";

import {
  PROVIDER_API_KEY_URLS,
  PROVIDER_LABELS,
} from "../../constants/models";
import { useLocalization } from "../../i18n";
import { Provider, Settings } from "../../types";
import { getProviderValidationModel } from "../../utils/responseModes";

import { ProviderValidationState } from "./types";

export function useProvidersTabState(params: {
  settings: Settings;
  focusProvider?: Provider;
  onValidateProvider: (provider: Provider) => Promise<void>;
}) {
  const { settings, focusProvider, onValidateProvider } = params;
  const { t } = useLocalization();
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
  const trimmedSelectedProviderApiKey = selectedProviderApiKey.trim();
  const selectedProviderModel = getProviderValidationModel(
    settings,
    selectedProvider,
  );
  const storedValidationState = validationStateByProvider[selectedProvider];
  const validationState = useMemo(() => {
    const validationStateMatchesCurrentSelection =
      storedValidationState?.apiKey === trimmedSelectedProviderApiKey &&
      storedValidationState?.model === selectedProviderModel;

    return validationStateMatchesCurrentSelection
      ? storedValidationState ?? { status: "idle" as const }
      : { status: "idle" as const };
  }, [
    selectedProviderModel,
    storedValidationState,
    trimmedSelectedProviderApiKey,
  ]);
  const hasApiKey = trimmedSelectedProviderApiKey.length > 0;
  const shouldShowValidateAction =
    hasApiKey && validationState.status !== "success";

  const handleOpenProviderPortal = useCallback(() => {
    void Linking.openURL(PROVIDER_API_KEY_URLS[selectedProvider]);
  }, [selectedProvider]);

  const handleValidateProviderKey = useCallback(async () => {
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
  }, [
    onValidateProvider,
    selectedProvider,
    selectedProviderModel,
    t,
    trimmedSelectedProviderApiKey,
  ]);

  return {
    selectedProvider,
    setSelectedProvider,
    apiKeyVisible,
    setApiKeyVisible,
    selectedProviderApiKey,
    validationState,
    shouldShowValidateAction,
    secureApiKey: hasApiKey && !apiKeyVisible,
    handleOpenProviderPortal,
    handleValidateProviderKey,
  };
}
