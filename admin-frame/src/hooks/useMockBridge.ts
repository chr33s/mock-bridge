import { useEffect, useState } from "preact/hooks";
import { appBase, embedUrl, fetchSessionToken } from "../lib/app";
import type { Config } from "./useConfig";

/** Where the embedded app's iframe loads the app at `entry` (a path relative to the app's URL), once it has a session token. */
export function useMockBridge(config: Config, entry: string) {
  const [sessionToken, setSessionToken] = useState<string>('');

  useEffect(() => {
    // Need a session token to initially load the iframe
    fetchSessionToken(config).then(setSessionToken)
      .catch(error => console.error('[MockAdmin] Could not fetch a session token:', error));
  }, [config]);

  return sessionToken ? embedUrl(config, `${appBase(config)}${entry}`, sessionToken) : '';
}
