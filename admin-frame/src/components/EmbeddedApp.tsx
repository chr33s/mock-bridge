import type { Config } from "../hooks/useConfig";
import { useMockBridge } from "../hooks/useMockBridge";
import { APP_SANDBOX } from "../lib/app";

export function EmbeddedApp({ config, entry }: { config: Config; entry: string }) {
  const { iframeRef, iframeSrc } = useMockBridge(config, entry);

  if (!iframeSrc) return null;

  return (
    <iframe
      id="app-iframe"
      ref={iframeRef}
      src={iframeSrc}
      style={{ width: '100%', height: '100%', border: 'none' }}
      allow="clipboard-write"
      sandbox={APP_SANDBOX}
    />
  )
}
