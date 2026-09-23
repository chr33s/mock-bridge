import { useEffect, useState } from "react";
import { useStore } from "zustand";
import type { Config } from "../../hooks/useConfig";
import { APP_SANDBOX, embedUrl, fetchSessionToken, signalMockEnvironment } from "../../lib/app";
import { stores } from "../../store/features";

/** `<s-app-window>`: the app's page in a full-screen window over the admin. */
export function AppWindow({ config }: { config: Config }) {
  const appWindows = useStore(stores.appWindow, state => state.appWindows);
  const [sessionToken, setSessionToken] = useState('');
  const open = Object.values(appWindows).filter(appWindow => appWindow.open && appWindow.src);

  useEffect(() => {
    fetchSessionToken(config).then(setSessionToken);
  }, [config]);

  return open.map(appWindow => (
    <div
      key={appWindow.id}
      className="app-window"
      data-app-window={appWindow.id}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
      }}
    >
      <div
        style={{
          height: '3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
          backgroundColor: 'rgb(241, 241, 241)',
          borderBottom: '1px solid rgb(227, 227, 227)',
        }}
      >
        <s-button variant="tertiary" accessibilityLabel="Close" onClick={() => stores.appWindow.getState().hide({ id: appWindow.id })}>
          Close
        </s-button>
      </div>
      {sessionToken && (
        <iframe
          // The app reaches this frame by name as the element's contentWindow.
          name={`app-window-${appWindow.id}`}
          src={embedUrl(config, appWindow.src!, sessionToken)}
          style={{ flex: 1, border: 'none' }}
          allow="clipboard-write"
          sandbox={APP_SANDBOX}
          onLoad={event => signalMockEnvironment(event.currentTarget, config)}
        />
      )}
    </div>
  ));
}
