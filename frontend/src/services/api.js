import axios from 'axios'

// Get API URL - use current window location's origin + /api
const getBaseUrl = () => {
  // In electron/browser, use the same origin as the app
  if (typeof window !== 'undefined' && window.location) {
    // If we're on a localhost or electron (file://), use local backend
    if (window.location.protocol === 'file:' || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:5000/api'
    }
    // Otherwise (production/Firebase Hosting), use same origin
    return window.location.origin + '/api'
  }
  return 'http://127.0.0.1:5000/api'
}
const API_URL = import.meta.env.VITE_API_URL || getBaseUrl()

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout for better connection handling
})

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Response Error:', error.message)
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - Backend may not be running')
    } else if (error.response) {
      console.error('Error response:', error.response.status, error.response.data)
    } else if (error.request) {
      console.error('No response received - Backend may not be running')
    }
    return Promise.reject(error)
  }
)

// Partners API
export const partnersAPI = {
  getAll: () => api.get('/partners'),
  getById: (id) => api.get(`/partners/${id}`),
  create: (data) => api.post('/partners', data),
  update: (id, data) => api.put(`/partners/${id}`, data),
  delete: (id) => api.delete(`/partners/${id}`),
}

// Owners API (Backward compatibility - redirects to partners)
export const ownersAPI = {
  getAll: () => api.get('/owners'),
  getById: (id) => api.get(`/owners/${id}`),
  create: (data) => api.post('/owners', data),
  update: (id, data) => api.put(`/owners/${id}`, data),
  delete: (id) => api.delete(`/owners/${id}`),
}

// Apartments API
export const apartmentsAPI = {
  getAll: (params) => api.get('/apartments', { params }),
  getById: (id) => api.get(`/apartments/${id}`),
  create: (formData) => api.post('/apartments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/apartments/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/apartments/${id}`),
}

// Rooms API
export const roomsAPI = {
  getAll: (apartmentId) => api.get(`/apartments/${apartmentId}/rooms`),
  getById: (apartmentId, roomId) => api.get(`/apartments/${apartmentId}/rooms/${roomId}`),
  create: (apartmentId, data) => api.post(`/apartments/${apartmentId}/rooms`, data),
  update: (apartmentId, roomId, data) => api.put(`/apartments/${apartmentId}/rooms/${roomId}`, data),
  delete: (apartmentId, roomId) => api.delete(`/apartments/${apartmentId}/rooms/${roomId}`),
}

// Bookings API
export const bookingsAPI = {
  getAll: (params) => api.get('/bookings', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post('/bookings', data),
  update: (id, data) => api.put(`/bookings/${id}`, data),
  delete: (id) => api.delete(`/bookings/${id}`),
  extend: (id, data) => api.post(`/bookings/${id}/extend`, data),
  checkAvailability: (roomId, apartmentId, checkIn, checkOut) => {
    // This will be handled in the create/update endpoints
    return api.post('/bookings/check-availability', { roomId, apartmentId, checkIn, checkOut });
  },
}

// Settings API
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  getAmenities: () => api.get('/settings/amenities/list'),
  addAmenity: (name) => api.post('/settings/amenities/add', { name }),
  deleteAmenity: (name) => api.delete(`/settings/amenities/${name}`),
}

// Financial API
export const financialAPI = {
  getOwnerSummary: (id, params) => api.get(`/financial/owner/${id}`, { params }),
  getCompanySummary: (params) => api.get('/financial/company', { params }),
  getBookingFinancial: (id) => api.get(`/financial/booking/${id}`),
}

// Currency API
export const currencyAPI = {
  getRates: () => api.get('/currency/rates'),
  getRate: (currency, date) => api.get(`/currency/rate/${currency}`, { params: { date } }),
  updateRate: (currency, data) => api.put(`/currency/rates/${currency}`, data),
  createRate: (data) => api.post('/currency/rates', data),
  deleteRate: (currency) => api.delete(`/currency/rates/${currency}`),
  refreshFromInternet: () => api.get('/currency/refresh'),
}

// Dashboard API
export const dashboardAPI = {
  getSummary: (params) => api.get('/dashboard/summary', { params }),
}

// Monthly API
export const monthlyAPI = {
  getSummary: (params) => api.get('/monthly/summary', { params }),
  getApartmentSummary: (id, params) => api.get(`/monthly/apartment/${id}`, { params }),
}

// Development Fund API
export const fundAPI = {
  getBalance: () => api.get('/fund/balance'),
  getTransactions: () => api.get('/fund/transactions'),
  withdraw: (data) => api.post('/fund/withdraw', data),
  deposit: (data) => api.post('/fund/deposit', data),
}

// Inventory API
export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (id) => api.get(`/inventory/${id}`),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
}

// ROI API
export const roiAPI = {
  getByApartment: (apartmentId) => api.get(`/roi/${apartmentId}`),
}

export default api



