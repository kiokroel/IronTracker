import React, { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'crimson' | 'success' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full uppercase tracking-wider select-none';

  const variants = {
    default: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
    accent: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    crimson: 'bg-red-500/15 text-red-400 border border-red-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    outline: 'bg-transparent text-zinc-300 border border-zinc-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] leading-tight',
    md: 'px-2.5 py-1 text-xs leading-none',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};

export default Badge;
