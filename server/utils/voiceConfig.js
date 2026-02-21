const VOICE_CONFIG = {
  hi: {
    name: 'Hindi',
    murfVoiceId: 'hi-IN-shaan',
    murfStyle: 'Conversational',
    deepgramLang: 'hi',
    twimlLang: 'hi-IN',
    twimlVoice: 'Polly.Aditi',
    greeting: 'Namaste! Main KrishiSathi AI hoon. Aap mujhse kheti ke baare mein kuch bhi pooch sakte hain.',
    goodbye: 'Dhanyavaad ji! Achhi fasal ho. Jai Kisan!',
    askMore: 'Aur kuch poochna hai ji?',
    error: 'Maaf keejiye, jawab mein dikkat aayi. Dobara boliye.',
    noData: 'Yeh jaankari abhi mere paas nahi hai ji.',
    callMeConfirm: 'Aapko 5 second mein call aayegi. Phone uthaiye!',
    callGreeting: 'Namaste ji! Main KrishiSathi AI hoon. Aap mujhse kheti ke baare mein kuch bhi pooch sakte hain. Boliye, main sun raha hoon.',
    callGoodbye: 'Dhanyavaad ji! Achhi fasal ho. Jai Kisan! Alvida!',
  },
  te: {
    name: 'Telugu',
    murfVoiceId: 'te-IN-chitra',
    murfStyle: 'Conversational',
    deepgramLang: 'te',
    twimlLang: 'te-IN',
    twimlVoice: 'Polly.Aditi',
    greeting: 'Namaskaram! Nenu KrishiSathi AI ni. Meeru vyavasaayam gurinchi eemainaa adagavachchu.',
    goodbye: 'Dhanyavaadalu garu! Manchi pantalanu kaankshishtunnamu. Jai Kisan!',
    askMore: 'Inkemainaa adagaalanukundaa garu?',
    error: 'Kshaminchandi, samasyam vachindi. Malli cheppandi.',
    noData: 'Ee samacharam ippudu naa daggaraa ledu garu.',
    callMeConfirm: 'Meeku 5 seconds lo call vasthundi. Phone teeyandi!',
    callGreeting: 'Namaskaram garu! Nenu KrishiSathi AI ni. Meeru vyavasaayam gurinchi eemainaa adagavachchu. Cheppandi, nenu vintunnanu.',
    callGoodbye: 'Dhanyavaadalu garu! Manchi pantalanu kaankshishtunnamu. Jai Kisan!',
  },
  en: {
    name: 'English',
    murfVoiceId: 'en-IN-rohan',
    murfStyle: 'Conversational',
    deepgramLang: 'en',
    twimlLang: 'en-IN',
    twimlVoice: 'Polly.Aditi',
    greeting: 'Hello! I am KrishiSathi AI. You can ask me anything about farming.',
    goodbye: 'Thank you! Wishing you a great harvest. Jai Kisan!',
    askMore: 'Anything else you would like to know?',
    error: 'Sorry, there was an issue. Please try again.',
    noData: 'I don\'t have that information right now.',
    callMeConfirm: 'You will receive a call in 5 seconds. Please pick up!',
    callGreeting: 'Hello! I am KrishiSathi AI. You can ask me anything about farming. Please go ahead, I am listening.',
    callGoodbye: 'Thank you! Wishing you a great harvest. Jai Kisan! Goodbye!',
  },
};

// Goodbye keywords to detect when farmer wants to end conversation
const GOODBYE_KEYWORDS = [
  'bye', 'goodbye', 'bas', 'dhanyavaad', 'shukriya', 'thanks', 'thank you',
  'alvida', 'chalo', 'ok bye', 'theek hai', 'nahi', 'kuch nahi',
  'vandanalu', 'dhanyavaadalu', 'sari', 'inka chalu',
];

function isGoodbye(text) {
  const lower = (text || '').toLowerCase().trim();
  return GOODBYE_KEYWORDS.some((kw) => lower.includes(kw));
}

function getVoiceConfig(lang) {
  return VOICE_CONFIG[lang] || VOICE_CONFIG.en;
}

module.exports = { VOICE_CONFIG, GOODBYE_KEYWORDS, isGoodbye, getVoiceConfig };
