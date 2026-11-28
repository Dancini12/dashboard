import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Recuperacao from './components/Recuperacao.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Recuperacao><App /></Recuperacao>
  </StrictMode>,
)
