import { computed } from "@preact/signals";
import type { FeatureEventMessage } from "../../../src/core/protocol";
import { createFeatureStores } from "../../../src/core/stores";

export type { AppWindowState, ModalContent, ModalState, NavItem, SaveBarState, ShareRequest, TitleBarAction, TitleBarGroup, TitleBarState, Toast } from "../../../src/core/stores";

/** The embedded app's window. */
export function appFrame(): Window | null {
  return (document.getElementById('app-iframe') as HTMLIFrameElement | null)?.contentWindow ?? null;
}

/** The admin's state for each App Bridge feature, shared with the in-process test host. */
export const stores = createFeatureStores({
  emit: (feature, event, payload) => {
    const message: FeatureEventMessage = { type: 'FEATURE_EVENT', feature, event, payload };
    appFrame()?.postMessage(message, '*');
  },
});

// What the admin renders. A component reading one re-renders only when its value changes.
export const adminPath = computed(() => stores.navigation.state.value.adminPath);
export const appUrl = computed(() => stores.navigation.state.value.url);
export const appNavItems = computed(() => stores.navMenu.state.value.items);
export const appWindows = computed(() => stores.appWindow.state.value.appWindows);
export const isLoading = computed(() => stores.loading.state.value.isLoading);
export const modalStates = computed(() => stores.modal.state.value.modalStates);
export const saveBars = computed(() => stores.saveBar.state.value.saveBars);
export const shareRequest = computed(() => stores.share.state.value.current);
export const titleBar = computed(() => stores.titleBar.state.value.titleBar);
export const toasts = computed(() => stores.toast.state.value.toasts);
