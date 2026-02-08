import React from 'react'
import ReactDOM from 'react-dom/client'
import { initI18n } from '../i18n'
import { App } from './App'

initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
