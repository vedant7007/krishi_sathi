const statusText = {
  idle: { en: 'Ready to help', hi: 'Madad ke liye taiyar', te: 'Sahayam cheyyataniki siddham' },
  listening: { en: 'Listening...', hi: 'Sun raha hoon...', te: 'Vintunnanu...' },
  processing: { en: 'Thinking...', hi: 'Soch raha hoon...', te: 'Aalochistunnanu...' },
  speaking: { en: 'Speaking...', hi: 'Bol raha hoon...', te: 'Cheptunnanu...' },
};

export default function AgentAvatar({ status = 'idle', language = 'en' }) {
  const text = statusText[status]?.[language] || statusText[status]?.en || '';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-[100px] h-[100px] rounded-full flex items-center justify-center text-5xl bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 transition-all duration-300 ${status === 'listening' ? 'shadow-[0_0_20px_rgba(46,125,50,0.3)]' : ''} ${status === 'speaking' ? 'animate-[avatar-pulse_1s_ease-in-out_infinite]' : ''}`}>
        <span role="img" aria-label="KrishiSathi">🌾</span>
      </div>
      <h2 className="text-lg font-bold text-green-800">KrishiSathi AI</h2>
      <p className={`text-xs font-medium ${status === 'idle' ? 'text-gray-400' : status === 'listening' ? 'text-red-500' : status === 'processing' ? 'text-yellow-600' : 'text-blue-600'}`}>
        {text}
      </p>

      <style>{`
        @keyframes avatar-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
