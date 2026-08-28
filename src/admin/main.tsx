import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { SiteEditor } from './SiteEditor'
import { missingEditorVars, readEditorConfig } from './editorConfig'
import { loadSiteContent } from '@/content/load'
import { assetUrl } from '@/lib/assetBase'

// Editing starts from whatever is published (or the built-in words if
// nothing is), so a second edit never reverts the first.
const env = import.meta.env
const config = readEditorConfig(env)
const missing = missingEditorVars(env)

loadSiteContent(fetch, assetUrl('content/site.json')).then((initialContent) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteEditor config={config} missing={missing} initialContent={initialContent} />
    </StrictMode>,
  )
})
