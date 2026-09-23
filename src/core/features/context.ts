import type { BridgeHost } from '../protocol.js';

export type BridgeWindow = Window & typeof globalThis;

export interface FeatureContext {
  host: BridgeHost;
  window: BridgeWindow;
  /** Aborted when the bridge is disposed; observers and listeners detach. */
  signal: AbortSignal;
  /** Whether `print()` and `window.open()` also reach the browser, or are only recorded. */
  native: boolean;
}

/** Invokes an action whose result the app never sees, e.g. from a sync API. */
export function fire(ctx: FeatureContext, feature: string, action: string, payload?: unknown) {
  ctx.host.invoke(feature, action, payload).catch(error => {
    console.warn(`[MockAppBridge] ${feature}.${action} failed:`, error);
  });
}

/** Calls `listener` for the admin's events about `feature` until the bridge is disposed. */
export function onEvent(ctx: FeatureContext, feature: string, listener: (event: string, payload: any) => void) {
  const unsubscribe = ctx.host.listen(event => {
    if (event.feature === feature) listener(event.event, event.payload);
  });
  ctx.signal.addEventListener('abort', unsubscribe);
}

/** Replaces `target[key]` until the bridge is disposed. */
export function patchMember<T extends object, K extends keyof T>(ctx: FeatureContext, target: T, key: K, value: T[K]) {
  const own = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  ctx.signal.addEventListener('abort', () => {
    if (target[key] !== value) return;
    if (own) Object.defineProperty(target, key, own);
    else delete target[key];
  });
}

/** Runs `setup` for every current and future element matching `selectors`. */
export function observeElements(ctx: FeatureContext, selectors: string[], setup: (element: HTMLElement) => void) {
  const { document, MutationObserver, HTMLElement } = ctx.window;
  const seen = new WeakSet<Element>();
  const visit = (element: Element) => {
    if (seen.has(element) || !(element instanceof HTMLElement)) return;
    seen.add(element);
    setup(element);
  };
  const scan = () => document.querySelectorAll(selectors.join(',')).forEach(visit);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { signal: ctx.signal });
  } else {
    scan();
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(selectors.join(','))) visit(node);
        node.querySelectorAll(selectors.join(',')).forEach(visit);
      });
    }
  });
  // Observing the document (not documentElement) also works before parsing starts.
  observer.observe(document, { childList: true, subtree: true });
  ctx.signal.addEventListener('abort', () => observer.disconnect());
}
