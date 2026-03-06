import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.tsx'

axios.defaults.baseURL = '/api'

let isHandlingUnauthorized = false

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const token = localStorage.getItem('token')

    if (status === 401 && token && !isHandlingUnauthorized) {
      isHandlingUnauthorized = true
      window.dispatchEvent(new Event('app:logout'))
      localStorage.clear()

      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }

      window.setTimeout(() => {
        isHandlingUnauthorized = false
      }, 800)
    }

    return Promise.reject(error)
  }
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)