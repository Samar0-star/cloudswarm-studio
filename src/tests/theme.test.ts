/**
 * @jest-environment jsdom
 */
import { ThemeManager } from '../core/theme/ThemeManager';

describe('ThemeManager Unit Tests', () => {
  let manager: ThemeManager;
  let mockStorage: Record<string, string> = {};

  beforeAll(() => {
    // Polyfill localStorage for jsdom if needed
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
      },
      writable: true,
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    mockStorage = {};
    document.documentElement.className = '';
    manager = new ThemeManager();
  });

  afterEach(() => {
    manager.cleanup();
  });

  test('defaults to system mode', () => {
    expect(manager.getMode()).toBe('system');
  });

  test('cycles mode correctly: system -> light -> dark -> system', () => {
    expect(manager.getMode()).toBe('system');

    manager.cycleMode();
    expect(manager.getMode()).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    manager.cycleMode();
    expect(manager.getMode()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    manager.cycleMode();
    expect(manager.getMode()).toBe('system');
  });

  test('persists chosen mode to localStorage', () => {
    manager.setMode('light');
    expect(window.localStorage.getItem('cloudswarm_theme_mode')).toBe('light');

    const newManager = new ThemeManager();
    expect(newManager.getMode()).toBe('light');
    newManager.cleanup();
  });

  test('notifies subscribers on theme change', () => {
    const listener = jest.fn();
    const unsub = manager.subscribe(listener);

    // Initial call on subscribe
    expect(listener).toHaveBeenCalledTimes(1);

    manager.setMode('light');
    expect(listener).toHaveBeenCalledWith('light', 'light');

    unsub();
    manager.setMode('dark');
    expect(listener).toHaveBeenCalledTimes(2); // no new call after unsub
  });
});
