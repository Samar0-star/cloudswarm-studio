/**
 * Theme Manager for CloudSwarm Studio
 * Supports: 'system' (device preference), 'dark', and 'light'
 */

export type ThemeMode = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'cloudswarm_theme_mode';

export class ThemeManager {
  private mode: ThemeMode = 'system';
  private mediaQuery: MediaQueryList | null = null;
  private listeners: Set<(resolved: ResolvedTheme, mode: ThemeMode) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        this.mode = saved;
      }

      if (typeof window.matchMedia === 'function') {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (this.mediaQuery.addEventListener) {
          this.mediaQuery.addEventListener('change', this.handleMediaChange);
        }
      }

      this.applyTheme();
    }
  }

  private handleMediaChange = () => {
    if (this.mode === 'system') {
      this.applyTheme();
    }
  };

  public getMode(): ThemeMode {
    return this.mode;
  }

  public getResolvedTheme(): ResolvedTheme {
    if (this.mode === 'dark') return 'dark';
    if (this.mode === 'light') return 'light';
    if (typeof window !== 'undefined' && this.mediaQuery) {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return 'dark'; // safe fallback
  }

  public setMode(mode: ThemeMode): void {
    this.mode = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
    this.applyTheme();
  }

  public cycleMode(): ThemeMode {
    // Cycles: system -> light -> dark -> system
    const nextMode: Record<ThemeMode, ThemeMode> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    const next = nextMode[this.mode];
    this.setMode(next);
    return next;
  }

  public applyTheme(): void {
    if (typeof document === 'undefined') return;
    const resolved = this.getResolvedTheme();
    const root = document.documentElement;

    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }

    this.listeners.forEach((listener) => listener(resolved, this.mode));
  }

  public subscribe(listener: (resolved: ResolvedTheme, mode: ThemeMode) => void): () => void {
    this.listeners.add(listener);
    listener(this.getResolvedTheme(), this.mode);
    return () => this.listeners.delete(listener);
  }

  public cleanup(): void {
    if (this.mediaQuery && this.mediaQuery.removeEventListener) {
      this.mediaQuery.removeEventListener('change', this.handleMediaChange);
    }
    this.listeners.clear();
  }
}

export const themeManager = new ThemeManager();
