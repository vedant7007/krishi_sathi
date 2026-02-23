import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { requestCallback } from '../services/agentApi';
import { Phone, X, Loader2 } from 'lucide-react';

const labels = {
  en: { label: 'Call Me', confirming: 'KrishiSathi will call you now!', ringing: 'Phone is ringing! Pick up!', failed: 'Call failed. Try again.', confirm: 'Call Now', cancel: 'Cancel', trialNote: 'Note: This project uses a Twilio trial account. Calls can only be made to verified numbers. Sorry for the inconvenience.' },
  hi: { label: 'मुझे कॉल करें', confirming: 'KrishiSathi abhi aapko call karega!', ringing: 'Phone baj raha hai! Uthaiye!', failed: 'Call fail hua. Dobara try karein.', confirm: 'Call karein', cancel: 'Cancel', trialNote: 'Note: Yeh project Twilio trial account use karta hai. Call sirf verified numbers par ho sakti hai. Asuvidhaa ke liye kshama karein.' },
  te: { label: 'నాకు కాల్', confirming: 'KrishiSathi meeku ippudu call chestundi!', ringing: 'Phone mogruthundi! Teeyandi!', failed: 'Call fail ayyindi. Malli try cheyandi.', confirm: 'Call cheyandi', cancel: 'Cancel', trialNote: 'Note: Ee project Twilio trial account vadutundi. Calls verified numbers ki matrame cheyagalamu. Asoukaryaniki kshaminchamdi.' },
};

export default function CallMeButton() {
  const { t } = useTranslation();
  const { user, language } = useFarm();
  const [state, setState] = useState('idle'); // idle | confirming | calling | ringing | done | failed
  const [countdown, setCountdown] = useState(5);
  const l = labels[language] || labels.en;

  // Don't render for non-logged-in users
  if (!user) return null;

  const handleTap = () => {
    setState('confirming');
  };

  const handleConfirm = async () => {
    setState('calling');
    setCountdown(5);
    try {
      await requestCallback();
      setState('ringing');
      // Auto-reset after 10 seconds
      setTimeout(() => setState('idle'), 10000);
    } catch (err) {
      console.error('[CallMe] Error:', err);
      setState('failed');
      setTimeout(() => setState('idle'), 5000);
    }
  };

  const handleCancel = () => {
    setState('idle');
  };

  // Countdown effect
  useEffect(() => {
    if (state !== 'calling') return;
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [state, countdown]);

  // Modal for confirmation / calling / ringing states
  if (state !== 'idle') {
    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={handleCancel}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-[fade-in_0.2s_ease]" onClick={(e) => e.stopPropagation()}>
            {state === 'confirming' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-lg font-semibold text-gray-800 mb-2">{l.confirming}</p>
                <p className="text-sm text-gray-500 mb-2">{user.phone}</p>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4">{l.trialNote}</p>
                <div className="flex gap-3">
                  <button onClick={handleCancel} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors min-h-[48px]">
                    {l.cancel}
                  </button>
                  <button onClick={handleConfirm} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors min-h-[48px]">
                    {l.confirm}
                  </button>
                </div>
              </div>
            )}

            {state === 'calling' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
                </div>
                <p className="text-4xl font-bold text-green-600 mb-2">{countdown}</p>
                <p className="text-sm text-gray-500">{l.confirming}</p>
              </div>
            )}

            {state === 'ringing' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <Phone className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-lg font-semibold text-green-700 mb-2">{l.ringing}</p>
                <button onClick={() => setState('idle')} className="mt-4 text-sm text-gray-400 hover:text-gray-600">
                  {l.cancel}
                </button>
              </div>
            )}

            {state === 'failed' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-lg font-semibold text-red-600 mb-4">{l.failed}</p>
                <button onClick={handleConfirm} className="w-full py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors min-h-[48px]">
                  {t('common.retry', 'Retry')}
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Floating button
  return (
    <button
      onClick={handleTap}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1 group"
      aria-label={l.label}
    >
      <div className="w-[72px] h-[72px] rounded-full bg-green-600 text-white flex items-center justify-center shadow-lg hover:bg-green-700 transition-all active:scale-95 animate-[gentle-bounce_3s_ease-in-out_infinite]">
        <Phone className="w-8 h-8" />
      </div>
      <span className="text-xs font-medium text-green-800 bg-white/90 px-2 py-0.5 rounded-full shadow-sm">
        {l.label}
      </span>

      <style>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </button>
  );
}
