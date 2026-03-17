import { useCallback, useEffect, useState } from "react";
import {
  installLocalTtsPack,
  getLocalTtsInstallStatus,
} from "../services/localTts";
import { Settings, TtsListenLanguage } from "../types";

type LocalPackState = {
  supported: boolean;
  downloaded: boolean;
  verified: boolean;
  installed: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
};

type LocalPackStateMap = Partial<Record<TtsListenLanguage, LocalPackState>>;

export function useLocalTtsPacks(settings: Settings) {
  const [packStates, setPackStates] = useState<LocalPackStateMap>({});

  const refreshPackStates = useCallback(async () => {
    const languages = settings.ttsListenLanguages;

    if (languages.length === 0) {
      setPackStates({});
      return;
    }

    const entries = await Promise.all(
      languages.map(async (language) => {
        const status = await getLocalTtsInstallStatus({
          language,
          voice: settings.localTtsVoices[language],
        });

        return [
          language,
          {
            supported: status.supported,
            downloaded: status.downloaded,
            verified: status.verified,
            installed: status.installed,
            downloading: false,
            progress: 0,
            error: status.verificationError,
          },
        ] as const;
      }),
    );

    setPackStates(Object.fromEntries(entries) as LocalPackStateMap);
  }, [settings.localTtsVoices, settings.ttsListenLanguages]);

  useEffect(() => {
    void refreshPackStates();
  }, [refreshPackStates]);

  const installLanguagePack = useCallback(
    async (language: TtsListenLanguage) => {
      setPackStates((previous) => ({
        ...previous,
        [language]: {
          ...(previous[language] ?? {
            supported: true,
            downloaded: false,
            verified: false,
            installed: false,
            error: null,
          }),
          downloading: true,
          progress: 0,
        },
      }));

      try {
        await installLocalTtsPack({
          language,
          voice: settings.localTtsVoices[language],
          onProgress: (progress) => {
            setPackStates((previous) => ({
              ...previous,
              [language]: {
                ...(previous[language] ?? {
                  supported: true,
                  downloaded: false,
                  verified: false,
                  installed: false,
                  error: null,
                }),
                downloading: true,
                progress,
              },
            }));
          },
        });

        const status = await getLocalTtsInstallStatus({
          language,
          voice: settings.localTtsVoices[language],
        });

        if (!status.installed) {
          throw new Error(
            "The local voice pack download finished, but the files could not be verified on this device.",
          );
        }
      } finally {
        await refreshPackStates();
      }
    },
    [refreshPackStates, settings.localTtsVoices],
  );

  return {
    packStates,
    refreshPackStates,
    installLanguagePack,
  };
}
