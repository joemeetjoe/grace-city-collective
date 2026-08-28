import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadSiteContent } from '@/content/load'
import { SiteProvider } from '@/content/SiteProvider'
import { assetUrl } from '@/lib/assetBase'

// The page paints at once with the built-in words; the published JSON (edited
// without a rebuild, see infra/README.md) is swapped in when it arrives.
const published = () => loadSiteContent(fetch, assetUrl('content/site.json'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteProvider source={published}>
      <App />
    </SiteProvider>
  </StrictMode>,
)
