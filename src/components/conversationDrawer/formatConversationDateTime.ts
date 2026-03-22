export function formatConversationDateTime(iso: string, locale: string) {
  const date = new Date(iso);
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}
