import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'slate' | 'cyan' | 'emerald' | 'amber' | 'indigo' | 'rose' | 'purple';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'slate',
  size = 'sm',
  dot = false,
  pulse = false,
  ...props
}) => {
  const variantStyles = {
    slate: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    cyan: 'bg-sky-950/60 text-sky-300 border-sky-500/30',
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-500/30',
    indigo: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30',
    rose: 'bg-rose-950/60 text-rose-300 border-rose-500/30',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-500/30',
  };

  const dotColors = {
    slate: 'bg-slate-400',
    cyan: 'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    indigo: 'bg-indigo-400',
    rose: 'bg-rose-400',
    purple: 'bg-purple-400',
  };

  const sizeStyles = {
    xs: 'px-1.5 py-0.2 text-[10px] gap-1 leading-tight',
    sm: 'px-2 py-0.5 text-xs gap-1.5 leading-normal',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-medium',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center font-mono font-medium rounded-full border transition-colors select-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )
      )}
      {...props}
    >
      {dot && (
        <span
          className={clsx(
            'inline-block h-1.5 w-1.5 rounded-full',
            dotColors[variant],
            pulse && 'animate-pulse'
          )}
        />
      )}
      {children}
    </span>
  );
};
