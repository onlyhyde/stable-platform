import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initI18n } from '../i18n'
import { ApprovalApp } from './App'
import '../ui/styles/globals.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

initI18n().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <ApprovalApp />
    </StrictMode>
  )
})
