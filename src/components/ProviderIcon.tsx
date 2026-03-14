import React from "react";
import { Image } from "react-native";
import { SvgUri } from "react-native-svg";
import { Provider } from "../types";

const PROVIDER_ICON_ASSETS: Record<Provider, number> = {
  openai: require("../../assets/branding/openai.svg"),
  anthropic: require("../../assets/branding/anthropic.svg"),
  gemini: require("../../assets/branding/google.svg"),
  cohere: require("../../assets/branding/cohere.svg"),
  deepseek: require("../../assets/branding/deepseek.svg"),
  groq: require("../../assets/branding/groq.svg"),
  mistral: require("../../assets/branding/mistral.svg"),
  nvidia: require("../../assets/branding/nvidia.svg"),
  together: require("../../assets/branding/together.svg"),
  xai: require("../../assets/branding/xai.svg"),
};

const PROVIDER_ICON_SIZES: Record<Provider, { width: number; height: number }> = {
  openai: { width: 24, height: 24 },
  anthropic: { width: 24, height: 24 },
  gemini: { width: 24, height: 24 },
  cohere: { width: 24, height: 24 },
  deepseek: { width: 24, height: 24 },
  groq: { width: 24, height: 24 },
  mistral: { width: 24, height: 24 },
  nvidia: { width: 28, height: 28 },
  together: { width: 24, height: 24 },
  xai: { width: 24, height: 24 },
};

interface ProviderIconProps {
  provider: Provider;
  color: string;
}

export function ProviderIcon({ provider, color }: ProviderIconProps) {
  const asset = PROVIDER_ICON_ASSETS[provider];
  const uri = Image.resolveAssetSource(asset).uri;
  const size = PROVIDER_ICON_SIZES[provider];

  return (
    <SvgUri
      width={size.width}
      height={size.height}
      uri={uri}
      color={color}
    />
  );
}
