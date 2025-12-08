import { useState, useEffect, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ToastContext = createContext()

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
    
    return id
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const success = (message, duration) => addToast(message, 'success', duration)
  const error = (message, duration) => addToast(message, 'error', duration)
  const warning = (message, duration) => addToast(message, 'warning', duration)
  const info = (message, duration) => addToast(message, 'info', duration)

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

const Toast = ({ toast, onClose }) => {
  const icons = {
    success: (
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    error: (
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    warning: (
      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    ),
    info: (
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    )
  }

  const bgColors = {
    success: 'bg-white border-green-200',
    error: 'bg-white border-red-200',
    warning: 'bg-white border-yellow-200',
    info: 'bg-white border-blue-200'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`pointer-events-auto min-w-[320px] max-w-md ${bgColors[toast.type]} border-2 rounded-2xl shadow-2xl p-4 flex items-center gap-4`}
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
    >
      {icons[toast.type]}
      <p className="flex-1 text-gray-800 font-medium text-base leading-relaxed">{toast.message}</p>
      <button 
        onClick={onClose}
        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
      >
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  )
}

// Confirm Dialog Component - Professional Design
export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'تأكيد', cancelText = 'إلغاء', type = 'danger', icon: customIcon, showCloseButton = true }) => {
  if (!isOpen) return null

  const colors = {
    danger: {
      iconBg: 'bg-gradient-to-br from-red-50 to-red-100',
      iconColor: 'text-red-600',
      borderColor: 'border-red-200',
      button: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/30',
      titleColor: 'text-red-700'
    },
    warning: {
      iconBg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
      iconColor: 'text-yellow-600',
      borderColor: 'border-yellow-200',
      button: 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 shadow-lg shadow-yellow-500/30',
      titleColor: 'text-yellow-700'
    },
    info: {
      iconBg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      button: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30',
      titleColor: 'text-blue-700'
    },
    success: {
      iconBg: 'bg-gradient-to-br from-green-50 to-green-100',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
      button: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg shadow-green-500/30',
      titleColor: 'text-green-700'
    }
  }

  const colorScheme = colors[type] || colors.danger

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-gray-100"
            onClick={e => e.stopPropagation()}
            style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
          >
            {/* Header with gradient */}
            <div className={`bg-gradient-to-r ${type === 'danger' ? 'from-red-500 to-red-600' : type === 'warning' ? 'from-yellow-500 to-yellow-600' : type === 'info' ? 'from-blue-500 to-blue-600' : 'from-green-500 to-green-600'} px-6 py-5 flex items-center justify-between`}>
              <h3 className="text-xl font-bold text-white">{title}</h3>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Icon */}
              <div className={`w-20 h-20 ${colorScheme.iconBg} ${colorScheme.borderColor} border-2 rounded-2xl flex items-center justify-center mx-auto mb-6 relative`}>
                {customIcon || (
                  <>
                    {type === 'danger' && (
                      <svg className={`w-10 h-10 ${colorScheme.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {type === 'warning' && (
                      <svg className={`w-10 h-10 ${colorScheme.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {type === 'info' && (
                      <svg className={`w-10 h-10 ${colorScheme.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {type === 'success' && (
                      <svg className={`w-10 h-10 ${colorScheme.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </>
                )}
              </div>
              
              {/* Message */}
              <p className="text-center text-gray-700 mb-8 leading-relaxed text-base font-medium">
                {message}
              </p>
              
              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm()
                    onClose()
                  }}
                  className={`flex-1 px-6 py-3.5 ${colorScheme.button} rounded-xl font-bold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Toast

