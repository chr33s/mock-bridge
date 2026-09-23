import { signal, type ReadonlySignal } from '@preact/signals-core';

/**
 * Admin-side state for each App Bridge feature. The admin-frame renders it;
 * the in-process test host lets tests assert on it.
 */

export type ModalContent = {
  id: string;
  title: string;
  variant?: string;
  src: string | null;
  buttons: Array<{
    id: string;
    label: string;
    variant?: string;
    tone?: string;
    disabled?: boolean;
    loading?: boolean;
  }>;
};

export type ModalState = {
  open: boolean;
  heading: string;
  content: ModalContent;
  html: string;
};

export type SaveBarState = {
  id: string;
  visible: boolean;
  discardConfirmation: boolean;
};

export type NavItem = {
  label: string;
  href: string;
  isHome?: boolean;
  active?: boolean;
};

export type Toast = {
  id: string;
  message: string;
  duration?: number;
  isError?: boolean;
  action?: string;
};

export type NavigationEntry =
  /** The app changed its own URL (`history.pushState`/`replaceState`, back/forward or a page load). */
  | { type: 'history'; url: string; replace: boolean }
  /** The app sent the merchant to an admin page, e.g. `shopify://admin/products` is `/products`. */
  | { type: 'admin'; path: string; newContext: boolean }
  /** The app opened a URL outside itself, e.g. `window.open(url, '_blank')` or a `target="_top"` link. */
  | { type: 'open'; url: string; target: string };

export type NavigationState = {
  /** The app's URL, without the admin's `host`/`shop`/`embedded`/`id_token` parameters. */
  url: string | null;
  /** The admin page showing instead of the app, or `null` while the app shows. */
  adminPath: string | null;
  /** Every navigation, in order. */
  entries: NavigationEntry[];
};

export type AppWindowState = {
  id: string;
  /** The window's page, resolved against the app's URL. */
  src: string | null;
  open: boolean;
};

export type TitleBarAction = {
  /** The element's `id`, or its place in the title bar, e.g. `primary` or `secondary-1`. */
  id: string;
  label: string;
  variant?: string;
  tone?: string;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
};

/** Secondary actions grouped under one button: a `<section label>`, or an `<s-menu>` a button opens. */
export type TitleBarGroup = {
  label: string;
  actions: TitleBarAction[];
};

export type TitleBarState = {
  title: string;
  breadcrumb: TitleBarAction | null;
  primaryAction: TitleBarAction | null;
  secondaryActions: Array<TitleBarAction | TitleBarGroup>;
};

export type ShareRequest = {
  title?: string;
  text?: string;
  url?: string;
  /** Files can't cross to the admin; only their descriptions do. */
  files?: Array<{ name: string; type: string; size: number }>;
};

export type ShareOutcome = 'shared' | 'cancelled';

/** Sends an event to the app, e.g. `emit('appWindow', 'hide', { id })`. */
export type FeatureEmitter = (feature: string, event: string, payload?: unknown) => void;

type Setter<S> = (change: Partial<S> | ((state: S) => Partial<S>)) => void;

export interface FeatureStore<S, A> {
  /** The feature's state. Read `.value` to track it, `.peek()` to read it untracked. */
  state: ReadonlySignal<S>;
  /** Changes the state: merges `change` into it. */
  set: Setter<S>;
  /** Puts the state back how it started. */
  reset(): void;
  actions: A;
}

function defineStore<S extends object, A>(initial: S, actions: (set: Setter<S>, get: () => S) => A): FeatureStore<S, A> {
  const state = signal(initial);
  const get = () => state.peek();
  const set: Setter<S> = change => {
    state.value = { ...get(), ...(typeof change === 'function' ? change(get()) : change) };
  };
  return { state, set, reset: () => { state.value = initial; }, actions: actions(set, get) };
}

