import React from 'react';
import { Globe } from 'lucide-react';
import { useLocaleStore } from '@/store/useLocaleStore';
import { cn } from '@/utils/cn';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'compact' | 'pill';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className,
  variant = 'compact',
}) => {
  const { locale, setLocale, toggleLocale } = useLocaleStore();

  if (variant === 'pill') {
    return (
      <div
        className={cn(
          'inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/90 p-0.5 shadow-sm',
          className
        )}
      >
        <button
          type="button"
          onClick={() => setLocale('ru')}
          className={cn(
            'px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer',
            locale === 'ru'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          )}
          title="Русский язык"
        >
          RU
        </button>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={cn(
            'px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer',
            locale === 'en'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          )}
          title="English language"
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className={cn(
        'group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900',
        'text-xs font-semibold text-zinc-300 hover:border-amber-500/50 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer',
        className
      )}
      title={locale === 'ru' ? 'Переключить на English' : 'Switch to Русский'}
    >
      <Globe className="w-3.5 h-3.5 text-amber-500 transition-transform group-hover:rotate-45 duration-300" />
      <span className="uppercase tracking-wider">{locale}</span>
      <span className="text-[10px] text-zinc-500 group-hover:text-amber-400 transition-colors">
        {locale === 'ru' ? 'RU/EN' : 'EN/RU'}
      </span>
    </button>
  );
};

export default LanguageSwitcher;
