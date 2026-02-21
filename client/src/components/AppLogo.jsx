import { Sprout } from 'lucide-react';

export default function AppLogo({ size = 'md', showText = true, className = '' }) {
  const sizes = {
    sm: { icon: 'w-8 h-8', iconInner: 'w-4 h-4', text: 'text-lg' },
    md: { icon: 'w-10 h-10', iconInner: 'w-5 h-5', text: 'text-xl' },
    lg: { icon: 'w-14 h-14', iconInner: 'w-7 h-7', text: 'text-2xl' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${s.icon} rounded-xl bg-primary-800 flex items-center justify-center shadow-md`}>
        <Sprout className={`${s.iconInner} text-white`} />
      </div>
      {showText && (
        <div>
          <h1 className={`${s.text} font-extrabold text-gray-900 leading-tight tracking-tight`}>
            Krishi<span className="text-primary-800">Sathi</span>
          </h1>
          {size !== 'sm' && (
            <p className="text-[10px] text-gray-500 font-medium -mt-0.5 tracking-wide">
              Smart Farming Companion
            </p>
          )}
        </div>
      )}
    </div>
  );
}
