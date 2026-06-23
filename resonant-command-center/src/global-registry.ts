/**
 * Module-scoped global registry — replaces (window as any) pollution.
 * Provides a type-safe way to register and retrieve functions that
 * need to be called from inline event handlers in the DOM.
 */

type GlobalHandler = (...args: unknown[]) => void;

const registry = new Map<string, GlobalHandler>();

/**
 * Register a function as a global handler.
 */
export function registerGlobal(name: string, handler: GlobalHandler): void {
  registry.set(name, handler);
}

/**
 * Retrieve a registered global handler.
 */
export function getGlobal(name: string): GlobalHandler | undefined {
  return registry.get(name);
}

/**
 * Clear all registered globals.
 */
export function clearGlobals(): void {
  registry.clear();
}

/**
 * Create a sandboxed DOM environment for testing.
 */
export function createSandbox(): {
  createElement: typeof document.createElement;
  querySelector: typeof document.querySelector;
} {
  return {
    createElement: document.createElement.bind(document),
    querySelector: document.querySelector.bind(document),
  };
}
