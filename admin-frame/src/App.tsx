import { useStore } from "zustand"
import { AdminPage } from "./components/AdminPage"
import { EmbeddedApp } from "./components/EmbeddedApp"
import { AppWindow } from "./components/features/AppWindow"
import { Loading } from "./components/features/Loading"
import { Modal } from "./components/features/Modal"
import { SaveBar } from "./components/features/SaveBar"
import { Share } from "./components/features/Share"
import { Toast } from "./components/features/Toast"
import { Frame } from "./components/Frame"
import { useAdminRoute } from "./hooks/useAdminRoute"
import { useBridgeMessages } from "./hooks/useBridgeMessages"
import { useConfig } from "./hooks/useConfig"
import { stores } from "./store/features"

function App() {
  const config = useConfig()
  const { route, navigateApp } = useAdminRoute(config)
  const adminPath = useStore(stores.navigation, state => state.adminPath)
  useBridgeMessages(config)

  return (
    <Frame onNavigateApp={navigateApp}>
      <Loading />
      <Modal />
      <SaveBar />
      <Toast />
      <Share />

      {adminPath !== null ? (
        <AdminPage path={adminPath} />
      ) : config && route && (
        <>
          <AppWindow config={config} />
          <EmbeddedApp key={route.key} config={config} entry={route.entry} />
        </>
      )}
    </Frame>
  )
}

export default App
