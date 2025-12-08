import { Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { ToastProvider } from './components/Toast'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Apartments from './pages/Apartments'
import ApartmentDetails from './pages/ApartmentDetails'
import AddApartment from './pages/AddApartment'
import Partners from './pages/Partners'
import Bookings from './pages/Bookings'
import Settings from './pages/Settings'
import Financial from './pages/Financial'
import DevelopmentFund from './pages/DevelopmentFund'
import Inventory from './pages/Inventory'
import { currencyAPI } from './services/api'

function App() {
  // تحديث أسعار الصرف تلقائياً عند فتح التطبيق
  useEffect(() => {
    const refreshExchangeRates = async () => {
      try {
        await currencyAPI.refreshFromInternet()
      } catch (error) {
        console.error('❌ فشل تحديث أسعار الصرف:', error)
      }
    }
    
    refreshExchangeRates()
  }, [])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/apartments" element={<Apartments />} />
            <Route path="/apartments/add" element={<AddApartment />} />
            <Route path="/apartments/edit/:id" element={<AddApartment />} />
            <Route path="/apartments/:id" element={<ApartmentDetails />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/fund" element={<DevelopmentFund />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/financial" element={<Financial />} />
          </Routes>
        </motion.main>
      </div>
    </ToastProvider>
  )
}

export default App
