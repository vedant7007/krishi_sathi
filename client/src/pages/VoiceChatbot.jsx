import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import useVoiceAgent from '../hooks/useVoiceAgent';
import MicButton from '../components/VoiceAgent/MicButton';
import QuickChips from '../components/VoiceAgent/QuickChips';
import { User, Bot, AlertCircle, Send, Keyboard, X, ChevronDown, PhoneOff } from 'lucide-react';

const SOURCE_ICONS = {
  advisory: '\uD83C\uDF3E',
  weather: '\u2600\uFE0F',
  prices: '\uD83D\uDCB0',
  schemes: '\uD83C\uDFE8',
  general: '\uD83D\uDCAC',
};

const greetings = {
  en: 'Hi! I\'m KrishiSathi AI.\nTap the mic to start a conversation.',
  hi: 'Namaste! Main KrishiSathi AI hoon.\nMic dabayein aur baat shuru karein.',
  te: 'Namaskaram! Nenu KrishiSathi AI.\nMic noppi sambhashanalu prarambhinchandi.',
};

const placeholders = {
  en: 'Type your question...',
  hi: 'Sawal likhen...',
  te: 'Prashna raayandi...',
};

const getStatusLabel = (status, isActive, language) => {
  const labels = {
    idle: isActive
      ? { en: 'Conversation active', hi: 'Baat chal rahi hai', te: 'Sambhashanalu jarugutondi' }
      : { en: 'Tap to start', hi: 'Shuru karne ke liye dabaiye', te: 'Prarambhinchataniki noppandi' },
    listening: { en: 'Listening...', hi: 'Sun raha hoon...', te: 'Vintunnanu...' },
    processing: { en: 'Thinking...', hi: 'Soch raha hoon...', te: 'Aalochistunnanu...' },
    speaking: { en: 'Speaking... tap to skip', hi: 'Bol raha hoon... skip ke liye dabaiye', te: 'Cheptunnanu... skip cheyyataniki noppandi' },
  };
  const entry = labels[status] || labels.idle;
  return entry[language] || entry.en || '';
};

