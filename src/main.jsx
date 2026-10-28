import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import '@fontsource/almarai/arabic-300.css'
import '@fontsource/almarai/latin-300.css'
import '@fontsource/almarai/arabic-400.css'
import '@fontsource/almarai/latin-400.css'
import '@fontsource/almarai/arabic-700.css'
import '@fontsource/almarai/latin-700.css'
import '@fontsource/almarai/arabic-800.css'
import '@fontsource/almarai/latin-800.css'
import '@fontsource/aref-ruqaa/arabic-400.css'
import '@fontsource/aref-ruqaa/latin-400.css'
import '@fontsource/aref-ruqaa/arabic-700.css'
import '@fontsource/aref-ruqaa/latin-700.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css'
import '@/index.css'
import { installSessionGuard } from '@/lib/sessionGuard'

installSessionGuard()

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </ErrorBoundary>
)
