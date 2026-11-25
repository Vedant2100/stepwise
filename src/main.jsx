import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import SharedClimb from './components/SharedClimb.jsx'
import { shareId } from './lib/share.js'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/jetbrains-mono'
import 'katex/dist/katex.min.css'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {shareId() ? <SharedClimb id={shareId()} /> : <App />}
  </StrictMode>,
)
