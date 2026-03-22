import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "../i18n";
import { AppLanguage, Provider } from "../types";
import { useTheme } from "../theme/ThemeContext";

import { TABS } from "./settings/constants";
import { getTabLabel } from "./settings/helpers";
import { InstructionsTab } from "./settings/InstructionsTab";
import { ProvidersTab } from "./settings/ProvidersTab";
import { TabIntro } from "./settings/shared";
import { styles } from "./settings/styles";
import { SttTab } from "./settings/SttTab";
import { TtsTab } from "./settings/TtsTab";
import { SettingsModalProps } from "./settings/types";
import { UiTab } from "./settings/UiTab";
import { useSettingsModalController } from "./settings/useSettingsModalController";

export function SettingsModal(props: SettingsModalProps) {
  const {
    visible,
    settings,
    focusProvider,
    onUpdate,
    onUpdateResponseModeRoute,
    onUpdateProviderSttModel,
    onUpdateProviderTtsModel,
    onUpdateProviderTtsVoice,
    onUpdateLocalTtsVoice,
    onUpdateApiKey,
    localTtsPackStates,
    onInstallLocalTtsLanguagePack,
    onPreviewVoice,
    onStopPreviewVoice,
    onValidateProvider,
    onClose,
  } = props;
  const { colors } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const {
    contentScrollRef,
    activeTab,
    setActiveTab,
    providerPreviewTexts,
    setProviderPreviewTexts,
    localPreviewTexts,
    setLocalPreviewTexts,
    nativePreviewText,
    setNativePreviewText,
    activePreview,
    keyboardInset,
    speechDiagnostics,
    enabledSttProviders,
    enabledTtsProviders,
    modalAnimStyle,
    handleTextInputFocus,
    handlePreviewLocalVoice,
    handlePreviewProviderVoice,
    handlePreviewNativeVoice,
    providerPickerDisabled,
    ttsProviderPickerDisabled,
    selectedSttProviderModelOptions,
    selectedSttProviderModel,
    sttLanguageNote,
    ttsLanguageNote,
    selectedPreviewProvider,
    selectedPreviewProviderModelOptions,
    selectedPreviewProviderModel,
    nativeVoiceOptions,
    selectedNativeVoice,
    setSelectedNativeVoice,
    toggleListenLanguage,
  } = useSettingsModalController({
    visible,
    focusProvider,
    settings,
    onUpdate,
    onPreviewVoice,
    onStopPreviewVoice,
  });

  return (
    <Modal visible={visible} transparent animationType="none">
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top + 10, 24),
            paddingBottom: 0,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.modal,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.glow,
            },
            modalAnimStyle,
          ]}
        >
          <LinearGradient
            colors={[colors.accentSoft, "rgba(255, 255, 255, 0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGlow}
          />

          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("settings")}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              onPress={onClose}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            style={styles.tabScroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
            contentInsetAdjustmentBehavior="never"
          >
            {TABS.map((tab) => {
              const active = tab === activeTab;

              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: active
                        ? colors.surfaceElevated
                        : colors.surface,
                      borderColor: active ? colors.borderStrong : colors.border,
                    },
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      { color: active ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {getTabLabel(tab, t)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            ref={contentScrollRef}
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(20, keyboardInset + 20) },
            ]}
            scrollIndicatorInsets={{ bottom: keyboardInset }}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            nestedScrollEnabled
          >
            <TabIntro tab={activeTab} />

            {activeTab === "instructions" ? (
              <InstructionsTab
                settings={settings}
                onUpdate={onUpdate}
                onTextInputFocus={handleTextInputFocus}
              />
            ) : null}

            {activeTab === "providers" ? (
              <ProvidersTab
                settings={settings}
                focusProvider={focusProvider}
                onUpdateResponseModeRoute={onUpdateResponseModeRoute}
                onUpdateApiKey={onUpdateApiKey}
                onTextInputFocus={handleTextInputFocus}
                onValidateProvider={onValidateProvider}
              />
            ) : null}

            {activeTab === "stt" ? (
              <SttTab
                settings={settings}
                enabledSttProviders={enabledSttProviders}
                providerPickerDisabled={providerPickerDisabled}
                selectedSttProviderModelOptions={selectedSttProviderModelOptions}
                selectedSttProviderModel={selectedSttProviderModel}
                sttLanguageNote={sttLanguageNote}
                onUpdate={onUpdate}
                onUpdateProviderSttModel={onUpdateProviderSttModel}
              />
            ) : null}

            {activeTab === "tts" ? (
              <TtsTab
                settings={settings}
                enabledTtsProviders={enabledTtsProviders}
                ttsProviderPickerDisabled={ttsProviderPickerDisabled}
                ttsLanguageNote={ttsLanguageNote}
                selectedPreviewProvider={selectedPreviewProvider}
                selectedPreviewProviderModelOptions={
                  selectedPreviewProviderModelOptions
                }
                selectedPreviewProviderModel={selectedPreviewProviderModel}
                providerPreviewTexts={providerPreviewTexts}
                localPreviewTexts={localPreviewTexts}
                activePreview={activePreview}
                localTtsPackStates={localTtsPackStates}
                nativeVoiceOptions={nativeVoiceOptions}
                selectedNativeVoice={selectedNativeVoice}
                nativePreviewText={nativePreviewText}
                speechDiagnostics={speechDiagnostics}
                onUpdate={onUpdate}
                onUpdateProviderTtsModel={onUpdateProviderTtsModel}
                onUpdateProviderTtsVoice={onUpdateProviderTtsVoice}
                onUpdateLocalTtsVoice={onUpdateLocalTtsVoice}
                onInstallLocalTtsLanguagePack={onInstallLocalTtsLanguagePack}
                onStopPreviewVoice={onStopPreviewVoice}
                onSetProviderPreviewText={(
                  provider: Provider,
                  language: string,
                  text: string,
                ) => {
                  setProviderPreviewTexts((previous) => ({
                    ...previous,
                    [provider]: {
                      ...previous[provider],
                      [language]: text,
                    },
                  }));
                }}
                onSetLocalPreviewText={(language, text) => {
                  setLocalPreviewTexts((previous) => ({
                    ...previous,
                    [language]: text,
                  }));
                }}
                onSetNativePreviewText={setNativePreviewText}
                onPreviewProviderVoice={handlePreviewProviderVoice}
                onPreviewLocalVoice={handlePreviewLocalVoice}
                onPreviewNativeVoice={handlePreviewNativeVoice}
                onSelectNativeVoice={setSelectedNativeVoice}
                onTextInputFocus={handleTextInputFocus}
                onToggleListenLanguage={toggleListenLanguage}
              />
            ) : null}

            {activeTab === "ui" ? (
              <UiTab settings={settings} onUpdate={onUpdate} />
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
