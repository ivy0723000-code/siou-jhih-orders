import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import OrderLookup from './OrderLookup.jsx'

function Root() {
  const path = window.location.pathname;
  const isLookup = path === '/lookup' || path === '/order' || path.includes('lookup');
  return isLookup ? <OrderLookup /> : <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
