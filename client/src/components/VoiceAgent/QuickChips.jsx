const CHIPS = {
  hi: [
    { key: 'weather', label: 'आज का मौसम', query: 'Aaj ka mausam kaisa hai?' },
    { key: 'prices', label: 'मंडी का भाव', query: 'Mandi mein aaj bhav kya hai?' },
    { key: 'fertilizer', label: 'खाद की सलाह', query: 'Khad kab aur kitni daalni chahiye?' },
    { key: 'schemes', label: 'सरकारी योजना', query: 'Mere liye kaunsi sarkari yojana hai?' },
  ],
  te: [
    { key: 'weather', label: 'ఈ రోజు వాతావరణం', query: 'Ee roju vaatavaranam elaa undi?' },
    { key: 'prices', label: 'మండి ధర', query: 'Mandi lo ee roju dhara enta?' },
    { key: 'fertilizer', label: 'ఎరువు సలహా', query: 'Eruvulu eppudu veyyali?' },
    { key: 'schemes', label: 'ప్రభుత్వ పథకం', query: 'Naaku emi prabhutva pathakalu unnaayi?' },
  ],
  en: [
    { key: 'weather', label: "Today's weather", query: "What's the weather like today?" },
    { key: 'prices', label: 'Market price', query: "What's the current market price for my crop?" },
    { key: 'fertilizer', label: 'Fertilizer advice', query: 'What fertilizer should I use and when?' },
    { key: 'schemes', label: 'Govt schemes', query: 'Which government schemes am I eligible for?' },
  ],
};

const sourceEmoji = {
  weather: '\u2600\ufe0f',
  prices: '\ud83d\udcb0',
  fertilizer: '\ud83c\udf3e',
  schemes: '\ud83c\udfe8',
};

export default function QuickChips({ language = 'en', onChipTap, disabled, dark = false }) {
  const chips = CHIPS[language] || CHIPS.en;

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => onChipTap(chip.query)}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${
            dark
              ? 'bg-white/10 border border-white/15 text-white/70 hover:bg-white/20 hover:text-white'
              : 'bg-white border border-green-200 text-gray-700 hover:bg-green-50 hover:border-green-400'
          }`}
        >
          <span className="text-xs">{sourceEmoji[chip.key] || ''}</span>
          {chip.label}
        </button>
      ))}
    </div>
  );
}
