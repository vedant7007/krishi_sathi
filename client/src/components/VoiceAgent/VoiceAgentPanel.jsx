import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../../context/FarmContext';
import useVoiceAgent from '../../hooks/useVoiceAgent';
import MicButton from './MicButton';
import QuickChips from './QuickChips';
import { X, User, Bot, AlertCircle, Send, Keyboard, ChevronDown } from 'lucide-react';

const SOURCE_ICONS = {
  advisory: '\uD83C\uDF3E',
  weather: '\u2600\uFE0F',
  prices: '\uD83D\uDCB0',
  schemes: '\uD83C\uDFE8',
  general: '\uD83D\uDCAC',
};

const greetings = {
  en: 'Hi! I\'m KrishiSathi AI. Tap the mic and ask me anything about farming.',
  hi: 'Namaste! Main KrishiSathi AI hoon. Mic dabayein aur kheti ke baare mein kuch bhi poochiye.',
  te: 'Namaskaram! Nenu KrishiSathi AI. Mic noppi vyavasayam gurinchi edaina adagandi.',
};

const placeholders = {
  en: 'Type your question...',
  hi: 'Sawal likhen...',
  te: 'Prashna raayandi...',
};

const statusLabels = {
  idle: { en: 'Tap to speak', hi: 'Bolne ke liye dabaiye', te: 'Matlaadataniki noppandi' },
  listening: { en: 'Listening... tap to stop', hi: 'Sun raha hoon... rokne ke liye dabaiye', te: 'Vintunnanu... aapataniki noppandi' },
  processing: { en: 'Thinking...', hi: 'Soch raha hoon...', te: 'Aalochistunnanu...' },
  speaking: { en: 'Speaking... tap to stop', hi: 'Bol raha hoon... rokne ke liye dabaiye', te: 'Cheptunnanu... aapataniki noppandi' },
};

export default function VoiceAgentPanel({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { language } = useFarm();
  const messagesEndRef = useRef(null);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const {
    status,
    transcript,
    interimTranscript,
    messages,
    error,
    startListening,
    stopListening,
    sendQuickQuery,
    sendTextQuery,
    stopSpeaking,
  } = useVoiceAgent(language);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  // Auto-show chat when messages come in
  useEffect(() => {
    if (messages.length > 0) setShowChat(true);
  }, [messages]);

  const handleMicTap = () => {
    if (status === 'listening') stopListening();
    else if (status === 'speaking') stopSpeaking();
    else if (status === 'idle') startListening();
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

  if (!isOpen) return null;

  const isBusy = status === 'processing' || status === 'speaking';
  const label = statusLabels[status]?.[language] || statusLabels[status]?.en || '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#0B3D2E] via-[#145A3C] to-[#1B7A4E] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <span className="text-lg">{'\uD83C\uDF3E'}</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">KrishiSathi AI</h1>
            <p className="text-[10px] text-white/50 font-medium tracking-wide uppercase">Voice Assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
          aria-label={t('common.close', 'Close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Voice-first hero section — always visible */}
        <div className={`flex flex-col items-center justify-center px-6 transition-all duration-300 ${messages.length > 0 ? 'py-4' : 'py-8 flex-1'}`}>

          {/* Animated orb behind mic */}
          <div className="relative mb-4">
            {status === 'listening' && (
              <>
                <span className="absolute inset-[-16px] rounded-full bg-white/10 animate-[orb-pulse_2s_ease-in-out_infinite]" />
                <span className="absolute inset-[-32px] rounded-full bg-white/5 animate-[orb-pulse_2s_ease-in-out_0.5s_infinite]" />
              </>
            )}
            {status === 'speaking' && (
              <span className="absolute inset-[-12px] rounded-full bg-blue-400/20 animate-[orb-pulse_1.5s_ease-in-out_infinite]" />
            )}
            <MicButton status={status} language={language} onTap={handleMicTap} />
          </div>

          {/* Status label */}
          <p className={`text-sm font-medium mb-3 transition-colors ${
            status === 'listening' ? 'text-red-300 animate-pulse' :
            status === 'processing' ? 'text-yellow-300' :
            status === 'speaking' ? 'text-blue-300' :
            'text-white/60'
          }`}>
            {label}
          </p>

          {/* Live transcription */}
          {(status === 'listening' || status === 'processing') && (interimTranscript || transcript) && (
            <div className="w-full max-w-sm px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 mb-3 animate-[fade-in_0.2s_ease]">
              <p className="text-sm text-white/80 italic text-center leading-relaxed">
                {interimTranscript || transcript}
              </p>
            </div>
          )}

          {/* Greeting — only when no messages */}
          {messages.length === 0 && status === 'idle' && (
            <p className="text-sm text-white/40 text-center max-w-xs leading-relaxed mb-4">
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
          <div className="mx-4 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30">
            <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-200">{error}</p>
          </div>
        )}

        {/* Chat section — expands when messages exist */}
        {showChat && messages.length > 0 && (
          <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-sm rounded-t-3xl overflow-hidden border-t border-white/10">
            {/* Chat header */}
            <button
              onClick={() => setShowChat((v) => !v)}
              className="flex items-center justify-center gap-1.5 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showChat ? '' : 'rotate-180'}`} />
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </button>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
              {messages.map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}

              {/* Interim while listening */}
              {status === 'listening' && interimTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-sm bg-emerald-600/60 text-white/80 text-sm italic">
                    {interimTranscript}
                  </div>
                </div>
              )}

              {/* Processing indicator */}
              {status === 'processing' && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-blue-300" />
                  </div>
                  <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white/10 border border-white/10">
                    <div className="flex gap-1">
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
      </div>

      {/* Bottom bar — keyboard toggle + text input */}
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/8 hover:bg-white/15 text-white/40 hover:text-white/60 text-xs transition-all"
            >
              <Keyboard className="w-3.5 h-3.5" />
              {language === 'hi' ? 'Type karein' : language === 'te' ? 'Type cheyandi' : 'Type instead'}
            </button>
          </div>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes orb-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.2; }
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
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-emerald-500/20' : 'bg-blue-500/20'
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-emerald-300" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-blue-300" />
        )}
      </div>
      <div
        className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-emerald-600/50 text-white rounded-br-sm'
            : 'bg-white/10 border border-white/10 text-white/90 rounded-bl-sm'
        }`}
      >
        <p className="whitespace-pre-line">{message.content}</p>
        {!isUser && sourceIcon && (
          <span className="inline-block mt-1 text-xs opacity-40">{sourceIcon}</span>
        )}
      </div>
    </div>
  );
}
