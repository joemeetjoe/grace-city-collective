import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/app/App'
import { supportsAvif } from '@/device/avif'
import { injectPreloads } from '@/device/preload'
import { readTierInputs, tierFor } from '@/device/tier'

// the hero textures of this device's tier, requested before the scene mounts,
// in the format it decodes (the verdict lands in a few ms; the engine chunk
// takes longer to arrive)
const tier = tierFor(readTierInputs())
supportsAvif().then((avif) => injectPreloads(tier, { avif }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
