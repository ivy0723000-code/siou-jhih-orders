import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import OrderLookup from './OrderLookup.jsx'

const path = window.location.pathname;
const isLookup = path === '/lookup' || path === '/order' || path.includes('lookup');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isLookup ? <OrderLookup /> : <App />}
  </StrictMode>
)
