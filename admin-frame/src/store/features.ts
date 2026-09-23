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
