import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { sendChatMessage, getSTTToken, getTTSAudio } from '../services/chatService';
import { getWeather } from '../services/weatherService';
import { getPrices } from '../services/priceService';
import { Mic, MicOff, Send, Loader2, Volume2, VolumeX, User, Bot, Headphones } from 'lucide-react';
import VoiceAgentPanel from '../components/VoiceAgent/VoiceAgentPanel';

// --------------- Constants ---------------

/** Deepgram language codes (STT) */
const DEEPGRAM_LANG = { en: 'en', hi: 'hi', te: 'te' };

/** BCP-47 tags used as fallback for browser SpeechSynthesis */
const BROWSER_LANG = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };

/** Number of past messages to send as conversation memory */
const HISTORY_WINDOW = 10;

// --------------- Helpers ---------------

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

// --------------- Audio Waveform Indicator ---------------

function WaveformIndicator() {
  return (
    <div className="flex items-center justify-center gap-[3px] h-6" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="inline-block w-[3px] rounded-full bg-alert-red"
          style={{
            animation: `waveform 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      {/* Inject keyframes once via a <style> tag scoped to this component tree */}
      <style>{`
        @keyframes waveform {
          0%, 100% { height: 6px; }
          50%       { height: 20px; }
        }
      `}</style>
    </div>
  );
}

// --------------- Chat Bubble ---------------

function ChatBubble({ message, onSpeak, isSpeaking, t }) {
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
            {isSpeaking ? (
              <VolumeX className="w-4 h-4 text-primary-800 animate-pulse" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// =============== Main Component ===============

export default function VoiceChatbot() {
  const { t } = useTranslation();
  const { user, language, selectedCrop } = useFarm();

  // ---- Voice Agent Panel ----
  const [voiceAgentOpen, setVoiceAgentOpen] = useState(false);

  // ---- State ----
  const [messages, setMessages] = useState([
    { role: 'assistant', content: t('chatbot.speakNow') },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  // ---- Refs ----
  const messagesEndRef = useRef(null);
  const handleSendRef = useRef(null);

  // Deepgram STT refs
  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // TTS refs
  const currentAudioRef = useRef(null);

  // --------------- Scroll to bottom ---------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  // --------------- Cleanup on unmount ---------------
  useEffect(() => {
    return () => {
      stopDeepgramSTT();
      stopTTS();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============== Deepgram STT ===============

  const stopDeepgramSTT = useCallback(() => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    mediaRecorderRef.current = null;

    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        // Send close message per Deepgram protocol
        try {
          wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
        } catch {
          /* ignore */
        }
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setInterimTranscript('');
  }, []);

  const startDeepgramSTT = useCallback(async () => {
    try {
      // 1. Get Deepgram API key from backend
      const tokenData = await getSTTToken();
      const apiKey = tokenData?.data?.key || tokenData?.key || tokenData?.token || tokenData?.apiKey;
      if (!apiKey) throw new Error('No STT token received');

      // 2. Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Open Deepgram WebSocket
      const dgLang = DEEPGRAM_LANG[language] || 'en';
      const wsUrl = `wss://api.deepgram.com/v1/listen?language=${dgLang}&model=nova-2&smart_format=true&interim_results=true&endpointing=300`;

      const ws = new WebSocket(wsUrl, ['token', apiKey]);
      wsRef.current = ws;

      let finalTranscriptAccumulator = '';

      ws.onopen = () => {
        // 4. Start streaming audio via MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm',
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        // Send audio in 250ms chunks
        mediaRecorder.start(250);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data?.channel?.alternatives?.[0]?.transcript;
          if (!transcript) return;

          if (data.is_final) {
            finalTranscriptAccumulator += (finalTranscriptAccumulator ? ' ' : '') + transcript;
            setInterimTranscript(finalTranscriptAccumulator);
          } else {
            // Show interim results for visual feedback
            const preview = finalTranscriptAccumulator
              ? finalTranscriptAccumulator + ' ' + transcript
              : transcript;
            setInterimTranscript(preview);
          }
        } catch {
          /* ignore non-JSON frames */
        }
      };

      ws.onclose = () => {
        // When WebSocket closes, if we accumulated a transcript, send it
        if (finalTranscriptAccumulator.trim()) {
          const text = finalTranscriptAccumulator.trim();
          setInput(text);
          handleSendRef.current?.(text);
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      ws.onerror = () => {
        console.error('Deepgram WebSocket error');
        stopDeepgramSTT();
        setIsListening(false);
      };

      setIsListening(true);
    } catch (err) {
      console.error('Failed to start Deepgram STT:', err);
      stopDeepgramSTT();
      setIsListening(false);
    }
  }, [language, stopDeepgramSTT]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopDeepgramSTT();
      setIsListening(false);
    } else {
      startDeepgramSTT();
    }
  }, [isListening, startDeepgramSTT, stopDeepgramSTT]);

  // =============== TTS (Deepgram with browser fallback) ===============

  const stopTTS = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      // Revoke object URL to free memory
      if (currentAudioRef.current.src?.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioRef.current.src);
      }
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakWithBrowserFallback = useCallback(
    (text) => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = BROWSER_LANG[language] || 'en-IN';
      utterance.rate = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const langCode = BROWSER_LANG[language] || 'en-IN';
      const matchingVoice =
        voices.find((v) => v.lang === langCode) ||
        voices.find((v) => v.lang.startsWith(langCode.split('-')[0]));
      if (matchingVoice) utterance.voice = matchingVoice;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [language],
  );

  const speakText = useCallback(
    async (text) => {
      // Stop any currently playing audio
      stopTTS();

      if (!text) return;

      setIsSpeaking(true);

      try {
        const blob = await getTTSAudio(text, language);
        if (!blob || blob.size === 0) throw new Error('Empty audio blob');

        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          // Fallback to browser speech
          speakWithBrowserFallback(text);
        };

        await audio.play();
      } catch {
        // Deepgram TTS failed -- fall back to browser SpeechSynthesis
        speakWithBrowserFallback(text);
      }
    },
    [language, stopTTS, speakWithBrowserFallback],
  );

  // =============== Send Message ===============

  const handleSend = useCallback(
    async (overrideText) => {
      const text = overrideText || input.trim();
      if (!text || processing) return;

      const userMessage = { role: 'user', content: text };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setProcessing(true);

      try {
        let responseText = '';

        // Build conversation history (last N messages for context)
        const history = [...messages, userMessage].slice(-HISTORY_WINDOW).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Primary: Gemini chat API with conversation memory
        try {
          const chatResponse = await sendChatMessage({
            message: text,
            language,
            context: {
              crop: user?.primaryCrop || selectedCrop,
              district: user?.district,
              state: user?.state,
            },
            history,
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

        // Fallback: service-specific calls based on detected intent
        if (!responseText) {
          const intent = detectIntent(text);
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
              } catch {
                /* */
              }
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
                    .map(
                      (p) =>
                        `${p.mandi || p.market}: \u20B9${p.modal_price || p.price} ${t('prices.perQuintal')}`,
                    )
                    .join('\n')}`;
                }
              } catch {
                /* */
              }
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

        // Auto-speak the response via Deepgram TTS (with browser fallback)
        speakText(responseText);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: t('common.error') },
        ]);
      } finally {
        setProcessing(false);
      }
    },
    [input, processing, messages, language, user, selectedCrop, t, speakText],
  );

  // Keep ref in sync so Deepgram WS callback uses the latest handleSend
  handleSendRef.current = handleSend;

  // =============== Chip & keyboard handlers ===============

  const handleChipClick = (chipKey) => {
    const chipQueryMap = {
      weather: t('chatbot.suggestWeather'),
      advisory: t('chatbot.suggestAdvisory'),
      prices: t('chatbot.suggestPrices'),
      schemes: t('chatbot.suggestSchemes'),
    };
    const query = chipQueryMap[chipKey];
    if (query) handleSend(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Suggestion chips
  const suggestionChips = [
    { key: 'weather', labelKey: 'chatbot.suggestWeather' },
    { key: 'advisory', labelKey: 'chatbot.suggestAdvisory' },
    { key: 'prices', labelKey: 'chatbot.suggestPrices' },
    { key: 'schemes', labelKey: 'chatbot.suggestSchemes' },
  ];

  // =============== Render ===============
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="bg-primary-800 text-white px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="font-bold">{t('chatbot.title')}</h1>
          <p className="text-xs text-primary-200">
            {processing
              ? t('chatbot.processing')
              : isSpeaking
                ? t('chatbot.speaking', 'Speaking...')
                : t('app.name')}
          </p>
        </div>
        {/* Voice Agent (premium) button */}
        <button
          onClick={() => setVoiceAgentOpen(true)}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          aria-label="Open Voice Agent"
          title="KrishiSathi Voice Agent"
        >
          <Headphones className="w-5 h-5" />
        </button>
        {/* Stop speaking button */}
        {isSpeaking && (
          <button
            onClick={stopTTS}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Stop speaking"
          >
            <VolumeX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            message={msg}
            onSpeak={speakText}
            isSpeaking={isSpeaking}
            t={t}
          />
        ))}

        {/* Processing indicator */}
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

        {/* Interim transcript preview while listening */}
        {isListening && interimTranscript && (
          <div className="flex gap-2 flex-row-reverse">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary-800" />
            </div>
            <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md bg-primary-800/70 text-white/80 text-sm leading-relaxed italic">
              {interimTranscript}
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
            disabled={processing}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-alert-red text-white animate-pulse'
                : 'bg-primary-100 text-primary-800 hover:bg-primary-200'
            }`}
            aria-label={
              isListening ? t('chatbot.stopListening') : t('chatbot.startListening')
            }
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

        {/* Listening indicator with waveform */}
        {isListening && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <WaveformIndicator />
            <p className="text-sm text-alert-red font-medium animate-pulse">
              {t('chatbot.listening')}
            </p>
            <WaveformIndicator />
          </div>
        )}

        {/* Speaking indicator */}
        {isSpeaking && !isListening && (
          <p className="text-center text-sm text-primary-800 font-medium mt-2">
            {t('chatbot.speaking', 'Speaking...')}
          </p>
        )}
      </div>

      {/* Voice Agent Panel (overlay) */}
      <VoiceAgentPanel isOpen={voiceAgentOpen} onClose={() => setVoiceAgentOpen(false)} />
    </div>
  );
}
