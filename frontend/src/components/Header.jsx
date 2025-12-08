import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const Header = () => {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { path: '/', label: 'الرئيسية', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { path: '/apartments', label: 'الشقق', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )},
    { path: '/partners', label: 'الشركاء', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )},
    { path: '/bookings', label: 'الحجوزات', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { path: '/financial', label: 'المالية', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { path: '/fund', label: 'صندوق التطوير', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { path: '/inventory', label: 'المخزون', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )},
    { path: '/settings', label: 'الإعدادات', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
  ]

  // Filter to ensure no duplicates based on path
  const uniqueNavItems = navItems.filter((item, index, self) => 
    index === self.findIndex((t) => t.path === item.path)
  )

  return (
    <header className="sticky top-0 z-50">
      {/* Main Header with Gradient */}
      <div className="bg-gradient-to-l from-[#001a40] via-[#003580] to-[#004a99] shadow-xl">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16 flex-nowrap">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 xl:gap-4 group flex-shrink-0 min-w-0">
              {/* Logo Mark - Responsive container */}
              <motion.div 
                className="relative flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                style={{
                  maxWidth: 'min(50vw, 300px)',
                  width: 'fit-content'
                }}
              >
                <div 
                  className="bg-gradient-to-br from-[#febb02] to-[#ff9500] rounded-lg sm:rounded-xl shadow-lg shadow-yellow-500/30 flex-shrink-0"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    padding: 'clamp(4px, 0.8vw, 8px) clamp(6px, 1.2vw, 16px)',
                    minWidth: 'fit-content',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Full text - Responsive font size based on viewport */}
                  <span 
                    className="text-[#003580] whitespace-nowrap"
                    style={{ 
                      fontFamily: "'Poppins', 'Segoe UI', sans-serif",
                      fontWeight: 900,
                      fontSize: 'clamp(7px, 1.2vw + 2px, 24px)',
                      letterSpacing: 'clamp(-0.2em, -0.15vw, -0.05em)',
                      lineHeight: '1',
                      whiteSpace: 'nowrap',
                      wordBreak: 'keep-all',
                      overflowWrap: 'normal',
                      display: 'inline-block',
                      textTransform: 'uppercase',
                      width: '100%',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    HOSTEL MASR
                  </span>
                </div>
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#febb02] to-[#ff9500] rounded-lg sm:rounded-xl blur-lg opacity-40 -z-10"></div>
              </motion.div>
              
              {/* System Name & Subtitle - Hidden on ALL screens < xl (1280px) */}
              <div className="hidden xl:flex flex-col flex-shrink-0">
                <span 
                  className="text-white text-base font-bold leading-tight whitespace-nowrap"
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                >
                  HOSTEL MASR
                </span>
                <span className="text-blue-200 text-xs font-medium whitespace-nowrap">
                  Room-Based Property Management
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Show ONLY on xl screens (1280px+) */}
            <nav className="hidden xl:flex items-center gap-1 flex-shrink-0">
              {uniqueNavItems.map((item, index) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={`nav-${item.path}-${index}`}
                    to={item.path}
                    className="relative group"
                  >
                    <motion.div
                      className={`flex items-center gap-2 px-3 2xl:px-4 py-2.5 2xl:py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? 'bg-white text-[#003580] shadow-lg shadow-white/20'
                          : 'text-white/90 hover:bg-white/15 hover:text-white'
                      }`}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className={`transition-transform duration-200 flex-shrink-0 ${isActive ? 'text-[#003580]' : ''}`}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </motion.div>
                    
                    {/* Active Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId={`activeTab-${item.path}`}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-[#febb02] rounded-full"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Hamburger Menu Button - Show on screens < 1280px (CRITICAL FIX) */}
            <motion.button 
              className="xl:hidden p-2 sm:p-3 text-white hover:bg-white/15 rounded-lg sm:rounded-xl transition-colors flex-shrink-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet/Laptop Menu - Show on screens < 1280px */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="xl:hidden bg-gradient-to-b from-[#002050] to-[#001a40] border-t border-white/10 overflow-hidden"
          >
            <div className="container mx-auto px-4 py-3">
              {uniqueNavItems.map((item, index) => {
                const isActive = location.pathname === item.path
                return (
                  <motion.div
                    key={`mobile-nav-${item.path}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-4 px-5 py-4 rounded-xl mb-2 transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-l from-[#febb02] to-[#ffcc33] text-[#003580] shadow-lg shadow-yellow-500/20'
                          : 'text-white/90 hover:bg-white/10 active:bg-white/15'
                      }`}
                    >
                      <span className={`p-2 rounded-lg ${isActive ? 'bg-[#003580]/20' : 'bg-white/10'}`}>
                        {item.icon}
                      </span>
                      <span className="font-bold">{item.label}</span>
                      {isActive && (
                        <svg className="w-5 h-5 mr-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

export default Header
