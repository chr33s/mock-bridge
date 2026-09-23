import { fire, observeElements, onEvent, type FeatureContext } from './context.js';

/** Mirrors `<s-app-window>` elements into the admin, which shows them as full-screen windows. */
export function appWindow(ctx: FeatureContext) {
  const { window } = ctx;

  observeElements(ctx, ['s-app-window'], element => {
    const id = element.getAttribute('id');
    if (!id) return;
    let open = false;

    element.style.display = 'none';

    const src = () => {
      const value = element.getAttribute('src');
      if (!value) return null;
      try {
        return new URL(value, element.ownerDocument.baseURI).href;
      } catch {
        return value;
      }
    };
    const update = () => fire(ctx, 'appWindow', 'update', { id, src: src() });
    update();

    const observer = new window.MutationObserver(update);
    observer.observe(element, { attributes: true, attributeFilter: ['src'] });
    ctx.signal.addEventListener('abort', () => observer.disconnect());

    onEvent(ctx, 'appWindow', (event, payload: { id: string }) => {
      if (payload?.id !== id || (event !== 'show' && event !== 'hide')) return;
      open = event === 'show';
      element.dispatchEvent(new window.Event(event));
    });

    const action = (name: string) => async () => { await ctx.host.invoke('appWindow', name, { id }); };
    Object.defineProperties(element, {
      show: { configurable: true, value: action('show') },
      hide: { configurable: true, value: action('hide') },
      toggle: { configurable: true, value: action('toggle') },
      src: {
        configurable: true,
        get: () => element.getAttribute('src') ?? '',
        set: (value: string) => {
          element.setAttribute('src', value);
          update();
        },
      },
      // The admin names each window's iframe; named frames are reachable across origins.
      contentWindow: {
        configurable: true,
        get: () => open && window.parent !== window
          ? (window.parent as unknown as Record<string, Window | undefined>)[`app-window-${id}`] ?? null
          : null,
      },
    });
  });
}
