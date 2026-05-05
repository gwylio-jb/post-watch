import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Redesign stylesheet — imported AFTER index.css so its more-specific
// rules (everything scoped under .app-shell or theme classes) take
// precedence where both schemes are active.
import './styles/redesign.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
