import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { sendChatMessage } from '../services/chatService';
import { getWeather } from '../services/weatherService';
import { getAdvisory } from '../services/advisoryService';
import { getPrices } from '../services/priceService';
import { getSchemes } from '../services/schemeService';
import { Mic, MicOff, Send, Loader2, Volume2, User, Bot } from 'lucide-react';

const LANG_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

function detectIntent(text) {
  const lower = text.toLowerCase();
  if (
    lower.includes('weather') ||
    lower.includes('rain') ||
    lower.includes('temperature') ||
    lower.includes('mausam') ||
    lower.includes('barish') ||
    lower.includes('vaatavaranam') ||
    lower.includes('varsham')
  ) {
    return 'weather';
  }
  if (
    lower.includes('price') ||
    lower.includes('mandi') ||
    lower.includes('sell') ||
    lower.includes('daam') ||
    lower.includes('bhav') ||
    lower.includes('dhara') ||
    lower.includes('market')
  ) {
    return 'prices';
  }
  if (
    lower.includes('advisory') ||
    lower.includes('advice') ||
    lower.includes('crop') ||
    lower.includes('fertilizer') ||
    lower.includes('pest') ||
    lower.includes('fasal') ||
    lower.includes('khad') ||
    lower.includes('panta') ||
    lower.includes('salaha')
  ) {
    return 'advisory';
  }
  if (
    lower.includes('scheme') ||
    lower.includes('government') ||
    lower.includes('yojana') ||
    lower.includes('subsidy') ||
    lower.includes('sarkar') ||
    lower.includes('pathakam') ||
    lower.includes('prabhutva')
  ) {
    return 'schemes';
  }
  return 'general';
}

function ChatBubble({ message, onSpeak, t }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-primary-100' : 'bg-blue-100'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-800" />
        ) : (
          <Bot className="w-4 h-4 text-info" />
        )}
      </div>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-primary-800 text-white rounded-br-md'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
        }`}
      >
        <p className="whitespace-pre-line">{message.content}</p>
        {!isUser && onSpeak && (
          <button
            onClick={() => onSpeak(message.content)}
            className="mt-2 text-gray-400 hover:text-primary-800 transition-colors"
            aria-label={t('chatbot.speakMessage')}
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function VoiceChatbot() {
  const { t } = useTranslation();
  const { user, language, selectedCrop, soilType, season } = useFarm();

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: t('chatbot.speakNow'),
    },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [processing, setProcessing] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const handleSendRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = LANG_MAP[language] || 'en-IN';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        // Use ref to always call the latest handleSend
        handleSendRef.current?.(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = LANG_MAP[language] || 'en-IN';
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_MAP[language] || 'en-IN';
    utterance.rate = 0.9;

    // Try to find a voice matching the language
    const voices = window.speechSynthesis.getVoices();
    const langCode = LANG_MAP[language] || 'en-IN';
    const matchingVoice = voices.find((v) => v.lang === langCode) ||
      voices.find((v) => v.lang.startsWith(langCode.split('-')[0]));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (overrideText) => {
    const text = overrideText || input.trim();
    if (!text || processing) return;

    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setProcessing(true);

    try {
      let responseText = '';
      const intent = detectIntent(text);

      // For all intents, use the Gemini chat API directly
      // It can answer anything about crops, weather, prices, schemes in any language
      try {
        const chatResponse = await sendChatMessage({
          message: text,
          language,
          context: {
            crop: user?.primaryCrop || selectedCrop,
            district: user?.district,
            state: user?.state,
          },
        });
        responseText =
          chatResponse?.data?.response ||
          chatResponse?.response ||
          chatResponse?.message ||
          chatResponse?.reply ||
          '';
      } catch {
        // Fallback: try specific service calls
      }

      // If chat API failed, try specific service calls based on intent
      if (!responseText) {
        switch (intent) {
          case 'weather': {
            try {
              const loc = user?.district || 'Hyderabad';
              const weather = await getWeather(loc);
              const curr = weather?.current || weather?.data?.current;
              if (curr) {
                const temp = curr.temp ?? curr.temperature;
                responseText = `${t('weather.title')} - ${loc}:\n${t('weather.temperature')}: ${temp}\u00b0C\n${t('weather.humidity')}: ${curr.humidity}%\n${t('weather.wind')}: ${curr.windSpeed} km/h`;
              }
            } catch { /* */ }
            break;
          }
          case 'prices': {
            try {
              const crop = user?.primaryCrop || selectedCrop || 'cotton';
              const data = await getPrices({ crop, state: user?.state });
              const priceList = data?.prices || data?.data?.prices || [];
              if (priceList.length > 0) {
                const top = priceList.slice(0, 3);
                responseText = `${t('prices.title')} - ${t(`crops.${crop}`, crop)}:\n${top
                  .map((p) => `${p.mandi || p.market}: \u20B9${p.modal_price || p.price} ${t('prices.perQuintal')}`)
                  .join('\n')}`;
              }
            } catch { /* */ }
            break;
          }
          default:
            break;
        }
      }

      if (!responseText) {
        responseText = t('chatbot.fallbackResponse');
      }

      const botMessage = { role: 'assistant', content: responseText };
      setMessages((prev) => [...prev, botMessage]);

      // Auto-speak the response
      speakText(responseText);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('common.error'),
        },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  // Keep ref in sync so speech recognition callback always uses latest handleSend
  handleSendRef.current = handleSend;

  const handleChipClick = (chipKey) => {
    // Map chip keys to translated search queries in current language
    const chipQueryMap = {
      weather: t('chatbot.suggestWeather'),
      advisory: t('chatbot.suggestAdvisory'),
      prices: t('chatbot.suggestPrices'),
      schemes: t('chatbot.suggestSchemes'),
    };
    const query = chipQueryMap[chipKey];
    if (query) {
      handleSend(query);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Suggestion chips with translated labels
  const suggestionChips = [
    { key: 'weather', labelKey: 'chatbot.suggestWeather' },
    { key: 'advisory', labelKey: 'chatbot.suggestAdvisory' },
    { key: 'prices', labelKey: 'chatbot.suggestPrices' },
    { key: 'schemes', labelKey: 'chatbot.suggestSchemes' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="bg-primary-800 text-white px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold">{t('chatbot.title')}</h1>
          <p className="text-xs text-primary-200">
            {processing ? t('chatbot.processing') : t('app.name')}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} onSpeak={speakText} t={t} />
        ))}

        {processing && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-info" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('chatbot.processing')}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
          {suggestionChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => handleChipClick(chip.key)}
              className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700 whitespace-nowrap hover:bg-primary-50 hover:border-primary-300 transition-colors min-h-touch"
            >
              {t(chip.labelKey)}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chatbot.placeholder')}
            className="input-field flex-1"
            disabled={processing}
          />

          {/* Mic Button */}
          <button
            onClick={toggleListening}
            disabled={processing || !recognitionRef.current}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-alert-red text-white animate-pulse'
                : 'bg-primary-100 text-primary-800 hover:bg-primary-200'
            }`}
            aria-label={isListening ? t('chatbot.stopListening') : t('chatbot.startListening')}
          >
            {isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Send Button */}
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || processing}
            className="w-12 h-12 rounded-full bg-primary-800 text-white flex items-center justify-center hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            aria-label={t('chatbot.sendMessage')}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {isListening && (
          <p className="text-center text-sm text-alert-red font-medium mt-2 animate-pulse">
            {t('chatbot.listening')}
          </p>
        )}
      </div>
    </div>
  );
}
