import React, { useMemo } from "react";
import { Text, View } from "react-native";

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
  ProviderApiKeyCard,
  ProviderSelectionGrid,
  ResponseModesSection,
} from "./ProvidersSections";
import { styles } from "./styles";
import { TextInputFocusHandler } from "./types";
import { useProvidersTabState } from "./useProvidersTabState";

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

export function ProvidersTab({
  settings,
  focusProvider,
  onUpdateResponseModeRoute,
  onUpdateApiKey,
  onTextInputFocus,
  onValidateProvider,
}: ProvidersTabProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const enabledProviders = useMemo(() => getEnabledProviders(settings), [settings]);
  const {
    selectedProvider,
    setSelectedProvider,
    apiKeyVisible,
    setApiKeyVisible,
    selectedProviderApiKey,
    validationState,
    shouldShowValidateAction,
    secureApiKey,
    handleOpenProviderPortal,
    handleValidateProviderKey,
  } = useProvidersTabState({
    settings,
    focusProvider,
    onValidateProvider,
  });

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

        <ProviderSelectionGrid
          settings={settings}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
        />

        <ProviderApiKeyCard
          provider={selectedProvider}
          apiKey={selectedProviderApiKey}
          apiKeyVisible={apiKeyVisible}
          secureApiKey={secureApiKey}
          validationState={validationState}
          shouldShowValidateAction={shouldShowValidateAction}
          onOpenProviderPortal={handleOpenProviderPortal}
          onUpdateApiKey={onUpdateApiKey}
          onTextInputFocus={onTextInputFocus}
          onToggleApiKeyVisibility={() =>
            setApiKeyVisible((previous) => !previous)
          }
          onValidateProvider={handleValidateProviderKey}
        />
      </View>
    </>
  );
}