export default function VoiceChatbot() {
  const { t } = useTranslation();
  const { language } = useFarm();
  const messagesEndRef = useRef(null);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);

  const {
    status,
    transcript,
    interimTranscript,
    messages,
    error,
    isActive,
    toggleConversation,
    endConversation,
    sendQuickQuery,
    sendTextQuery,
    stopSpeaking,
  } = useVoiceAgent(language);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  const handleMicTap = () => {
    if (status === 'speaking') {
      // Skip current TTS — auto-resumes listening
      stopSpeaking();
    } else {
      // Toggle the entire conversation on/off
      toggleConversation();
    }
  };

  const handleTextSend = () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    sendTextQuery(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  };

  const isBusy = status === 'processing' || status === 'speaking';
  const label = getStatusLabel(status, isActive, language);
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-[#0B3D2E] via-[#145A3C] to-[#1B7A4E] text-white">

      {/* ─── Voice Hero Section ─── */}
      <div className={`flex flex-col items-center justify-center px-6 transition-all duration-500 ${hasMessages ? 'pt-6 pb-3' : 'flex-1'}`}>

        {/* Brand */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{'\uD83C\uDF3E'}</span>
          <h1 className="text-xl font-bold tracking-tight">KrishiSathi AI</h1>
        </div>

        {/* Mic button with animated orbs */}
        <div className="relative mb-3">
          {isActive && status === 'listening' && (
            <>
              <span className="absolute inset-[-20px] rounded-full bg-white/10 animate-[orb-pulse_2s_ease-in-out_infinite]" />
              <span className="absolute inset-[-40px] rounded-full bg-white/5 animate-[orb-pulse_2s_ease-in-out_0.6s_infinite]" />
            </>
          )}
          {status === 'speaking' && (
            <span className="absolute inset-[-14px] rounded-full bg-blue-400/20 animate-[orb-pulse_1.5s_ease-in-out_infinite]" />
          )}
          {status === 'processing' && (
            <span className="absolute inset-[-14px] rounded-full bg-amber-400/15 animate-[orb-pulse_1s_ease-in-out_infinite]" />
          )}
          <MicButton status={status} language={language} onTap={handleMicTap} isActive={isActive} />
        </div>

        {/* Status label */}
        <p className={`text-sm font-medium mb-2 transition-colors ${
          status === 'listening' ? 'text-red-300 animate-pulse' :
          status === 'processing' ? 'text-yellow-300' :
          status === 'speaking' ? 'text-blue-300' :
          isActive ? 'text-emerald-300' :
          'text-white/50'
        }`}>
          {label}
        </p>

        {/* End conversation button — visible when active */}
        {isActive && (
          <button
            onClick={endConversation}
            className="flex items-center gap-1.5 px-4 py-1.5 mb-2 rounded-full bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-all active:scale-95 animate-[fade-in_0.2s_ease]"
          >
            <PhoneOff className="w-3 h-3" />
            {language === 'hi' ? 'Baat khatam karein' : language === 'te' ? 'Aapandi' : 'End conversation'}
          </button>
        )}

        {/* Live transcription bubble */}
        {(status === 'listening' || status === 'processing') && (interimTranscript || transcript) && (
          <div className="w-full max-w-sm px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 mb-3 animate-[fade-in_0.2s_ease]">
            <p className="text-sm text-white/80 italic text-center leading-relaxed">
              {interimTranscript || transcript}
            </p>
          </div>
        )}

        {/* Greeting */}
        {!hasMessages && status === 'idle' && (
          <p className="text-sm text-white/35 text-center max-w-xs leading-relaxed whitespace-pre-line mb-5">
            {greetings[language] || greetings.en}
          </p>
        )}

        {/* Quick chips */}
        {messages.length <= 2 && (
          <div className="w-full max-w-sm">
            <QuickChips language={language} onChipTap={sendQuickQuery} disabled={isBusy} dark />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30 animate-[fade-in_0.2s_ease]">
          <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

      {/* ─── Chat Messages Section ─── */}
      {hasMessages && (
        <div className="flex-1 flex flex-col bg-white/5 rounded-t-3xl overflow-hidden border-t border-white/10 min-h-0">
          {/* Chat header */}
          <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-white/40">
            <ChevronDown className="w-3.5 h-3.5" />
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </div>

          {/* Messages scroll */}
          <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
            {messages.map((msg, i) => (
              <ChatBubble key={i} message={msg} />
            ))}

            {status === 'listening' && interimTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-sm bg-emerald-600/60 text-white/80 text-sm italic">
                  {interimTranscript}
                </div>
              </div>
            )}

            {status === 'processing' && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-blue-300" />
                </div>
                <div className="px-3 py-2.5 rounded-2xl rounded-bl-sm bg-white/10 border border-white/10">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-[bounce_1s_ease-in-out_infinite]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-[bounce_1s_ease-in-out_0.15s_infinite]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-[bounce_1s_ease-in-out_0.3s_infinite]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* ─── Bottom Bar ─── */}
      <div className="px-4 pb-4 pt-2 bg-black/20 backdrop-blur-sm border-t border-white/10">
        {showTextInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholders[language] || placeholders.en}
              disabled={isBusy}
              autoFocus
              className="flex-1 px-4 py-2.5 rounded-full bg-white/10 border border-white/20 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 disabled:opacity-50"
            />
            {textInput.trim() ? (
              <button
                onClick={handleTextSend}
                disabled={isBusy}
                className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-400 disabled:opacity-50 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowTextInput(false)}
                className="w-10 h-10 rounded-full bg-white/10 text-white/60 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setShowTextInput(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/15 text-white/40 hover:text-white/60 text-xs transition-all"
            >
              <Keyboard className="w-3.5 h-3.5" />
              {language === 'hi' ? 'Type karein' : language === 'te' ? 'Type cheyandi' : 'Type instead'}
            </button>
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes orb-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 0.15; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  const sourceIcon = SOURCE_ICONS[message.source] || '';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-[slide-up_0.3s_ease]`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
        {isUser ? <User className="w-3.5 h-3.5 text-emerald-300" /> : <Bot className="w-3.5 h-3.5 text-blue-300" />}
      </div>
      <div className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isUser ? 'bg-emerald-600/50 text-white rounded-br-sm' : 'bg-white/10 border border-white/10 text-white/90 rounded-bl-sm'
      }`}>
        <p className="whitespace-pre-line">{message.content}</p>
        {!isUser && sourceIcon && <span className="inline-block mt-1 text-xs opacity-40">{sourceIcon}</span>}
      </div>
    </div>
  );
}
