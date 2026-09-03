import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'outline' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  dataTestId?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'secondary',
  size = 'sm',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  dataTestId,
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-zinc-100 hover:bg-white active:bg-zinc-200 text-zinc-950 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,1)] border border-white/20',
    secondary:
      'bg-zinc-900/90 hover:bg-zinc-800/90 active:bg-zinc-800 text-zinc-200 border border-zinc-700/70 hover:border-zinc-600 shadow-sm',
    subtle:
      'bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/40 hover:text-zinc-100',
    outline:
      'bg-transparent hover:bg-zinc-800/50 text-zinc-300 border border-zinc-700/80 hover:border-zinc-500',
    danger:
      'bg-zinc-900/90 hover:bg-rose-950/40 text-rose-300 border border-rose-500/40 hover:border-rose-500/60',
    ghost:
      'bg-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 border-transparent',
  };

  const sizeStyles = {
    xs: 'h-6 px-2 text-[11px] gap-1 rounded',
    sm: 'h-7.5 px-2.5 text-xs gap-1.5 rounded-md',
    md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
    lg: 'h-10 px-4 text-sm gap-2.5 rounded-lg font-medium',
  };

  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center whitespace-nowrap shrink-0 font-sans tracking-wide transition-all select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]',
          variantStyles[variant],
          sizeStyles[size],
          className
        )
      )}
      disabled={disabled || isLoading}
      data-testid={dataTestId || (props as Record<string, unknown>)['data-testid'] as string | undefined}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
