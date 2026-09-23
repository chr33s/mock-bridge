import { useEffect } from "preact/hooks";
import type { FeatureActionRequestMessage, FeatureActionResponseMessage } from "../../../src/core/protocol";
import { runFeatureAction } from "../../../src/core/stores";
import { fetchSessionToken } from "../lib/app";
import { stores } from "../store/features";
import type { Config } from "./useConfig";

/** Answers App Bridge requests from the app and its app windows. */
export function useBridgeMessages(config: Config | null) {
  useEffect(() => {
    if (!config) return;

    const handleMessage = (event: MessageEvent) => {
      const source = event.source as Window | null;
      if (!source || !event.data?.type) return;

      if (event.data.type === 'SESSION_TOKEN_REQUEST') {
        fetchSessionToken(config).then(token => {
          source.postMessage({ type: 'SESSION_TOKEN_RESPONSE', token }, '*');
        });
      }

      // The app called something, like shopify.modal.show('modal_id'): run it on the feature's store.
      if (event.data.type === 'FEATURE_ACTION_REQUEST') {
        const { action_id, feature, action, payload } = event.data as FeatureActionRequestMessage;

        const { handled, result } = runFeatureAction(stores, feature, action, payload);
        if (!handled) {
          console.warn('[MockAdmin] Unknown feature action:', feature, action);
        }

        // Some actions (like sharing) resolve once the merchant answers. Replying in a later
        // task lets Preact render first, so e.g. an app window is on screen when show() resolves.
        Promise.resolve(result).then(result => setTimeout(() => {
          const response: FeatureActionResponseMessage = { type: 'FEATURE_ACTION_RESPONSE', action_id, payload: result };
          source.postMessage(response, '*');
        }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [config]);
}