function createModalStore() {
  const emptyModal = (id: string): ModalState => ({
    open: false,
    heading: '',
    content: { id, title: '', variant: 'base', src: null, buttons: [] },
    html: '',
  });

  return defineStore(
    { modalStates: {} as Record<string, ModalState> },
    set => {
      const patch = (id: string, change: (modal: ModalState) => Partial<ModalState>) => set(state => {
        const modal = state.modalStates[id] ?? emptyModal(id);
        return { modalStates: { ...state.modalStates, [id]: { ...modal, ...change(modal) } } };
      });

      return {
        show: (payload: { id: string }) => patch(payload.id, () => ({ open: true })),
        hide: (payload: { id: string }) => patch(payload.id, () => ({ open: false })),
        toggle: (payload: { id: string }) => patch(payload.id, modal => ({ open: !modal.open })),
        update: (payload: { id: string; heading: string; content: ModalContent }) =>
          patch(payload.id, () => ({ heading: payload.heading, content: payload.content })),
        updateHtml: (payload: { id: string; html: string }) => patch(payload.id, () => ({ html: payload.html })),
      };
    },
  );
}

function createLoadingStore() {
  return defineStore(
    { isLoading: false },
    set => ({
      setLoading: (payload: { isLoading: boolean }) => set({ isLoading: payload.isLoading }),
    }),
  );
}

function createSaveBarStore() {
  return defineStore(
    { saveBars: {} as Record<string, SaveBarState> },
    set => {
      const patch = (id: string, change: (saveBar: SaveBarState) => Partial<SaveBarState>) => set(state => {
        const saveBar = state.saveBars[id] ?? { id, visible: false, discardConfirmation: false };
        return { saveBars: { ...state.saveBars, [id]: { ...saveBar, ...change(saveBar) } } };
      });

      return {
        show: (payload: { id: string }) => patch(payload.id, () => ({ visible: true })),
        hide: (payload: { id: string }) => patch(payload.id, () => ({ visible: false })),
        toggle: (payload: { id: string }) => patch(payload.id, saveBar => ({ visible: !saveBar.visible })),
        update: (payload: { id: string; discardConfirmation?: boolean }) =>
          patch(payload.id, () => ({ discardConfirmation: payload.discardConfirmation ?? false })),
      };
    },
  );
}

function createNavMenuStore() {
  return defineStore(
    { items: [] as NavItem[] },
    set => ({
      setItems: (payload: { items: NavItem[] }) => set({ items: payload.items }),
      addItem: (payload: NavItem) => set(state => ({ items: [...state.items, payload] })),
      clearItems: () => set({ items: [] }),
    }),
  );
}

function createToastStore() {
  return defineStore(
    { toasts: [] as Toast[] },
    set => ({
      show: (payload: Toast) => set(state => ({ toasts: [...state.toasts, payload] })),
      hide: (payload: { id: string }) => set(state => ({ toasts: state.toasts.filter(toast => toast.id !== payload.id) })),
    }),
  );
}

function createResourcePickerStore() {
  return defineStore(
    // What the picker resolves to; `undefined` means the merchant cancelled.
    { selection: [] as unknown[] | undefined },
    (set, get) => ({
      open: (_payload: { options: unknown }) => get().selection,
      setSelection: (payload: { selection: unknown[] | undefined }) => set({ selection: payload.selection }),
    }),
  );
}

function createNavigationStore(emit: FeatureEmitter) {
  return defineStore(
    { url: null, adminPath: null, entries: [] } as NavigationState,
    set => {
      const record = (entry: NavigationEntry, change: Partial<NavigationState> = {}) =>
        set(state => ({ ...change, entries: [...state.entries, entry] }));

      return {
        sync: (payload: { url: string; replace: boolean }) =>
          record({ type: 'history', ...payload }, { url: payload.url }),
        admin: (payload: { path: string; newContext?: boolean }) => {
          const newContext = payload.newContext ?? false;
          record({ type: 'admin', path: payload.path, newContext }, newContext ? {} : { adminPath: payload.path });
        },
        open: (payload: { url: string; target: string }) => record({ type: 'open', ...payload }),
        /** The merchant picked an app nav menu item in the admin. */
        navigate: (payload: { href: string }) => emit('navigation', 'navigate', payload),
      };
    },
  );
}

