import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { injectPreloads } from '@/device/preload'
import { readTierInputs, tierFor } from '@/device/tier'

// the hero textures of this device's tier, requested before the scene mounts
injectPreloads(tierFor(readTierInputs()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
