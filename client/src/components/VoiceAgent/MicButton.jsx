import { Mic, Loader2, Square } from 'lucide-react';

export default function MicButton({ status = 'idle', language = 'en', onTap, compact = false }) {
  if (compact) {
    return (
      <button
        onClick={onTap}
        disabled={status === 'processing'}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${
          status === 'listening' ? 'bg-red-500 text-white' :
          status === 'processing' ? 'bg-yellow-500 text-white' :
          status === 'speaking' ? 'bg-blue-500 text-white' :
          'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}
      >
        {status === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> :
         status === 'speaking' ? <SoundWave small /> :
         <Mic className="w-5 h-5" />}
      </button>
    );
  }

  // Full-size voice-first mic button — hero element
  const size = status === 'listening' ? 'w-24 h-24' : 'w-20 h-20';

  return (
    <button
      onClick={onTap}
      disabled={status === 'processing'}
      className={`relative z-10 ${size} rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${
        status === 'listening'
          ? 'bg-red-500 hover:bg-red-400 shadow-red-500/40'
          : status === 'processing'
            ? 'bg-amber-500 shadow-amber-500/30'
            : status === 'speaking'
              ? 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/40'
              : 'bg-white hover:bg-white/90 shadow-white/25'
      }`}
    >
      {status === 'processing' ? (
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      ) : status === 'speaking' ? (
        <SoundWave />
      ) : status === 'listening' ? (
        <Square className="w-7 h-7 text-white fill-white rounded-sm" />
      ) : (
        <Mic className="w-8 h-8 text-[#145A3C]" />
      )}

      <style>{`
        @keyframes wave-bar {
          0%, 100% { height: 8px; }
          50% { height: 24px; }
        }
        @keyframes wave-bar-sm {
          0%, 100% { height: 6px; }
          50% { height: 16px; }
        }
      `}</style>
    </button>
  );
}

function SoundWave({ small = false }) {
  return (
    <div className={`flex items-center gap-[3px] ${small ? 'h-5' : 'h-8'}`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block ${small ? 'w-[2px]' : 'w-[3px]'} rounded-full bg-white`}
          style={{ animation: `wave-bar${small ? '-sm' : ''} 0.7s ease-in-out ${i * 0.12}s infinite` }}
        />
      ))}
    </div>
  );
}
