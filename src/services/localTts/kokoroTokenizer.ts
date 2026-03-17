const KOKORO_MAX_TOKENS = 510;

const KOKORO_VOCAB = (() => {
  const punctuation = ';:,.!?¡¿—…"«»"" ';
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const ipa =
    "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";
  const symbols = ["$", ...punctuation.split(""), ...letters.split(""), ...ipa.split("")];

  return symbols.reduce(
    (accumulator, symbol, index) => {
      accumulator[symbol] = index;
      return accumulator;
    },
    {} as Record<string, number>
  );
})();

const ENGLISH_DIGRAPHS: Record<string, string> = {
  th: "θ",
  sh: "ʃ",
  ch: "tʃ",
  ng: "ŋ",
  er: "ɝ",
  ar: "ɑɹ",
  or: "ɔɹ",
  ir: "ɪɹ",
  ur: "ʊɹ",
};

const ENGLISH_LETTERS: Record<string, string> = {
  a: "ə",
  e: "ɛ",
  i: "ɪ",
  o: "oʊ",
  u: "ʌ",
  j: "dʒ",
  r: "ɹ",
};

const COMMON_WORDS: Record<string, string> = {
  hello: "hɛˈloʊ",
  world: "wˈɝld",
  this: "ðˈɪs",
  is: "ˈɪz",
  test: "tˈɛst",
  speech: "spˈiːtʃ",
  voice: "vˈɔɪs",
  assistant: "əsˈɪstənt",
  local: "lˈoʊkəl",
  audio: "ˈɔːdioʊ",
  english: "ˈɪŋɡlɪʃ",
};

function normalizeEnglishText(text: string) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/…/g, "...");
}

function phonemizeEnglish(text: string) {
  const words = normalizeEnglishText(text).split(/\s+/);

  return words
    .map((word) => {
      const normalizedWord = word.toLowerCase().replace(/[.,!?;:'"]/g, "");

      if (COMMON_WORDS[normalizedWord]) {
        return COMMON_WORDS[normalizedWord];
      }

      let phonemes = "";
      let index = 0;

      while (index < word.length) {
        if (index < word.length - 1) {
          const digraph = word.slice(index, index + 2).toLowerCase();

          if (ENGLISH_DIGRAPHS[digraph]) {
            phonemes += ENGLISH_DIGRAPHS[digraph];
            index += 2;
            continue;
          }
        }

        const char = word[index].toLowerCase();

        if (ENGLISH_LETTERS[char]) {
          phonemes += ENGLISH_LETTERS[char];
        } else if (/[a-z]/.test(char) || /[.,!?;:'"]/.test(char)) {
          phonemes += char;
        }

        index += 1;
      }

      if (phonemes.length > 2 && !/[.,!?;:'"]/.test(phonemes)) {
        const vowelMatch = phonemes.match(/[ɑɐɒæəɘɚɛɜɝɞɨɪʊʌɔoeiuaɑː]/);

        if (vowelMatch?.index !== undefined) {
          phonemes =
            phonemes.slice(0, vowelMatch.index) +
            "ˈ" +
            phonemes.slice(vowelMatch.index);
        }
      }

      return phonemes;
    })
    .join(" ");
}

export function tokenizeKokoroEnglish(text: string) {
  const phonemes = phonemizeEnglish(text);
  const tokens = [0];

  for (const char of phonemes) {
    const token = KOKORO_VOCAB[char];

    if (token !== undefined) {
      tokens.push(token);
    }
  }

  tokens.push(0);

  if (tokens.length > KOKORO_MAX_TOKENS) {
    return [...tokens.slice(0, KOKORO_MAX_TOKENS - 1), 0];
  }

  return tokens;
}
