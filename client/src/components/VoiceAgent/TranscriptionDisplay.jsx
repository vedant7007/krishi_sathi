import { Mic } from 'lucide-react';

const langLabel = { en: 'English', hi: 'Hindi', te: 'Telugu' };

export default function TranscriptionDisplay({ interimTranscript, finalTranscript, language = 'en', isListening }) {
  const displayText = interimTranscript || finalTranscript;
  if (!displayText && !isListening) return null;

  return (
    <div className="w-full px-4 py-3 bg-white/80 backdrop-blur rounded-xl border border-gray-100 transition-all animate-[fade-in_0.3s_ease]">
      {isListening && (
        <div className="flex items-center gap-1.5 mb-1">
          <Mic className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-500">{langLabel[language] || 'English'}</span>
        </div>
      )}
      <p className={`text-sm leading-relaxed transition-colors ${interimTranscript && !finalTranscript ? 'text-gray-400 italic' : 'text-gray-800 font-medium'}`}>
        {displayText || (isListening ? '...' : '')}
      </p>
    </div>
  );
}
