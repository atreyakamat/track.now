import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/tokens.css'
import '@/styles/global.css'
import '@/styles/ui.css'
import '@/styles/layout.css'
import { App } from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Failed to find root element.')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
