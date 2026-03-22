import { AppLanguage, TtsListenLanguage } from "../types";

export const PROVIDER_PREVIEW_SAMPLE_TEXT_BY_LANGUAGE: Record<
  TtsListenLanguage,
  string
> = {
  en: "Hello. This is a longer voice preview for SchnackAI, spoken at a calm and steady pace so you can judge clarity, tone, and whether this voice feels pleasant enough for full replies. If you listen for a few seconds, you should get a realistic sense of how this provider voice will sound during everyday conversations.",
  de: "Hallo. Dies ist eine laengere Stimmprobe fuer SchnackAI, damit du hoeren kannst, wie klar die Aussprache ist und ob die Stimme auch ueber mehrere Saetze hinweg angenehm klingt. Wenn sie hier ruhig und natuerlich wirkt, passt sie in der Regel auch gut fuer laengere Antworten im Alltag.",
  zh: "你好。这是一段较长的语音预览，用来帮助你判断这条声音是否清晰、自然，并且适合在日常对话里连续收听更长的回答。如果这两句话听起来稳定又舒服，那么它通常也适合让应用朗读完整回复。",
  es: "Hola. Esta es una muestra de voz mas larga para que puedas escuchar con calma si la pronunciacion es clara y si el ritmo suena natural durante varias frases seguidas. Si esta voz te parece agradable en estas dos oraciones, normalmente tambien funcionara bien para respuestas mas largas dentro de la aplicacion.",
  pt: "Ola. Esta e uma amostra de voz mais longa para que voce possa perceber com calma se a pronuncia esta clara e se o ritmo parece natural ao longo de varias frases. Se esta voz soar agradavel nestas duas frases, normalmente tambem sera uma boa escolha para respostas mais longas no aplicativo.",
  hi: "नमस्ते। यह आवाज़ का थोड़ा लंबा पूर्वावलोकन है, ताकि आप सुन सकें कि उच्चारण कितना साफ़ है और क्या यह आवाज़ कई वाक्यों तक स्वाभाविक और आरामदायक लगती है। अगर यह आवाज़ इन दो वाक्यों में संतुलित और सुखद लगे, तो आम तौर पर यह ऐप के लंबे उत्तर सुनने के लिए भी अच्छी रहेगी।",
  fr: "Bonjour. Voici un apercu de voix un peu plus long afin que vous puissiez entendre si la prononciation reste claire et si le rythme parait naturel sur plusieurs phrases d'affilee. Si cette voix vous semble agreable sur ces deux phrases, elle conviendra en general aussi pour des reponses plus longues dans l'application.",
  it: "Ciao. Questa e una prova della voce un po' piu lunga, cosi puoi capire se la pronuncia e chiara e se il ritmo rimane naturale anche per piu frasi consecutive. Se questa voce ti sembra piacevole in queste due frasi, di solito sara una buona scelta anche per risposte piu lunghe nell'app.",
  ja: "こんにちは。これは少し長めの音声プレビューで、発音の明瞭さや、複数の文を続けて聞いたときに自然に感じられるかどうかを確かめるためのものです。ここで落ち着いて聞こえる声であれば、アプリが長めの返答を読み上げる場合にもたいてい快適に使えます。",
};

export const LOCAL_PREVIEW_SAMPLE_TEXT_BY_LANGUAGE: Record<
  TtsListenLanguage,
  string
> = {
  en: "Hello. This is a longer local voice preview for SchnackAI, spoken slowly enough that you can hear how clear the pronunciation is and whether the rhythm feels natural for a full conversation. If this voice sounds pleasant over these two sentences, it will usually also feel comfortable when the app reads longer replies aloud.",
  de: "Hallo. Dies ist eine längere lokale Stimmprobe für SchnackAI, damit du hören kannst, wie klar die Aussprache ist und ob die Stimme auch über mehrere Sätze hinweg angenehm klingt. Wenn sich diese Stimme hier ruhig und natürlich anhört, passt sie in der Regel auch gut für längere Antworten im Alltag.",
  zh: "你好。这是一段较长的本地语音预览，用来帮助你判断这条声音是否清晰、自然，并且适合在日常对话里连续收听更长的回答。如果这两句话听起来稳定又舒服，那么它通常也适合让应用朗读完整回复。",
  es: "Hola. Esta es una muestra local de voz más larga para que puedas escuchar con calma si la pronunciación es clara y si el ritmo suena natural durante varias frases seguidas. Si esta voz te parece agradable en estas dos oraciones, normalmente también funcionará bien para respuestas más largas dentro de la aplicación.",
  pt: "Olá. Esta é uma amostra local de voz mais longa para que você possa perceber com calma se a pronúncia está clara e se o ritmo parece natural ao longo de várias frases. Se esta voz soar agradável nestas duas frases, normalmente também será uma boa escolha para respostas mais longas no aplicativo.",
  hi: "नमस्ते। यह स्थानीय आवाज़ का थोड़ा लंबा पूर्वावलोकन है, ताकि आप सुन सकें कि उच्चारण कितना साफ़ है और क्या यह आवाज़ कई वाक्यों तक स्वाभाविक और आरामदायक लगती है। अगर यह आवाज़ इन दो वाक्यों में संतुलित और सुखद लगे, तो आम तौर पर यह ऐप के लंबे उत्तर सुनने के लिए भी अच्छी रहेगी।",
  fr: "Bonjour. Voici un aperçu local plus long de la voix afin que vous puissiez entendre si la prononciation reste claire et si le rythme paraît naturel sur plusieurs phrases d'affilée. Si cette voix vous semble agréable sur ces deux phrases, elle conviendra en général aussi pour des réponses plus longues dans l'application.",
  it: "Ciao. Questa e una prova locale della voce un po' piu lunga, cosi puoi capire se la pronuncia e chiara e se il ritmo rimane naturale anche per piu frasi consecutive. Se questa voce ti sembra piacevole in queste due frasi, di solito sara una buona scelta anche per risposte piu lunghe nell'app.",
  ja: "こんにちは。これは少し長めのローカル音声プレビューで、発音の明瞭さや、複数の文を続けて聞いたときに自然に感じられるかどうかを確かめるためのものです。ここで落ち着いて聞こえる声であれば、アプリが長めの返答を読み上げる場合にもたいてい快適に使えます。",
};

export function getNativePreviewSampleText(language: AppLanguage) {
  return language === "de"
    ? "Hallo. Das ist eine kurze Sprachprobe der Systemstimme auf diesem Geraet, damit du sofort hoeren kannst, wie natuerlich oder kuenstlich sie fuer laengere Antworten wirkt. Wenn dir Tempo, Klang oder Betonung nicht gefallen, ist das ein guter Hinweis darauf, lieber eine lokale oder Cloud-Stimme zu verwenden."
    : "Hello. This is a short sample of the system voice on this device, so you can quickly hear how natural or artificial it feels for longer replies. If you dislike the pacing, tone, or pronunciation here, that is a good sign you will probably prefer a local or cloud voice instead.";
}
