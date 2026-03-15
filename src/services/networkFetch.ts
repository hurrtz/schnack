type FetchFunction = typeof globalThis.fetch;

let expoFetch: FetchFunction | null = null;

try {
  expoFetch = require("expo/fetch").fetch as FetchFunction;
} catch {
  expoFetch = null;
}

export function networkFetch(
  input: Parameters<FetchFunction>[0],
  init?: Parameters<FetchFunction>[1]
) {
  return (expoFetch ?? globalThis.fetch)(input, init);
}
