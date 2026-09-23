import { useEffect, useRef, useState } from "preact/hooks";
import { appBase, embedUrl, fetchSessionToken, signalMockEnvironment } from "../lib/app";
import type { Config } from "./useConfig";

/** The embedded app's iframe, loading the app at `entry` (a path relative to the app's URL). */
export function useMockBridge(config: Config, entry: string) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sessionToken, setSessionToken] = useState<string>('');

  useEffect(() => {
    // Need a session token to initially load the iframe
    fetchSessionToken(config).then(setSessionToken);
  }, [config]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Scripts can't be injected across origins: the app detects the mock environment and loads the mock App Bridge.
    const handleLoad = () => signalMockEnvironment(iframe, config);
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [config, sessionToken]);

  const iframeSrc = sessionToken ? embedUrl(config, `${appBase(config)}${entry}`, sessionToken) : '';

  return { iframeRef, iframeSrc };
}
