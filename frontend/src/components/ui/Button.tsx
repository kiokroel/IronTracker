import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-amber-500 text-zinc-950 hover:bg-amber-400 active:bg-amber-600 focus:ring-amber-500 shadow-md shadow-amber-500/10',
      secondary:
        'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:bg-zinc-750 focus:ring-zinc-600 border border-zinc-700',
      danger:
        'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 focus:ring-red-500 shadow-md shadow-red-600/10',
      ghost:
        'bg-transparent text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 focus:ring-zinc-600',
      outline:
        'bg-transparent border border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white focus:ring-amber-500',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'px-3 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