function createAppWindowStore(emit: FeatureEmitter) {
  return defineStore(
    { appWindows: {} as Record<string, AppWindowState> },
    (set, get) => {
      const patch = (id: string, change: Partial<AppWindowState>) => set(state => {
        const appWindow = state.appWindows[id] ?? { id, src: null, open: false };
        return { appWindows: { ...state.appWindows, [id]: { ...appWindow, ...change } } };
      });
      const setOpen = (id: string, open: boolean) => {
        if ((get().appWindows[id]?.open ?? false) === open) return;
        patch(id, { open });
        emit('appWindow', open ? 'show' : 'hide', { id });
      };

      return {
        update: (payload: { id: string; src: string | null }) => patch(payload.id, { src: payload.src }),
        show: (payload: { id: string }) => setOpen(payload.id, true),
        hide: (payload: { id: string }) => setOpen(payload.id, false),
        toggle: (payload: { id: string }) => setOpen(payload.id, !get().appWindows[payload.id]?.open),
      };
    },
  );
}

function createTitleBarStore(emit: FeatureEmitter) {
  return defineStore(
    // The app's `<ui-title-bar>` or `<s-page>`, or `null` without one.
    { titleBar: null as TitleBarState | null },
    set => ({
      update: (payload: { titleBar: TitleBarState | null }) => set({ titleBar: payload.titleBar }),
      /** The merchant clicked a title bar action. */
      click: (payload: { id: string }) => emit('titleBar', 'click', payload),
    }),
  );
}

function createShareStore() {
  let settle: ((outcome: ShareOutcome) => void) | undefined;

  return defineStore(
    {
      /** The share sheet showing in the admin. */
      current: null as ShareRequest | null,
      /** Answers every share straight away instead of showing the sheet. */
      outcome: undefined as ShareOutcome | undefined,
    },
    (set, get) => ({
      share: (payload: ShareRequest): ShareOutcome | Promise<ShareOutcome> => {
        const { outcome } = get();
        if (outcome) return outcome;
        settle?.('cancelled');
        set({ current: payload });
        return new Promise(resolve => { settle = resolve; });
      },
      /** The merchant shared or dismissed the sheet. */
      settle: (payload: { outcome: ShareOutcome }) => {
        settle?.(payload.outcome);
        settle = undefined;
        set({ current: null });
      },
      setOutcome: (payload: { outcome: ShareOutcome | undefined }) => set({ outcome: payload.outcome }),
    }),
  );
}

function createPrintStore() {
  return defineStore(
    { count: 0 },
    set => ({
      print: () => set(state => ({ count: state.count + 1 })),
    }),
  );
}

export interface FeatureStoresOptions {
  /** Delivers admin events to the app. */
  emit?: FeatureEmitter;
}

export function createFeatureStores(options: FeatureStoresOptions = {}) {
  const emit = options.emit ?? (() => {});
  return {
    modal: createModalStore(),
    loading: createLoadingStore(),
    saveBar: createSaveBarStore(),
    navMenu: createNavMenuStore(),
    toast: createToastStore(),
    resourcePicker: createResourcePickerStore(),
    navigation: createNavigationStore(emit),
    appWindow: createAppWindowStore(emit),
    titleBar: createTitleBarStore(emit),
    share: createShareStore(),
    print: createPrintStore(),
  };
}

export type FeatureStores = ReturnType<typeof createFeatureStores>;
export type FeatureName = keyof FeatureStores;

/** Calls `action` on a feature's store. Returns `handled: false` for unknown features or actions. */
export function runFeatureAction(stores: FeatureStores, feature: string, action: string, payload: unknown) {
  const store = Object.hasOwn(stores, feature) ? stores[feature as FeatureName] : undefined;
  const fn = store && Object.hasOwn(store.actions, action) ? (store.actions as Record<string, unknown>)[action] : undefined;
  if (typeof fn !== 'function') return { handled: false, result: undefined };
  return { handled: true, result: (fn as (payload: unknown) => unknown)(payload) };
}

export function resetFeatureStores(stores: FeatureStores) {
  for (const store of Object.values(stores)) store.reset();
}
