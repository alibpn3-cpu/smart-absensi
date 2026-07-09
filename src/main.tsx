import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './pwa/registerSW'

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the vite-plugin-pwa generated service worker via a guarded wrapper.
// Wrapper refuses to register on dev / iframe / Lovable preview hosts and
// honors ?sw=off as a manual kill-switch.
registerServiceWorker();
