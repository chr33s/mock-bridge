import { fire, onEvent, patchMember, type FeatureContext } from './context.js';

/** Query parameters the admin adds to the app's URL. */
const ADMIN_PARAMS = ['embedded', 'host', 'shop', 'id_token', 'hmac', 'locale', 'session', 'timestamp'];
const ADMIN_URL = /^shopify:(?:\/\/)?admin(?=[/?#]|$)/;
const NEW_CONTEXTS = ['_blank', '_top', '_parent'];
const NAV_LINKS = ['ui-nav-menu', 'nav-menu', 's-app-nav']
  .flatMap(menu => ['a', 'ui-link', 's-link'].map(link => `${menu} ${link}`))
  .join(',');

/** The admin path a `shopify://admin/...` (or `shopify:admin/...`) URL points to, e.g. `/products`. */
export function adminPath(url: string): string | null {
  const match = url.match(ADMIN_URL);
  if (!match) return null;
  const rest = url.slice(match[0].length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/**
 * Navigation as App Bridge handles it: `shopify://admin/...` links and `window.open()` calls
 * go to admin pages, other windows are reported, the admin's URL follows the app's history,
 * and the admin's nav menu drives the app's router.
 */
export function navigation(ctx: FeatureContext) {
  const { window } = ctx;
  const { document, history } = window;

  function appUrl() {
    const url = new URL(window.location.href);
    for (const param of ADMIN_PARAMS) url.searchParams.delete(param);
    return url.href;
  }

  function resolve(url: string) {
    try {
      return new URL(url, document.baseURI).href;
    } catch {
      return url;
    }
  }

  const sync = (replace: boolean) => fire(ctx, 'navigation', 'sync', { url: appUrl(), replace });

  const nativeOpen = window.open;
  patchMember(ctx, window, 'open', ((url?: string | URL, target?: string, features?: string) => {
    const href = url === undefined ? '' : String(url);
    const context = target || '_blank';
    const path = adminPath(href);
    if (path !== null) {
      fire(ctx, 'navigation', 'admin', { path, newContext: context === '_blank' });
      return null;
    }
    if (context !== '_self') fire(ctx, 'navigation', 'open', { url: resolve(href), target: context });
    return ctx.native ? nativeOpen.call(window, url, target, features) : null;
  }) as typeof window.open);

  // Links: `shopify://admin/...` goes to the admin; links to other windows are reported.
  window.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.composedPath().find((node): node is Element => node instanceof window.Element && node.hasAttribute('href'));
    if (!link) return;
    const href = link.getAttribute('href')!;
    const target = link.getAttribute('target') ?? '';
    const path = adminPath(href);

    if (path !== null) {
      event.preventDefault();
      fire(ctx, 'navigation', 'admin', { path, newContext: target === '_blank' });
    } else if (NEW_CONTEXTS.includes(target)) {
      fire(ctx, 'navigation', 'open', { url: resolve(href), target });
      if (!ctx.native) event.preventDefault();
    }
  }, { signal: ctx.signal });

  // The admin's URL follows the app's.
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    patchMember(ctx, history, method, function (this: History, ...args: Parameters<History['pushState']>) {
      original.apply(this, args);
      sync(method === 'replaceState');
    });
  }
  window.addEventListener('popstate', () => sync(true), { signal: ctx.signal });
  window.addEventListener('hashchange', () => sync(true), { signal: ctx.signal });
  sync(true);

  // The merchant picked an item in the admin's nav menu: follow the app's own link, so its
  // router handles it. `<s-link>`s dispatch `shopify:navigate`, which Shopify's React Router
  // AppProvider routes.
  onEvent(ctx, 'navigation', (event, payload: { href: string }) => {
    if (event !== 'navigate') return;
    const link = Array.from(document.querySelectorAll(NAV_LINKS)).find(element => element.getAttribute('href') === payload.href);
    if (link instanceof window.HTMLAnchorElement) link.click();
    else if (link) link.dispatchEvent(new window.CustomEvent('shopify:navigate', { bubbles: true, composed: true }));
    else window.location.assign(payload.href);
  });
}
