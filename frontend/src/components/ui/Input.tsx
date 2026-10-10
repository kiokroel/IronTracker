import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, rightElement, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative w-full">
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full px-3.5 py-2.5 rounded-lg text-sm bg-zinc-900 border text-zinc-100 placeholder-zinc-500 transition-colors',
              'border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none',
              rightElement ? 'pr-10' : '',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              props.disabled && 'opacity-50 cursor-not-allowed bg-zinc-950',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-zinc-400">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
