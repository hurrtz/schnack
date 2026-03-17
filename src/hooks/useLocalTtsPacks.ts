import { useCallback, useEffect, useState } from "react";
import { installLocalTtsPack, getLocalTtsInstallStatus } from "../services/localTts";
import { Settings, TtsListenLanguage } from "../types";

type LocalPackState = {
  supported: boolean;
  installed: boolean;
  downloading: boolean;
  progress: number;
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
            installed: status.installed,
            downloading: false,
            progress: 0,
          },
        ] as const;
      })
    );

    setPackStates((previous) => {
      const next = Object.fromEntries(entries) as LocalPackStateMap;

      for (const [language, state] of Object.entries(previous) as Array<
        [TtsListenLanguage, LocalPackState]
      >) {
        if (state.downloading) {
          next[language] = state;
        }
      }

      return next;
    });
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
            installed: false,
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
                  installed: false,
                }),
                downloading: true,
                progress,
              },
            }));
          },
        });
      } finally {
        await refreshPackStates();
      }
    },
    [refreshPackStates, settings.localTtsVoices]
  );

  return {
    packStates,
    refreshPackStates,
    installLanguagePack,
  };
}
