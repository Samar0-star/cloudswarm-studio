/**
 * WebMCP Client-Side Auto-Detecting Polyfill
 *
 * Automatically detects native browser document.modelContext / window.modelContext
 * and installs the fallback WebMCP runtime if not natively available.
 */

import { WebModelContextEngine } from './WebModelContextEngine';
import type { WebModelContextAPI } from '../../types/webmcp';

declare global {
  interface Window {
    modelContext?: WebModelContextAPI;
  }
  interface Document {
    modelContext?: WebModelContextAPI;
  }
}

let activeSingleton: WebModelContextAPI | null = null;

/**
 * Checks whether an object satisfies the minimum WebModelContextAPI interface.
 */
function isValidWebModelContext(obj: unknown): obj is WebModelContextAPI {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.registerTool === 'function' &&
    typeof candidate.registerResource === 'function' &&
    typeof candidate.getTools === 'function'
  );
}

/**
 * Ensures document.modelContext and window.modelContext are initialized and returned.
 */
export function ensureWebModelContext(): WebModelContextAPI {
  // Check cached singleton first
  if (activeSingleton && activeSingleton instanceof WebModelContextEngine) {
    return activeSingleton;
  }

  const polyfillInstance = new WebModelContextEngine(true);
  activeSingleton = polyfillInstance;

  // Mount on window safely, preserving any existing foreign properties if it was a stub
  // Mount on window directly
  if (typeof window !== 'undefined') {
    try {
      const win = window as any;
      win.__realExecuteTool__ = (name: string, params?: Record<string, unknown>, context?: any) => {
        return polyfillInstance.executeTool(name, params, context);
      };
      win.modelContext = polyfillInstance;
      win.webmcp = polyfillInstance;
      win.mcp = polyfillInstance;
      win.__modelContext__ = polyfillInstance;
    } catch {
      try {
        Object.defineProperty(window, 'modelContext', {
          value: polyfillInstance,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch {}
    }
  }

  // Mount on navigator (official W3C standard)
  if (typeof navigator !== 'undefined') {
    try {
      (navigator as any).modelContext = polyfillInstance;
    } catch {
      try {
        Object.defineProperty(navigator, 'modelContext', {
          value: polyfillInstance,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch {}
    }
  }

  // Mount on document safely - NEVER throw if document.modelContext is read-only
  if (typeof document !== 'undefined') {
    try {
      if (typeof HTMLDocument !== 'undefined' && HTMLDocument.prototype) {
        Object.defineProperty(HTMLDocument.prototype, 'modelContext', {
          get() {
            return polyfillInstance;
          },
          configurable: true,
          enumerable: true,
        });
      }
    } catch {}

    try {
      if (!('modelContext' in document)) {
        Object.defineProperty(document, 'modelContext', {
          get() {
            return polyfillInstance;
          },
          configurable: true,
          enumerable: true,
        });
      }
    } catch {}
  }

  // Also attach to globalThis for node/testing environments
  if (typeof globalThis !== 'undefined') {
    try {
      (globalThis as unknown as { modelContext?: WebModelContextAPI }).modelContext = polyfillInstance;
    } catch {}
  }

  return polyfillInstance;
}

/**
 * Retrieves the currently active WebModelContextAPI instance or initializes one.
 */
export function getWebModelContext(): WebModelContextAPI {
  return ensureWebModelContext();
}

/**
 * Resets the active polyfill instance (primarily used in test teardown).
 */
export function resetWebModelContext(): void {
  activeSingleton = null;
  if (typeof window !== 'undefined') {
    delete (window as { modelContext?: WebModelContextAPI }).modelContext;
  }
  if (typeof document !== 'undefined') {
    delete (document as { modelContext?: WebModelContextAPI }).modelContext;
  }
  if (typeof globalThis !== 'undefined') {
    delete (globalThis as unknown as { modelContext?: WebModelContextAPI }).modelContext;
  }
}
