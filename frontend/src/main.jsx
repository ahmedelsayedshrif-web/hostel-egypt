import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// App Version Management - Cache Busting and Auto-Reload
if (typeof window !== 'undefined') {
  try {
    // Get current app version from meta tag or use timestamp
    const versionMeta = document.querySelector('meta[name="app-version"]')
    const currentVersion = versionMeta?.getAttribute('content') || Date.now().toString()
    
    // Check stored version
    const storedVersion = localStorage.getItem('app-version')
    const storedBuildTime = localStorage.getItem('app-build-time')
    
    // Log current version
    console.log(`🚀 HOSTEL MASR App Version: ${currentVersion}`)
    if (storedVersion && storedVersion !== currentVersion) {
      console.log(`🔄 New version detected! Old: ${storedVersion}, New: ${currentVersion}`)
      console.log('🔄 Clearing cache and reloading...')
      
      // Clear all caches
      localStorage.clear()
      sessionStorage.clear()
      
      // Clear service worker cache if exists
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name)
          })
        })
      }
      
      // Force reload after a short delay
      setTimeout(() => {
        window.location.reload(true)
      }, 100)
      // Don't continue execution - reload will happen
    } else {
      // Store current version and build time
      localStorage.setItem('app-version', currentVersion)
      localStorage.setItem('app-build-time', new Date().toISOString())
      
      // Periodic check for updates (every 5 minutes)
      setInterval(() => {
        const checkVersion = versionMeta?.getAttribute('content') || Date.now().toString()
        const stored = localStorage.getItem('app-version')
        if (stored && stored !== checkVersion) {
          console.log('🔄 Update detected during runtime, reloading...')
          localStorage.clear()
          sessionStorage.clear()
          window.location.reload(true)
        }
      }, 5 * 60 * 1000) // Check every 5 minutes
    }
  } catch (error) {
    console.error('Error in version check:', error)
  }
}

// Initialize theme BEFORE React renders to prevent flash
if (typeof window !== 'undefined') {
  // Get saved theme and color from localStorage
  const savedTheme = localStorage.getItem('theme') || 'light'
  const savedColor = localStorage.getItem('primaryColor') || 'blue'
  
  // Apply theme class immediately
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark')
    document.body.classList.add('dark')
  }
  
  // Apply primary color immediately
  const colorOptions = {
    blue: { primary: '#003580', secondary: '#004a99', accent: '#febb02' },
    green: { primary: '#059669', secondary: '#047857', accent: '#34d399' },
    purple: { primary: '#7c3aed', secondary: '#6d28d9', accent: '#a78bfa' },
    orange: { primary: '#ea580c', secondary: '#c2410c', accent: '#fb923c' },
    red: { primary: '#dc2626', secondary: '#b91c1c', accent: '#f87171' },
  }
  
  const selectedColor = colorOptions[savedColor] || colorOptions.blue
  document.documentElement.style.setProperty('--color-primary', selectedColor.primary)
  document.documentElement.style.setProperty('--color-secondary', selectedColor.secondary)
  document.documentElement.style.setProperty('--color-accent', selectedColor.accent)
  document.documentElement.style.setProperty('--booking-blue', selectedColor.primary)
}

// Global error handlers for better error tracking and preventing page hangs
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled Promise Rejection:', event.reason)
    // Prevent default browser behavior (console error)
    // But log it for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', event.reason)
      console.error('Promise:', event.promise)
    }
    // Don't let it crash the app - just log it
    event.preventDefault()
  })

  // Handle global JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('❌ Global Error:', event.error || event.message)
    if (process.env.NODE_ENV === 'development') {
      console.error('Error source:', event.filename, 'Line:', event.lineno)
    }
    // Don't prevent default - let ErrorBoundary handle it
  })

  // Handle React error boundary fallback
  window.addEventListener('error', (event) => {
    // Silently handle known non-critical errors
    if (event.message?.includes('ResizeObserver') || 
        event.message?.includes('Non-Error promise rejection')) {
      event.preventDefault()
    }
  }, true)
}

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found! Make sure index.html has <div id="root"></div>')
  }
  
  const root = createRoot(rootElement)
  root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
} catch (error) {
  console.error('[CRITICAL] Failed to render React app:', error)
  // Show error to user
  if (document.body) {
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f3f4f6; font-family: Arial, sans-serif; padding: 20px;">
        <div style="background: white; padding: 40px; border-radius: 8px; max-width: 600px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="color: #dc2626; margin-bottom: 20px;">❌ Application Failed to Load</h1>
          <p style="color: #374151; margin-bottom: 20px;">The application encountered a critical error during startup:</p>
          <pre style="background: #f9fafb; padding: 15px; border-radius: 4px; overflow-x: auto; color: #1f2937; font-size: 12px;">${error.message}\n${error.stack || ''}</pre>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #003580; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">Reload Page</button>
        </div>
      </div>
    `
  }
}
