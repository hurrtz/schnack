function requireOpenAIKey(apiKey: string) {
  if (!apiKey) {
    throw new Error("OpenAI is not configured in Settings.");
  }

  return apiKey;
}

export async function transcribeAudio(
  fileUri: string,
  apiKey: string
): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", { uri: fileUri, type: "audio/m4a", name: "recording.m4a" } as any);
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireOpenAIKey(apiKey)}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.text?.trim();
  return text ? text : null;
}
