import { TranslationKey } from "../../i18n";

export type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number | undefined>,
) => string;

export type ShowToastFn = (message: string, onRetry?: () => void) => void;
