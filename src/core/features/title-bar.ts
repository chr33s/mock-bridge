import type { TitleBarAction, TitleBarGroup, TitleBarState } from '../stores.js';
import { fire, onEvent, type FeatureContext } from './context.js';

const ACTIONS = ['button', 'a', 's-button', 's-link'];
// The attributes the title bar is built from; others (like `style`) don't change it.
const ATTRIBUTES = ['title', 'heading', 'slot', 'id', 'label', 'variant', 'tone', 'href', 'disabled', 'loading', 'commandfor'];

/**
 * Mirrors the page's title bar into the admin: a `<ui-title-bar>` outside a modal, or else an
 * `<s-page>` with its `heading` and `breadcrumb-actions`, `primary-action` and
 * `secondary-actions` slots. Clicking an action in the admin clicks the app's element.
 */
export function titleBar(ctx: FeatureContext) {
  const { window } = ctx;
  const { document } = window;
  let elements = new Map<string, Element>();
  let sent: string | undefined;

  const isAction = (element: Element) => ACTIONS.includes(element.localName);

  function action(element: Element, place: string): TitleBarAction {
    const id = element.id || place;
    elements.set(id, element);
    return {
      id,
      label: element.textContent?.trim() || element.getAttribute('accessibilitylabel') || '',
      variant: element.getAttribute('variant') || undefined,
      tone: element.getAttribute('tone') || undefined,
      href: element.getAttribute('href') || undefined,
      disabled: element.hasAttribute('disabled') || (element as { disabled?: unknown }).disabled === true,
      loading: element.hasAttribute('loading'),
    };
  }

  const group = (label: string, actions: Element[], place: string): TitleBarGroup => ({
    label,
    actions: actions.map((element, index) => action(element, `${place}-${index}`)),
  });

  // <ui-title-bar title> with <a|button variant="breadcrumb|primary">, other buttons and <section label>s.
  function fromTitleBar(bar: Element): TitleBarState {
    const children = Array.from(bar.children);
    const breadcrumb = children.find(child => isAction(child) && child.getAttribute('variant') === 'breadcrumb');
    const primary = children.find(child => isAction(child) && child.getAttribute('variant') === 'primary');
    const secondary = children.filter(child => child !== breadcrumb && child !== primary && (isAction(child) || child.localName === 'section'));
    return {
      title: bar.getAttribute('title') || '',
      breadcrumb: breadcrumb ? action(breadcrumb, 'breadcrumb') : null,
      primaryAction: primary ? action(primary, 'primary') : null,
      secondaryActions: secondary.map((child, index) => child.localName === 'section'
        ? group(child.getAttribute('label') || '', Array.from(child.children).filter(isAction), `secondary-${index}`)
        : action(child, `secondary-${index}`)),
    };
  }

  // <s-page heading> with slotted actions; a secondary action opening an <s-menu> is a group.
  function fromPage(page: Element): TitleBarState {
    const slotted = (slot: string) => Array.from(page.children).filter(child => child.getAttribute('slot') === slot && isAction(child));
    const [breadcrumb] = slotted('breadcrumb-actions');
    const [primary] = slotted('primary-action');
    const menu = (element: Element) => {
      const id = element.getAttribute('commandfor');
      const target = id ? document.getElementById(id) : null;
      return target?.localName === 's-menu' ? target : null;
    };
    const heading = (page as { heading?: unknown }).heading;
    return {
      title: page.getAttribute('heading') || (typeof heading === 'string' ? heading : ''),
      breadcrumb: breadcrumb ? action(breadcrumb, 'breadcrumb') : null,
      primaryAction: primary ? action(primary, 'primary') : null,
      secondaryActions: slotted('secondary-actions').map((child, index) => {
        const target = menu(child);
        return target
          ? group(child.textContent?.trim() || '', Array.from(target.children).filter(isAction), `secondary-${index}`)
          : action(child, `secondary-${index}`);
      }),
    };
  }

  function current() {
    const bars = Array.from(document.querySelectorAll('ui-title-bar')).filter(bar => !bar.closest('ui-modal'));
    for (const bar of bars) {
      // App Bridge renders the title bar in the admin, not the app.
      if (bar instanceof window.HTMLElement && bar.style.display !== 'none') bar.style.display = 'none';
    }
    const bar = bars.at(-1);
    if (bar) return fromTitleBar(bar);
    const page = Array.from(document.querySelectorAll('s-page')).filter(page => !page.closest('ui-modal')).at(-1);
    return page ? fromPage(page) : null;
  }

  function sync() {
    elements = new Map();
    const state = current();
    const json = JSON.stringify(state);
    if (json === sent) return;
    sent = json;
    fire(ctx, 'titleBar', 'update', { titleBar: state });
  }

  let scheduled = false;
  const observer = new window.MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!ctx.signal.aborted) sync();
    });
  });
  observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  ctx.signal.addEventListener('abort', () => observer.disconnect());
  sync();

  // The merchant clicked an action in the admin: click the app's element. Links that aren't
  // anchors (`<s-link>`) dispatch `shopify:navigate`, like the nav menu's.
  onEvent(ctx, 'titleBar', (event, payload: { id: string }) => {
    if (event !== 'click') return;
    const element = elements.get(payload?.id);
    if (!(element instanceof window.HTMLElement)) return;
    if (element.hasAttribute('href') && !(element instanceof window.HTMLAnchorElement)) {
      element.dispatchEvent(new window.CustomEvent('shopify:navigate', { bubbles: true, composed: true }));
    } else {
      element.click();
    }
  });
}
