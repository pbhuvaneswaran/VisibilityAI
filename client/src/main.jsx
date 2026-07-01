import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppV3 from './AppV3.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppV3 />
  </StrictMode>,
)
