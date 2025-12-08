import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { bookingsAPI, apartmentsAPI, roomsAPI, currencyAPI } from '../services/api'
import { useToast, ConfirmDialog } from '../components/Toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const Bookings = () => {
  const [bookings, setBookings] = useState([])
  const [apartments, setApartments] = useState([])
  const [rooms, setRooms] = useState([])
  const [selectedApartmentId, setSelectedApartmentId] = useState('')
  const [transferOriginRooms, setTransferOriginRooms] = useState([]) // Rooms for transfer origin apartment
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  const [conflictWarning, setConflictWarning] = useState(null)
  const toast = useToast()
  const [exchangeRates, setExchangeRates] = useState({ USD: 50, EUR: 54, GBP: 63 })
  
  const initialFormData = {
    bookingId: '',
    customReference: '',
    apartment: '',
    roomId: '',
    bookingType: 'individual', // نوع الحجز: individual, group, etc.
    guestName: '',
    guestNationality: '',
    guestPhone: '',
    guestEmail: '',
    guestOrigin: '', // Optional: kept for backward compatibility
    guestDestination: '', // Optional: kept for backward compatibility
    isTransferEnabled: false, // Toggle for transfer booking
    originApartmentId: '',
    originRoomId: '',
    transferFromBookingId: '',
    checkIn: '',
    checkOut: '',
    numberOfNights: 0,
    totalBookingPrice: 0,
    totalBookingPriceCurrency: 'USD', // Currency for total booking price
    paidAmount: 0,
    singlePaymentAmount: 0, // For single payment mode
    singlePaymentCurrency: 'USD', // Currency for single payment
    singlePaymentMethod: 'cash', // Method for single payment
    isSplitPayment: false, // Toggle between single and split payment modes
    remainingAmount: 0,
    payments: [], // Array of payments: [{ amount, currency, method }]
    hostelShare: 0,
    platformCommission: 0,
    paymentMethod: 'cash', // Keep for backward compatibility
    source: 'External',
    currency: 'USD',
    exchangeRate: 50,
    notes: '',
    status: 'confirmed',
    // Development Fund fields
    devDeductionType: 'none', // 'none', 'fixed', 'percent'
    devDeductionValue: 0,
  }
  
  const [formData, setFormData] = useState(initialFormData)

  // Calculate total paid amount from payments array
  const calculatePaidAmount = (payments) => {
    if (!payments || payments.length === 0) return 0
    return payments.reduce((sum, payment) => {
      if (!payment || !payment.amount) return sum
      const rate = exchangeRates[payment.currency] || formData.exchangeRate || 50
      // Convert to USD for consistency
      if (payment.currency === 'USD') return sum + (payment.amount || 0)
      return sum + ((payment.amount || 0) / rate)
    }, 0)
  }

  useEffect(() => {
    fetchData()
    fetchExchangeRates()
  }, [])

  // Fix 1: Auto-fetch rooms when apartment changes
  useEffect(() => {
    if (formData.apartment) {
      fetchRooms(formData.apartment)
      setSelectedApartmentId(formData.apartment)
    } else {
      setRooms([])
      setSelectedApartmentId('')
    }
  }, [formData.apartment])

  // Auto-fetch rooms for transfer origin apartment
  useEffect(() => {
    if (formData.originApartmentId && formData.isTransferEnabled) {
      const originApartment = apartments.find(a => a._id === formData.originApartmentId)
      if (originApartment && originApartment.rooms && Array.isArray(originApartment.rooms)) {
        setTransferOriginRooms(originApartment.rooms)
      } else {
        setTransferOriginRooms([])
      }
    } else {
      setTransferOriginRooms([])
    }
  }, [formData.originApartmentId, formData.isTransferEnabled, apartments])

  // Auto-find booking when origin apartment and room are selected
  useEffect(() => {
    if (formData.isTransferEnabled && formData.originApartmentId && formData.originRoomId && formData.guestName) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const matchingBooking = bookings.find(b => 
        b.apartment === formData.originApartmentId &&
        b.roomId === formData.originRoomId &&
        b.guestName.trim().toLowerCase() === formData.guestName.trim().toLowerCase() &&
        (b.status === 'confirmed' || b.status === 'completed') &&
        new Date(b.checkOut).setHours(0, 0, 0, 0) >= today.getTime()
      )
      
      if (matchingBooking && matchingBooking._id !== formData.transferFromBookingId) {
        setFormData(prev => ({
          ...prev,
          transferFromBookingId: matchingBooking._id,
          guestOrigin: `Transfer from: ${matchingBooking.guestName} - Apt ${apartments.find(a => a._id === matchingBooking.apartment)?.name || ''} ➔ Room ${matchingBooking.roomId?.substring(0, 8)}`
        }))
      }
    }
  }, [formData.originApartmentId, formData.originRoomId, formData.guestName, formData.isTransferEnabled, bookings, apartments])

  // تحديث سعر الصرف تلقائياً عند تحديث exchangeRates (إذا كان البوب أب مفتوح)
  useEffect(() => {
    if (showModal && formData.currency && exchangeRates[formData.currency] && Object.keys(exchangeRates).length > 0) {
      const newRate = exchangeRates[formData.currency]
      // تحديث فقط إذا كان السعر مختلف
      if (formData.exchangeRate !== newRate) {
        setFormData(prev => ({
          ...prev,
          exchangeRate: newRate
        }))
      }
    }
  }, [exchangeRates, showModal])

  const fetchExchangeRates = async () => {
    try {
      const response = await currencyAPI.getRates()
      if (response.data && response.data.length > 0) {
        const rates = {}
        response.data.forEach(rate => {
          rates[rate.currency] = rate.rateToEGP
        })
        setExchangeRates(rates)
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
    }
  }

  const fetchData = async () => {
    const [bookingsRes, apartmentsRes] = await Promise.all([
      bookingsAPI.getAll().catch(() => ({ data: [] })),
      apartmentsAPI.getAll().catch(() => ({ data: [] })),
    ])
    setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : [])
    setApartments(Array.isArray(apartmentsRes.data) ? apartmentsRes.data : [])
  }

  const fetchRooms = async (apartmentId) => {
    if (!apartmentId) {
      setRooms([])
      return
    }
    try {
      // First try to get rooms from the apartment data (already loaded)
      const apartment = apartments.find(a => a._id === apartmentId)
      if (apartment && apartment.rooms && Array.isArray(apartment.rooms) && apartment.rooms.length > 0) {
        setRooms(apartment.rooms)
        return
      }
      
      // Fallback: fetch from API
      const response = await roomsAPI.getAll(apartmentId)
      const roomsData = Array.isArray(response.data) ? response.data : []
      
      if (roomsData.length > 0) {
        setRooms(roomsData)
      } else {
        // If API returns empty, check apartment data again
        setRooms(apartment?.rooms || [])
      }
    } catch (error) {
      console.error('Error fetching rooms:', error)
      // Fallback to apartment data if API fails
      const apartment = apartments.find(a => a._id === apartmentId)
      setRooms(apartment?.rooms || [])
    }
  }

  const checkRoomConflict = async (roomId, apartmentId, checkIn, checkOut, excludeBookingId = null) => {
    if (!roomId || !checkIn || !checkOut) return null
    
    try {
      // Check existing bookings for conflicts
      const allBookings = bookings.filter(b => {
        if (excludeBookingId && b._id === excludeBookingId) return false
        if (b.status === 'cancelled' || b.status === 'ended-early') return false
        if (b.roomId !== roomId) return false
        return true
      })
      
      const checkInDate = new Date(checkIn)
      const checkOutDate = new Date(checkOut)
      
      const conflict = allBookings.find(b => {
        const bCheckIn = new Date(b.checkIn)
        const bCheckOut = new Date(b.checkOut)
        return (checkInDate < bCheckOut && checkOutDate > bCheckIn)
      })
      
      if (conflict) {
        return {
          hasConflict: true,
          conflictingBooking: conflict
        }
      }
      
      return { hasConflict: false }
    } catch (error) {
      console.error('Error checking conflict:', error)
      return null
    }
  }

  const calculateNights = (checkIn, checkOut) => {
    if (checkIn && checkOut) {
      const start = new Date(checkIn)
      const end = new Date(checkOut)
      return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
    }
    return 0
  }

  const calculateTotalEGP = () => (formData.totalAmountUSD || 0) * (formData.exchangeRate || 1)
  const calculateRemainingAmount = () => {
    const total = formData.totalBookingPrice || formData.totalAmountUSD || 0
    const paid = formData.payments && formData.payments.length > 0 
      ? calculatePaidAmount(formData.payments)
      : (formData.paidAmount || 0)
    return Math.max(0, total - paid)
  }

  // Calculate Development Deduction
  const calculateDevelopmentDeduction = () => {
    const total = formData.totalBookingPrice || 0
    const deductionType = formData.devDeductionType || 'none'
    const deductionValue = parseFloat(formData.devDeductionValue) || 0
    
    if (deductionType === 'percent' && deductionValue > 0) {
      return (total * deductionValue) / 100
    } else if (deductionType === 'fixed' && deductionValue > 0) {
      // Convert fixed EGP amount to USD
      const exchangeRate = formData.exchangeRate || 50
      return deductionValue / exchangeRate
    }
    return 0
  }

  // Calculate Estimated Net Profit (Distributable Amount - Partner Shares)
  const calculateEstimatedNetProfit = () => {
    const total = formData.totalBookingPrice || 0
    const platformCommission = formData.platformCommission || 0
    const developmentDeduction = calculateDevelopmentDeduction()
    
    // Final Distributable Amount = Total - Platform Commission - Development Deduction
    const finalDistributableAmount = total - platformCommission - developmentDeduction
    
    // Get apartment to calculate partner shares
    const apartment = apartments.find(a => a._id === formData.apartment)
    let ownerAmount = 0
    
    if (apartment && apartment.partners && apartment.partners.length > 0) {
      const totalPartnerPercentage = apartment.partners.reduce((sum, p) => sum + (p.percentage || 0), 0)
      ownerAmount = (finalDistributableAmount * totalPartnerPercentage) / 100
    }
    
    // Broker Profit = Distributable Amount - Owner Share
    const estimatedNetProfit = Math.max(0, finalDistributableAmount - ownerAmount)
    
    return {
      total,
      platformCommission,
      developmentDeduction,
      finalDistributableAmount,
      ownerAmount,
      estimatedNetProfit
    }
  }

  // Handle apartment selection and load rooms
  const handleApartmentSelect = async (apartmentId) => {
    setSelectedApartmentId(apartmentId)
    setFormData({ ...formData, apartment: apartmentId, roomId: '' })
    await fetchRooms(apartmentId)
  }

  // Handle date changes and check for conflicts
  const handleDateChange = async (field, value) => {
    const newFormData = { ...formData, [field]: value }
    const nights = calculateNights(
      field === 'checkIn' ? value : formData.checkIn,
      field === 'checkOut' ? value : formData.checkOut
    )
    newFormData.numberOfNights = nights
    
    setFormData(newFormData)
    
    // Check for conflicts if room is selected
    if (newFormData.roomId && newFormData.checkIn && newFormData.checkOut) {
      const conflict = await checkRoomConflict(
        newFormData.roomId,
        newFormData.apartment,
        newFormData.checkIn,
        newFormData.checkOut,
        editMode ? selectedBooking?._id : null
      )
      
      if (conflict?.hasConflict) {
        setConflictWarning(conflict.conflictingBooking)
      } else {
        setConflictWarning(null)
      }
    }
  }

  // Handle source change - set platform commission to 0 if External
  const handleSourceChange = (source) => {
    const newFormData = { ...formData, source }
    if (source === 'External') {
      newFormData.platformCommission = 0
    }
    setFormData(newFormData)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.apartment || !formData.roomId || !formData.guestName || !formData.checkIn || !formData.checkOut) {
      toast.warning('يرجى إكمال جميع الحقول المطلوبة')
      return
    }
    
    // Check for conflicts before submitting
    if (conflictWarning) {
      toast.error('يوجد تعارض في الحجز! الغرفة محجوزة في هذه التواريخ')
      return
    }
    
    try {
      // Calculate paidAmount based on payment mode
      let calculatedPaidAmount = 0
      let paymentsArray = []
      let paymentMethod = 'cash'
      
      if (formData.isSplitPayment && formData.payments && formData.payments.length > 0) {
        // Split payment mode
        calculatedPaidAmount = calculatePaidAmount(formData.payments)
        paymentsArray = formData.payments
        paymentMethod = formData.payments[0]?.method || 'cash'
      } else if (formData.singlePaymentAmount > 0) {
        // Single payment mode
        calculatedPaidAmount = formData.singlePaymentCurrency === 'USD'
          ? formData.singlePaymentAmount
          : formData.singlePaymentAmount / (exchangeRates[formData.singlePaymentCurrency] || formData.exchangeRate || 50)
        paymentsArray = [{
          amount: formData.singlePaymentAmount,
          currency: formData.singlePaymentCurrency,
          method: formData.singlePaymentMethod
        }]
        paymentMethod = formData.singlePaymentMethod
      } else {
        // Fallback to legacy fields
        calculatedPaidAmount = formData.paidAmount || 0
        paymentMethod = formData.paymentMethod || 'cash'
      }
      
      // Calculate remaining amount
      const totalInUSD = formData.totalBookingPriceCurrency === 'USD'
        ? formData.totalBookingPrice
        : formData.totalBookingPrice / (exchangeRates[formData.totalBookingPriceCurrency] || formData.exchangeRate || 50)
      const remaining = formData.remainingAmount || (totalInUSD - calculatedPaidAmount)
      
      // Handle transfer booking data
      const transferData = formData.isTransferEnabled && formData.transferFromBookingId
        ? {
            originApartmentId: formData.originApartmentId,
            originRoomId: formData.originRoomId,
            transferFromBookingId: formData.transferFromBookingId,
            originType: 'internal_transfer' // Keep for backward compatibility with backend
          }
        : {
            originApartmentId: '',
            originRoomId: '',
            transferFromBookingId: '',
            originType: 'external' // Keep for backward compatibility with backend
          }

      const bookingData = {
        ...formData,
        ...transferData,
        numberOfNights: calculateNights(formData.checkIn, formData.checkOut),
        totalBookingPrice: totalInUSD,
        paidAmount: calculatedPaidAmount,
        remainingAmount: remaining,
        payments: paymentsArray.length > 0 ? paymentsArray : formData.payments || [],
        paymentMethod: paymentMethod, // Keep for backward compatibility
        currency: formData.totalBookingPriceCurrency || formData.currency || 'USD',
        exchangeRate: exchangeRates[formData.totalBookingPriceCurrency] || formData.exchangeRate || 50,
        // Development Fund fields
        devDeductionType: formData.devDeductionType || 'none',
        devDeductionValue: parseFloat(formData.devDeductionValue) || 0,
      }
      
      if (editMode && selectedBooking) {
        await bookingsAPI.update(selectedBooking._id, bookingData)
        toast.success('تم تحديث الحجز بنجاح!')
      } else {
        await bookingsAPI.create(bookingData)
        toast.success('تم إضافة الحجز بنجاح!')
      }
      
      setShowModal(false)
      setEditMode(false)
      setSelectedBooking(null)
      setFormData(initialFormData)
      setConflictWarning(null)
      setSelectedApartmentId('')
      setRooms([])
      fetchData()
    } catch (error) {
      console.error('Error saving booking:', error)
      if (error.response?.status === 409) {
        toast.error(error.response.data?.error || 'تعارض في الحجز! الغرفة محجوزة في هذه التواريخ')
        if (error.response.data?.conflictingBooking) {
          setConflictWarning(error.response.data.conflictingBooking)
        }
      } else {
        toast.error('حدث خطأ أثناء حفظ الحجز')
      }
    }
  }

  const handleExtendBooking = async (extensionDays, extensionAmount) => {
    if (!extensionDays || extensionDays <= 0) {
      toast.warning('عدد الأيام الإضافية يجب أن يكون أكبر من صفر')
      return
    }
    
    if (!extensionAmount || extensionAmount <= 0) {
      toast.warning('مبلغ التمديد يجب أن يكون أكبر من صفر')
      return
    }
    
    try {
      await bookingsAPI.extend(selectedBooking._id, {
        extensionDays: parseInt(extensionDays),
        extensionAmount: parseFloat(extensionAmount)
      })
      toast.success('تم تمديد الحجز بنجاح!')
      setShowExtendModal(false)
      setSelectedBooking(null)
      fetchData()
    } catch (error) {
      console.error('Error extending booking:', error)
      if (error.response?.status === 409) {
        toast.error('تعارض في الحجز! الغرفة محجوزة في فترة التمديد')
      } else {
        toast.error('حدث خطأ أثناء تمديد الحجز')
      }
    }
  }

  const handleEditBooking = async (booking) => {
    setSelectedBooking(booking)
    setEditMode(true)
    
    // تحديث أسعار الصرف قبل فتح البوب أب
    await fetchExchangeRates()
    
    // Load rooms for the apartment
    if (booking.apartment) {
      await fetchRooms(booking.apartment)
      setSelectedApartmentId(booking.apartment)
    }
    
    const bookingCurrency = booking.currency || 'USD'
    const currentRate = exchangeRates[bookingCurrency] || booking.exchangeRate || 50
    
    setFormData({
      bookingId: booking.bookingId || '',
      customReference: booking.customReference || '',
      apartment: booking.apartment || '',
      roomId: booking.roomId || '',
      bookingType: booking.bookingType || 'individual',
      guestName: booking.guestName || '',
      guestNationality: booking.guestNationality || '',
      guestPhone: booking.guestPhone || '',
      guestEmail: booking.guestEmail || '',
      guestOrigin: booking.guestOrigin || '',
      guestDestination: booking.guestDestination || '',
      originType: booking.originType || 'external',
      isTransferEnabled: !!(booking.originApartmentId && booking.originRoomId),
      originApartmentId: booking.originApartmentId || '',
      originRoomId: booking.originRoomId || '',
      transferFromBookingId: booking.transferFromBookingId || '',
      checkIn: booking.checkIn ? booking.checkIn.split('T')[0] : '',
      checkOut: booking.checkOut ? booking.checkOut.split('T')[0] : '',
      numberOfNights: booking.numberOfNights || calculateNights(booking.checkIn, booking.checkOut),
      totalBookingPrice: booking.totalBookingPrice || booking.totalAmountUSD || 0,
      totalBookingPriceCurrency: booking.totalBookingPriceCurrency || booking.currency || 'USD',
      paidAmount: booking.paidAmount || 0,
      payments: booking.payments || (booking.paidAmount && booking.paymentMethod ? [{
        amount: booking.paidAmount,
        currency: booking.currency || 'USD',
        method: booking.paymentMethod
      }] : []),
      isSplitPayment: booking.payments && booking.payments.length > 1,
      singlePaymentAmount: (booking.payments && booking.payments.length === 1) ? booking.payments[0].amount : (booking.paidAmount || 0),
      singlePaymentCurrency: (booking.payments && booking.payments.length === 1) ? booking.payments[0].currency : (booking.currency || 'USD'),
      singlePaymentMethod: (booking.payments && booking.payments.length === 1) ? booking.payments[0].method : (booking.paymentMethod || 'cash'),
      remainingAmount: booking.remainingAmount || ((booking.totalBookingPrice || booking.totalAmountUSD || 0) - (booking.paidAmount || 0)),
      hostelShare: booking.hostelShare || 0,
      platformCommission: booking.platformCommission || 0,
      paymentMethod: booking.paymentMethod || 'cash',
      source: booking.source || 'External',
      currency: bookingCurrency,
      exchangeRate: currentRate,
      notes: booking.notes || '',
      status: booking.status || 'confirmed',
      // Development Fund fields
      devDeductionType: booking.devDeductionType || 'none',
      devDeductionValue: booking.devDeductionValue || 0,
    })
    setShowModal(true)
  }

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking)
    setShowDetailsModal(true)
  }

  const handleEndBooking = (booking) => {
    setSelectedBooking(booking)
    setShowEndModal(true)
  }

  const handleConfirmEndBooking = async (refundAmount) => {
    try {
      await bookingsAPI.update(selectedBooking._id, {
        status: 'ended-early',
        refundAmount: refundAmount,
        endedAt: new Date().toISOString(),
      })
      toast.success('تم إنهاء الحجز بنجاح')
      setShowEndModal(false)
      setSelectedBooking(null)
      fetchData()
    } catch (error) {
      toast.error('حدث خطأ أثناء إنهاء الحجز')
    }
  }

  const handleDeleteBooking = async (id) => {
    try {
      await bookingsAPI.delete(id)
      toast.success('تم حذف الحجز بنجاح')
      fetchData()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف الحجز')
    }
  }

  const getStatusInfo = (status) => {
    const statuses = {
      pending: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
      confirmed: { label: 'مؤكد', color: 'bg-green-100 text-green-800', icon: '✅' },
      'checked-in': { label: 'في الشقة', color: 'bg-blue-100 text-blue-800', icon: '🏠' },
      'checked-out': { label: 'غادر', color: 'bg-gray-100 text-gray-800', icon: '👋' },
      cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-800', icon: '❌' },
      'ended-early': { label: 'انتهى مبكراً', color: 'bg-orange-100 text-orange-800', icon: '⚠️' },
      'active': { label: 'نشط الآن', color: 'bg-green-500 text-white', icon: '🏠' },
      'completed': { label: 'مكتمل', color: 'bg-gray-200 text-gray-700', icon: '✓' },
      'upcoming': { label: 'قادم', color: 'bg-blue-100 text-blue-800', icon: '📅' },
    }
    return statuses[status] || statuses.pending
  }

  // حساب الحالة الفعلية بناءً على التواريخ
  const getComputedStatus = (booking) => {
    // إذا كان ملغي أو انتهى مبكراً، لا نغير الحالة
    if (booking.status === 'cancelled' || booking.status === 'ended-early') {
      return booking.status
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const checkInDate = new Date(booking.checkIn)
    checkInDate.setHours(0, 0, 0, 0)
    
    const checkOutDate = new Date(booking.checkOut)
    checkOutDate.setHours(0, 0, 0, 0)
    
    // إذا تاريخ المغادرة فات = مكتمل
    if (checkOutDate < today) {
      return 'completed'
    }
    
    // إذا تاريخ الوصول اليوم أو فات وتاريخ المغادرة لسه = نشط
    if (checkInDate <= today && checkOutDate >= today) {
      return 'active'
    }
    
    // إذا تاريخ الوصول لسه مجاش = قادم
    if (checkInDate > today) {
      return 'upcoming'
    }
    
    return booking.status
  }

  // Generate PDF for booking details (internal use - with all details) - HTML Version
  const generateBookingDetailsPDF = async () => {
    if (!selectedBooking) return
    
    try {
      // Create invoice HTML element
      const invoiceDiv = document.createElement('div')
      invoiceDiv.style.position = 'absolute'
      invoiceDiv.style.left = '-9999px'
      invoiceDiv.style.width = '210mm' // A4 width
      invoiceDiv.style.padding = '20mm'
      invoiceDiv.style.backgroundColor = '#ffffff'
      invoiceDiv.style.fontFamily = "'Cairo', 'Arial', sans-serif"
      invoiceDiv.style.direction = 'rtl'
      
      const apartment = apartments.find(a => a._id === selectedBooking.apartment)
      const room = apartment?.rooms?.find(r => r.roomId === selectedBooking.roomId)
      const numberOfNights = selectedBooking.numberOfNights || calculateNights(selectedBooking.checkIn, selectedBooking.checkOut)
      const currency = selectedBooking.currency || 'USD'
      const totalPrice = selectedBooking.totalBookingPrice || selectedBooking.totalAmountUSD || 0
      const paidAmount = selectedBooking.paidAmount || 0
      const remainingAmount = selectedBooking.remainingAmount || 0
      const hostelShare = selectedBooking.hostelShare || 0
      const platformCommission = selectedBooking.platformCommission || 0
      const payments = selectedBooking.payments || []
      
      const checkInDate = new Date(selectedBooking.checkIn).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      const checkOutDate = new Date(selectedBooking.checkOut).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      const reportDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      
      const bookingTypeMap = {
        'individual': { en: 'Individual', ar: 'فردي' },
        'group': { en: 'Group', ar: 'جماعي' },
        'family': { en: 'Family', ar: 'عائلي' },
        'business': { en: 'Business', ar: 'عمل' }
      }
      const bookingType = bookingTypeMap[selectedBooking.bookingType] || { en: selectedBooking.bookingType || '-', ar: '-' }
      
      const paymentMethods = {
        'cash': { en: 'Cash', ar: 'نقدي' },
        'visa': { en: 'Credit Card (Visa)', ar: 'بطاقة ائتمان (فيزا)' },
        'instapay': { en: 'InstaPay', ar: 'انستاباي' },
        'vodafone': { en: 'Vodafone Cash', ar: 'فودافون كاش' }
      }
      const paymentMethod = paymentMethods[selectedBooking.paymentMethod] || { en: selectedBooking.paymentMethod || '-', ar: '-' }
      
      // Build partners HTML
      let partnersHTML = ''
      if (selectedBooking.apartmentData?.partners && selectedBooking.apartmentData.partners.length > 0) {
        partnersHTML = `
          <div style="background: #f5f3ff; padding: 20px; margin: 20px 0; border-radius: 8px; border-right: 4px solid #8b5cf6;">
            <h3 style="color: #6d28d9; font-size: 16px; font-weight: 700; margin-bottom: 15px;">🤝 الشركاء ونسبهم / Partners & Shares</h3>
            <div style="display: grid; gap: 10px;">
              ${selectedBooking.apartmentData.partners.map((partner) => {
                const partnerShare = ((hostelShare) * (partner.percentage || 0)) / 100
                return `
                  <div style="background: white; padding: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e9d5ff;">
                    <div>
                      <span style="font-weight: 700; font-size: 14px; color: #1a1a1a;">${partner.name}</span>
                      ${partner.phone ? `<span style="font-size: 11px; color: #666; margin-right: 10px;">📞 ${partner.phone}</span>` : ''}
                      <span style="font-size: 12px; color: #8b5cf6; font-weight: 600;">(${partner.percentage}%)</span>
                    </div>
                    <span style="font-weight: 700; font-size: 14px; color: #8b5cf6;">${partnerShare.toFixed(2)} ${currency}</span>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        `
      }
      
      invoiceDiv.innerHTML = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
        </style>
        <div style="background: linear-gradient(135deg, #003580 0%, #004a99 100%); color: white; padding: 30px 40px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 10px; letter-spacing: 2px;">HOSTEL MASR</h1>
          <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 5px;">تفاصيل الحجز الكاملة / Complete Booking Details</h2>
          <p style="font-size: 14px; opacity: 0.9;">Internal Business Report / تقرير عمل داخلي</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #e0e0e0;">
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
            <div>
              <p style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: 600;">Booking ID / رقم الحجز:</p>
              <p style="font-size: 14px; font-weight: 700; color: #003580;">${selectedBooking.bookingId || selectedBooking._id || 'N/A'}</p>
            </div>
            <div>
              <p style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: 600;">Reference / الترقيم الخاص:</p>
              <p style="font-size: 14px; font-weight: 700; color: #003580;">${selectedBooking.customReference || '-'}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: 600;">Report Date / تاريخ التقرير:</p>
              <p style="font-size: 14px; font-weight: 700; color: #003580;">${reportDate}</p>
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
          <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; border-right: 4px solid #003580;">
            <h3 style="background: #003580; color: white; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 8px 8px 0 0; font-size: 14px; font-weight: 700;">
              معلومات الحجز / Booking Information
            </h3>
            <p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Guest Name / اسم المقيم:</strong> ${selectedBooking.guestName || '-'}</p>
            <p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Nationality / الجنسية:</strong> ${selectedBooking.guestNationality || '-'}</p>
            <p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Phone / الهاتف:</strong> ${selectedBooking.guestPhone || '-'}</p>
            <p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Email / البريد:</strong> ${selectedBooking.guestEmail || '-'}</p>
            <p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Booking Type / نوع الحجز:</strong> ${bookingType.en} / ${bookingType.ar}</p>
          </div>
          
          <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; border-right: 4px solid #003580;">
            <h3 style="background: #003580; color: white; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 8px 8px 0 0; font-size: 14px; font-weight: 700;">
              معلومات الإقامة / Accommodation Details
            </h3>
            ${apartment?.name ? `<p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Apartment / الشقة:</strong> ${apartment.name}</p>` : ''}
            ${room?.roomNumber ? `<p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Room / الغرفة:</strong> Room ${room.roomNumber}</p>` : ''}
            ${room?.type ? `<p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Room Type / نوع الغرفة:</strong> ${room.type}</p>` : ''}
            <p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Check-in / الوصول:</strong> ${checkInDate}</p>
            <p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Check-out / المغادرة:</strong> ${checkOutDate}</p>
            <p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Nights / الليالي:</strong> ${numberOfNights}</p>
            ${selectedBooking.originApartmentId && selectedBooking.originRoomId ? `
              <div style="background: #e8f4f8; padding: 12px; border-radius: 6px; margin: 8px 0; border-right: 3px solid #0071c2;">
                <p style="font-size: 12px; color: #555; margin: 4px 0; font-weight: 700;">نقل الحجز / Transfer Booking:</p>
                <p style="font-size: 11px; color: #333; margin: 4px 0;"><strong>من / From:</strong> ${(() => {
                  const apt = apartments.find(a => a._id === selectedBooking.originApartmentId)
                  const room = apt?.rooms?.find(r => r.roomId === selectedBooking.originRoomId)
                  return `شقة ${apt?.name || ''} - غرفة ${room?.roomNumber || selectedBooking.originRoomId?.substring(0, 8)}`
                })()}</p>
                <p style="font-size: 11px; color: #333; margin: 4px 0;"><strong>إلى / To:</strong> ${(() => {
                  const apt = apartments.find(a => a._id === selectedBooking.apartment)
                  const room = apt?.rooms?.find(r => r.roomId === selectedBooking.roomId)
                  return `شقة ${apt?.name || ''} - غرفة ${room?.roomNumber || selectedBooking.roomId?.substring(0, 8)}`
                })()}</p>
              </div>
            ` : ''}
            ${!selectedBooking.originApartmentId && selectedBooking.guestOrigin ? `<p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Origin / قادم من:</strong> ${selectedBooking.guestOrigin}</p>` : ''}
            ${!selectedBooking.originApartmentId && selectedBooking.guestDestination ? `<p style="font-size: 12px; color: #555; margin: 8px 0;"><strong>Destination / إلى:</strong> ${selectedBooking.guestDestination}</p>` : ''}
          </div>
        </div>
        
        <div style="background: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px; border-right: 4px solid #ffc107;">
          <h3 style="color: #856404; font-size: 16px; font-weight: 700; margin-bottom: 15px;">💰 التفاصيل المالية / Financial Details</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <p style="font-size: 12px; color: #555; margin: 6px 0;"><strong>Total Booking Price / إجمالي مبلغ الحجز:</strong> ${totalPrice.toFixed(2)} ${currency}</p>
              <p style="font-size: 12px; color: #555; margin: 6px 0;"><strong>Paid Amount / المدفوع:</strong> <span style="color: #00a000; font-weight: 700;">${paidAmount.toFixed(2)} ${currency}</span></p>
              <p style="font-size: 12px; color: #555; margin: 6px 0;"><strong>Remaining / المتبقي:</strong> <span style="color: #c00; font-weight: 700;">${remainingAmount.toFixed(2)} ${currency}</span></p>
            </div>
            <div>
              <p style="font-size: 12px; color: #555; margin: 6px 0;"><strong>HOSTEL MASR Share / نسبة HOSTEL MASR:</strong> ${hostelShare.toFixed(2)} ${currency}</p>
              <p style="font-size: 12px; color: #555; margin: 6px 0;"><strong>Platform Commission / عمولة المنصة:</strong> ${platformCommission.toFixed(2)} ${currency}</p>
              ${payments.length > 0 ? `
                <p style="font-size: 12px; color: #555; margin: 6px 0;"><strong>Payment Methods / طرق الدفع:</strong></p>
                ${payments.map((p, idx) => `
                  <p style="font-size: 11px; color: #555; margin: 4px 0 4px 20px;">
                    ${idx + 1}. ${paymentMethods[p.method]?.en || p.method} / ${paymentMethods[p.method]?.ar || p.method}: 
                    <span style="font-weight: 700; color: #00a000;">${p.amount?.toFixed(2) || 0} ${p.currency || 'USD'}</span>
                  </p>
                `).join('')}
              ` : `
                <p style="font-size: 12px; color: #555; margin: 6px 0;"><strong>Payment Method / طريقة الدفع:</strong> ${paymentMethod.en} / ${paymentMethod.ar}</p>
              `}
              <p style="font-size: 12px; color: #555; margin: 6px 0;"><strong>Source / المصدر:</strong> ${selectedBooking.source || '-'}</p>
            </div>
          </div>
        </div>
        
        ${partnersHTML}
        
        ${selectedBooking.notes ? `
          <div style="background: #e7f3ff; padding: 20px; margin: 20px 0; border-radius: 8px; border-right: 4px solid #2196F3;">
            <h3 style="color: #0d47a1; font-size: 16px; font-weight: 700; margin-bottom: 10px;">📝 الملاحظات / Notes</h3>
            <p style="font-size: 12px; color: #555; line-height: 1.6; white-space: pre-wrap;">${selectedBooking.notes}</p>
          </div>
        ` : ''}
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center;">
          <p style="font-size: 11px; color: #666; margin: 5px 0;">HOSTEL MASR - Booking Management System</p>
          <p style="font-size: 10px; color: #999; margin-top: 10px;">This is an internal business report. / هذا تقرير عمل داخلي.</p>
        </div>
      `
      
      document.body.appendChild(invoiceDiv)
      
      // Convert to canvas then PDF
      const canvas = await html2canvas(invoiceDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      
      document.body.removeChild(invoiceDiv)
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      
      let position = 0
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      const fileName = `Booking_Details_${selectedBooking.bookingId || selectedBooking._id || 'Booking'}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
      toast.success('تم إنشاء تقرير التفاصيل بنجاح! / Booking details report generated successfully!')
    } catch (error) {
      console.error('Error generating booking details PDF:', error)
      toast.error('حدث خطأ أثناء إنشاء التقرير')
    }
  }
  
  // Keep old function for reference (commented)
  const generateBookingDetailsPDF_OLD = () => {
    if (!selectedBooking) return
    
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPos = 20
    
    // Header
    doc.setFillColor(0, 53, 128)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('HOSTEL MASR', pageWidth / 2, 15, { align: 'center' })
    doc.setFontSize(14)
    doc.text('تفاصيل الحجز الكاملة', pageWidth / 2, 25, { align: 'center' })
    
    // Reset text color
    doc.setTextColor(0, 0, 0)
    yPos = 45
    
    // Booking Info
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('معلومات الحجز', 20, yPos)
    yPos += 10
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const bookingInfo = [
      ['رقم الحجز:', selectedBooking.bookingId || '-'],
      ['الترقيم الخاص:', selectedBooking.customReference || '-'],
      ['اسم المقيم:', selectedBooking.guestName || '-'],
      ['الجنسية:', selectedBooking.guestNationality || '-'],
      ['رقم الموبايل:', selectedBooking.guestPhone || '-'],
      ['البريد الإلكتروني:', selectedBooking.guestEmail || '-'],
      ['نوع الحجز:', selectedBooking.bookingType === 'individual' ? 'فردي' : selectedBooking.bookingType === 'group' ? 'جماعي' : selectedBooking.bookingType === 'family' ? 'عائلي' : selectedBooking.bookingType === 'business' ? 'عمل' : '-'],
    ]
    
    bookingInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label, 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(value || '-', 100, yPos)
      yPos += 7
    })
    
    yPos += 5
    
    // Apartment & Room Info
    const apartment = apartments.find(a => a._id === selectedBooking.apartment)
    const room = apartment?.rooms?.find(r => r.roomId === selectedBooking.roomId)
    
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('معلومات الإقامة', 20, yPos)
    yPos += 10
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const stayInfo = [
      ['اسم الشقة:', apartment?.name || '-'],
      ['رقم الغرفة:', room?.roomNumber || '-'],
      ['نوع الغرفة:', room?.type || '-'],
      ['تاريخ الوصول:', new Date(selectedBooking.checkIn).toLocaleDateString('ar-EG')],
      ['تاريخ المغادرة:', new Date(selectedBooking.checkOut).toLocaleDateString('ar-EG')],
      ['عدد الليالي:', (selectedBooking.numberOfNights || calculateNights(selectedBooking.checkIn, selectedBooking.checkOut)).toString()],
      ...(selectedBooking.originApartmentId && selectedBooking.originRoomId ? [
        ['نقل الحجز من:', (() => {
          const apt = apartments.find(a => a._id === selectedBooking.originApartmentId)
          const room = apt?.rooms?.find(r => r.roomId === selectedBooking.originRoomId)
          return `شقة ${apt?.name || ''} - غرفة ${room?.roomNumber || selectedBooking.originRoomId?.substring(0, 8)}`
        })()],
        ['نقل الحجز إلى:', (() => {
          const apt = apartments.find(a => a._id === selectedBooking.apartment)
          const room = apt?.rooms?.find(r => r.roomId === selectedBooking.roomId)
          return `شقة ${apt?.name || ''} - غرفة ${room?.roomNumber || selectedBooking.roomId?.substring(0, 8)}`
        })()]
      ] : [
        ...(selectedBooking.guestOrigin ? [['قادم من:', selectedBooking.guestOrigin]] : []),
        ...(selectedBooking.guestDestination ? [['إلى:', selectedBooking.guestDestination]] : [])
      ]),
    ]
    
    stayInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label, 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(value || '-', 100, yPos)
      yPos += 7
      
      if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = 20
      }
    })
    
    yPos += 5
    
    // Financial Details
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('التفاصيل المالية', 20, yPos)
    yPos += 10
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const totalPrice = selectedBooking.totalBookingPrice || selectedBooking.totalAmountUSD || 0
    const paidAmount = selectedBooking.paidAmount || 0
    const remainingAmount = selectedBooking.remainingAmount || 0
    const hostelShare = selectedBooking.hostelShare || 0
    const platformCommission = selectedBooking.platformCommission || 0
    const currency = selectedBooking.currency || 'USD'
    
    const financialInfo = [
      [`إجمالي مبلغ الحجز (${currency}):`, totalPrice.toFixed(2)],
      [`إجمالي ما تم دفعه (${currency}):`, paidAmount.toFixed(2)],
      [`المتبقي (${currency}):`, remainingAmount.toFixed(2)],
      [`نسبة HOSTEL MASR (${currency}):`, hostelShare.toFixed(2)],
      [`نسبة المنصة/البرنامج (${currency}):`, platformCommission.toFixed(2)],
      ['طريقة الدفع:', selectedBooking.paymentMethod === 'cash' ? 'نقدي' : selectedBooking.paymentMethod === 'visa' ? 'فيزا' : selectedBooking.paymentMethod === 'instapay' ? 'انستاباي' : selectedBooking.paymentMethod === 'vodafone' ? 'فودافون كاش' : '-'],
      ['المصدر:', selectedBooking.source || '-'],
    ]
    
    financialInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label, 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(value || '-', 100, yPos)
      yPos += 7
      
      if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = 20
      }
    })
    
    // Partners Section
    if (selectedBooking.apartmentData?.partners && selectedBooking.apartmentData.partners.length > 0) {
      yPos += 10
      
      if (yPos > pageHeight - 50) {
        doc.addPage()
        yPos = 20
      }
      
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('الشركاء ونسبهم', 20, yPos)
      yPos += 10
      
      doc.setFontSize(11)
      selectedBooking.apartmentData.partners.forEach((partner) => {
        const partnerShare = ((hostelShare) * (partner.percentage || 0)) / 100
        doc.setFont('helvetica', 'bold')
        doc.text(`${partner.name} (${partner.percentage}%):`, 20, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(`${partnerShare.toFixed(2)} ${currency}`, 100, yPos)
        yPos += 7
        
        if (yPos > pageHeight - 40) {
          doc.addPage()
          yPos = 20
        }
      })
    }
    
    // Notes
    if (selectedBooking.notes) {
      yPos += 10
      
      if (yPos > pageHeight - 50) {
        doc.addPage()
        yPos = 20
      }
      
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('ملاحظات', 20, yPos)
      yPos += 10
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const notesLines = doc.splitTextToSize(selectedBooking.notes, pageWidth - 40)
      notesLines.forEach(line => {
        doc.text(line, 20, yPos)
        yPos += 7
        if (yPos > pageHeight - 40) {
          doc.addPage()
          yPos = 20
        }
      })
    }
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(9)
      doc.setTextColor(128, 128, 128)
      doc.text(`صفحة ${i} من ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
      doc.text(`تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-EG')}`, pageWidth / 2, pageHeight - 5, { align: 'center' })
    }
    
    doc.save(`تفاصيل_الحجز_${selectedBooking.bookingId || selectedBooking._id}.pdf`)
    toast.success('تم إنشاء ملف PDF بنجاح!')
  }
  
  // Generate PDF for customer invoice (clean invoice without internal details) - Bilingual HTML
  const generateCustomerInvoicePDF = async () => {
    if (!selectedBooking) return
    
    try {
      // Create invoice HTML element
      const invoiceDiv = document.createElement('div')
      invoiceDiv.style.position = 'absolute'
      invoiceDiv.style.left = '-9999px'
      invoiceDiv.style.width = '210mm' // A4 width
      invoiceDiv.style.padding = '20mm'
      invoiceDiv.style.backgroundColor = '#ffffff'
      invoiceDiv.style.fontFamily = "'Cairo', 'Arial', sans-serif"
      invoiceDiv.style.direction = 'rtl'
      
      const apartment = apartments.find(a => a._id === selectedBooking.apartment)
      const room = apartment?.rooms?.find(r => r.roomId === selectedBooking.roomId)
      const numberOfNights = selectedBooking.numberOfNights || calculateNights(selectedBooking.checkIn, selectedBooking.checkOut)
      const currency = selectedBooking.currency || 'USD'
      const totalPrice = selectedBooking.totalBookingPrice || selectedBooking.totalAmountUSD || 0
      const paidAmount = selectedBooking.paidAmount || 0
      const remainingAmount = selectedBooking.remainingAmount || 0
      const nightPrice = numberOfNights > 0 ? (totalPrice / numberOfNights).toFixed(2) : totalPrice.toFixed(2)
      
      const checkInDate = new Date(selectedBooking.checkIn).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      const checkOutDate = new Date(selectedBooking.checkOut).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      const invoiceDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      
      const paymentMethods = {
        'cash': { en: 'Cash', ar: 'نقدي' },
        'visa': { en: 'Credit Card (Visa)', ar: 'بطاقة ائتمان (فيزا)' },
        'instapay': { en: 'InstaPay', ar: 'انستاباي' },
        'vodafone': { en: 'Vodafone Cash', ar: 'فودافون كاش' }
      }
      const paymentMethod = paymentMethods[selectedBooking.paymentMethod] || { en: selectedBooking.paymentMethod || '-', ar: selectedBooking.paymentMethod || '-' }
      
      invoiceDiv.innerHTML = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Cairo', 'Arial', sans-serif; }
        </style>
        <div style="background: linear-gradient(135deg, #003580 0%, #004a99 100%); color: white; padding: 30px 40px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 10px; letter-spacing: 2px;">HOSTEL MASR</h1>
          <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 5px;">INVOICE / فاتورة</h2>
          <p style="font-size: 14px; opacity: 0.9;">Accommodation Booking Invoice / فاتورة حجز الإقامة</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #e0e0e0;">
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
            <div>
              <p style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: 600;">Invoice No. / رقم الفاتورة:</p>
              <p style="font-size: 14px; font-weight: 700; color: #003580;">${selectedBooking.bookingId || selectedBooking._id || 'N/A'}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: 600;">Date / التاريخ:</p>
              <p style="font-size: 14px; font-weight: 700; color: #003580;">${invoiceDate}</p>
            </div>
          </div>
          ${selectedBooking.customReference ? `
            <div style="margin-top: 15px;">
              <p style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: 600;">Reference / المرجع:</p>
              <p style="font-size: 14px; font-weight: 700; color: #003580;">${selectedBooking.customReference}</p>
            </div>
          ` : ''}
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
          <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; border-right: 4px solid #003580;">
            <h3 style="background: #003580; color: white; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 8px 8px 0 0; font-size: 14px; font-weight: 700;">
              BILL TO / الفواتير إلى
            </h3>
            <p style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 10px;">${selectedBooking.guestName || 'Guest / ضيف'}</p>
            ${selectedBooking.guestPhone ? `<p style="font-size: 12px; color: #555; margin: 5px 0;"><strong>Phone / الهاتف:</strong> ${selectedBooking.guestPhone}</p>` : ''}
            ${selectedBooking.guestEmail ? `<p style="font-size: 12px; color: #555; margin: 5px 0;"><strong>Email / البريد:</strong> ${selectedBooking.guestEmail}</p>` : ''}
            ${selectedBooking.guestNationality ? `<p style="font-size: 12px; color: #555; margin: 5px 0;"><strong>Nationality / الجنسية:</strong> ${selectedBooking.guestNationality}</p>` : ''}
          </div>
          
          <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; border-right: 4px solid #003580;">
            <h3 style="background: #003580; color: white; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 8px 8px 0 0; font-size: 14px; font-weight: 700;">
              BOOKING DETAILS / تفاصيل الحجز
            </h3>
            ${apartment?.name ? `<p style="font-size: 12px; color: #555; margin: 5px 0;"><strong>Apartment / الشقة:</strong> ${apartment.name}</p>` : ''}
            ${room?.roomNumber ? `<p style="font-size: 12px; color: #555; margin: 5px 0;"><strong>Room / الغرفة:</strong> Room ${room.roomNumber}</p>` : ''}
            <p style="font-size: 12px; color: #555; margin: 5px 0;"><strong>Check-in / الوصول:</strong> ${checkInDate}</p>
            <p style="font-size: 12px; color: #555; margin: 5px 0;"><strong>Check-out / المغادرة:</strong> ${checkOutDate}</p>
            <p style="font-size: 12px; color: #555; margin: 5px 0;"><strong>Nights / الليالي:</strong> ${numberOfNights} ${numberOfNights > 1 ? 'nights' : 'night'}</p>
          </div>
        </div>
        
        <div style="margin: 30px 0;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #003580; color: white;">
                <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 700;">DESCRIPTION / الوصف</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 700;">QTY / الكمية</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 700;">RATE / السعر</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700;">AMOUNT / المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #fafafa;">
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; font-size: 12px;">
                  Accommodation / الإقامة (${numberOfNights} ${numberOfNights > 1 ? 'nights' : 'night'})
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 12px;">${numberOfNights}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 12px;">${nightPrice} ${currency}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: left; font-size: 12px; font-weight: 700;">${totalPrice.toFixed(2)} ${currency}</td>
              </tr>
            </tbody>
          </table>
          
          <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
            <div style="background: #f5f7fa; padding: 20px; border-radius: 8px; border: 2px solid #003580; min-width: 250px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #003580;">
                <span style="font-size: 14px; font-weight: 700; color: #003580;">TOTAL / الإجمالي:</span>
                <span style="font-size: 16px; font-weight: 700; color: #003580;">${totalPrice.toFixed(2)} ${currency}</span>
              </div>
              ${paidAmount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-size: 12px; color: #555;">PAID / المدفوع:</span>
                  <span style="font-size: 14px; font-weight: 700; color: #00a000;">${paidAmount.toFixed(2)} ${currency}</span>
                </div>
              ` : ''}
              ${remainingAmount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                  <span style="font-size: 12px; font-weight: 700; color: #c00;">BALANCE / المتبقي:</span>
                  <span style="font-size: 14px; font-weight: 700; color: #c00;">${remainingAmount.toFixed(2)} ${currency}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        ${selectedBooking.paymentMethod ? `
          <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; border-right: 4px solid #003580; margin: 20px 0;">
            <p style="font-size: 12px; color: #555; margin: 0;">
              <strong>Payment Method / طريقة الدفع:</strong> ${paymentMethod.en} / ${paymentMethod.ar}
            </p>
          </div>
        ` : ''}
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center;">
          <p style="font-size: 14px; font-weight: 700; color: #003580; margin-bottom: 10px;">Thank you for choosing HOSTEL MASR! / شكراً لاختيارك HOSTEL MASR!</p>
          <p style="font-size: 11px; color: #666; margin: 5px 0;">For inquiries / للاستفسار: info@hostelmasr.com</p>
          <p style="font-size: 10px; color: #999; margin-top: 15px;">This is a computer-generated invoice. / هذه فاتورة آلية.</p>
        </div>
      `
      
      document.body.appendChild(invoiceDiv)
      
      // Convert to canvas then PDF
      const canvas = await html2canvas(invoiceDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      
      document.body.removeChild(invoiceDiv)
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      
      let position = 0
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      const fileName = `Invoice_${selectedBooking.bookingId || selectedBooking._id || 'Booking'}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
      toast.success('تم إنشاء الفاتورة بنجاح! / Invoice generated successfully!')
    } catch (error) {
      console.error('Error generating invoice:', error)
      toast.error('حدث خطأ أثناء إنشاء الفاتورة')
    }
  }
  
  // Keep the old function as fallback (but we'll use HTML version)
  const generateCustomerInvoicePDF_OLD = () => {
    if (!selectedBooking) return
    
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPos = 15
    
    // Professional Header with Logo Area
    doc.setFillColor(0, 53, 128)
    doc.rect(0, 0, pageWidth, 55, 'F')
    
    // White border line
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(1)
    doc.line(0, 55, pageWidth, 55)
    
    // Company Name - Large
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('HOSTEL MASR', pageWidth / 2, 25, { align: 'center' })
    
    // Invoice Title - Bilingual
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text('INVOICE / فاتورة', pageWidth / 2, 38, { align: 'center' })
    
    // Subtitle
    doc.setFontSize(10)
    doc.text('Accommodation Booking Invoice', pageWidth / 2, 46, { align: 'center' })
    
    // Reset text color
    doc.setTextColor(0, 0, 0)
    yPos = 70
    
    // Invoice Info Box
    doc.setFillColor(248, 249, 250)
    doc.roundedRect(20, yPos - 8, pageWidth - 40, 25, 3, 3, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.5)
    doc.roundedRect(20, yPos - 8, pageWidth - 40, 25, 3, 3, 'S')
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice No. / رقم الفاتورة:', 25, yPos)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(selectedBooking.bookingId || selectedBooking._id || 'N/A', 25, yPos + 6)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Date / التاريخ:', pageWidth - 80, yPos)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const invoiceDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    doc.text(invoiceDate, pageWidth - 80, yPos + 6)
    
    if (selectedBooking.customReference) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Reference / المرجع:', 25, yPos + 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(selectedBooking.customReference, 25, yPos + 18)
    }
    
    yPos += 30
    
    // Two Column Layout
    const leftMargin = 20
    const rightMargin = pageWidth / 2 + 10
    const colWidth = (pageWidth - 50) / 2
    
    // LEFT COLUMN: Customer Information
    doc.setFillColor(0, 53, 128)
    doc.roundedRect(leftMargin, yPos - 5, colWidth, 8, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('BILL TO / الفواتير إلى', leftMargin + 5, yPos)
    
    doc.setTextColor(0, 0, 0)
    yPos += 10
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    const customerName = selectedBooking.guestName || 'Guest / ضيف'
    doc.setFont('helvetica', 'bold')
    doc.text(customerName, leftMargin + 5, yPos)
    yPos += 7
    
    if (selectedBooking.guestPhone) {
      doc.setFont('helvetica', 'normal')
      doc.text(`Phone / الهاتف: ${selectedBooking.guestPhone}`, leftMargin + 5, yPos)
      yPos += 6
    }
    
    if (selectedBooking.guestEmail) {
      doc.text(`Email / البريد: ${selectedBooking.guestEmail}`, leftMargin + 5, yPos)
      yPos += 6
    }
    
    if (selectedBooking.guestNationality) {
      doc.text(`Nationality / الجنسية: ${selectedBooking.guestNationality}`, leftMargin + 5, yPos)
      yPos += 6
    }
    
    const customerEndY = yPos + 5
    
    // RIGHT COLUMN: Booking Details
    yPos = 100
    
    doc.setFillColor(0, 53, 128)
    doc.roundedRect(rightMargin, yPos - 5, colWidth, 8, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('BOOKING DETAILS / تفاصيل الحجز', rightMargin + 5, yPos)
    
    doc.setTextColor(0, 0, 0)
    yPos += 10
    
    const apartment = apartments.find(a => a._id === selectedBooking.apartment)
    const room = apartment?.rooms?.find(r => r.roomId === selectedBooking.roomId)
    const numberOfNights = selectedBooking.numberOfNights || calculateNights(selectedBooking.checkIn, selectedBooking.checkOut)
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    if (apartment?.name) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Apartment / الشقة:`, rightMargin + 5, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(apartment.name, rightMargin + 5, yPos + 6)
      yPos += 12
    }
    
    if (room?.roomNumber) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Room / الغرفة:`, rightMargin + 5, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(`Room ${room.roomNumber}`, rightMargin + 5, yPos + 6)
      yPos += 12
    }
    
    const checkInDate = new Date(selectedBooking.checkIn).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    const checkOutDate = new Date(selectedBooking.checkOut).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    
    doc.setFont('helvetica', 'bold')
    doc.text(`Check-in / الوصول:`, rightMargin + 5, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(checkInDate, rightMargin + 5, yPos + 6)
    yPos += 12
    
    doc.setFont('helvetica', 'bold')
    doc.text(`Check-out / المغادرة:`, rightMargin + 5, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(checkOutDate, rightMargin + 5, yPos + 6)
    yPos += 12
    
    doc.setFont('helvetica', 'bold')
    doc.text(`Nights / الليالي:`, rightMargin + 5, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(`${numberOfNights} night${numberOfNights > 1 ? 's' : ''}`, rightMargin + 5, yPos + 6)
    yPos += 12
    
    // Transfer Information
    if (selectedBooking.originApartmentId && selectedBooking.originRoomId) {
      const originApt = apartments.find(a => a._id === selectedBooking.originApartmentId)
      const originRoom = originApt?.rooms?.find(r => r.roomId === selectedBooking.originRoomId)
      const destApt = apartments.find(a => a._id === selectedBooking.apartment)
      const destRoom = destApt?.rooms?.find(r => r.roomId === selectedBooking.roomId)
      
      doc.setFont('helvetica', 'bold')
      doc.text(`Transfer / نقل الحجز:`, rightMargin + 5, yPos)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`From / من: Apt ${originApt?.name || ''} - Room ${originRoom?.roomNumber || selectedBooking.originRoomId?.substring(0, 8)}`, rightMargin + 5, yPos + 5)
      doc.text(`To / إلى: Apt ${destApt?.name || ''} - Room ${destRoom?.roomNumber || selectedBooking.roomId?.substring(0, 8)}`, rightMargin + 5, yPos + 11)
      doc.setFontSize(9)
      yPos += 20
    } else if (selectedBooking.guestOrigin || selectedBooking.guestDestination) {
      if (selectedBooking.guestOrigin) {
        doc.setFont('helvetica', 'bold')
        doc.text(`Origin / قادم من:`, rightMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(selectedBooking.guestOrigin, rightMargin + 5, yPos + 6)
        yPos += 12
      }
      if (selectedBooking.guestDestination) {
        doc.setFont('helvetica', 'bold')
        doc.text(`Destination / إلى:`, rightMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(selectedBooking.guestDestination, rightMargin + 5, yPos + 6)
        yPos += 12
      }
    }
    
    yPos = Math.max(customerEndY, yPos + 15)
    
    // Items Table - Professional Design
    const currency = selectedBooking.currency || 'USD'
    const totalPrice = selectedBooking.totalBookingPrice || selectedBooking.totalAmountUSD || 0
    const paidAmount = selectedBooking.paidAmount || 0
    const remainingAmount = selectedBooking.remainingAmount || 0
    const nightPrice = numberOfNights > 0 ? (totalPrice / numberOfNights).toFixed(2) : totalPrice.toFixed(2)
    
    // Table Header
    doc.setFillColor(0, 53, 128)
    doc.roundedRect(20, yPos - 6, pageWidth - 40, 10, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    
    doc.text('DESCRIPTION / الوصف', 25, yPos)
    doc.text('QTY / الكمية', 120, yPos)
    doc.text('RATE / السعر', 150, yPos)
    doc.text('AMOUNT / المبلغ', pageWidth - 25, yPos, { align: 'right' })
    
    // Reset text color
    doc.setTextColor(0, 0, 0)
    yPos += 12
    
    // Table Row - Alternating background
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(20, yPos - 5, pageWidth - 40, 10, 2, 2, 'F')
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Accommodation / الإقامة (${numberOfNights} night${numberOfNights > 1 ? 's' : ''})`, 25, yPos)
    doc.text(numberOfNights.toString(), 120, yPos)
    doc.text(`${nightPrice} ${currency}`, 150, yPos)
    doc.setFont('helvetica', 'bold')
    doc.text(`${totalPrice.toFixed(2)} ${currency}`, pageWidth - 25, yPos, { align: 'right' })
    
    yPos += 15
    
    // Total Section with highlighted box
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(pageWidth - 90, yPos - 5, 70, 30, 3, 3, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.roundedRect(pageWidth - 90, yPos - 5, 70, 30, 3, 3, 'S')
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL / الإجمالي:', pageWidth - 85, yPos, { align: 'right' })
    doc.setFontSize(12)
    doc.text(`${totalPrice.toFixed(2)} ${currency}`, pageWidth - 25, yPos, { align: 'right' })
    yPos += 10
    
    if (paidAmount > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('PAID / المدفوع:', pageWidth - 85, yPos, { align: 'right' })
      doc.setTextColor(0, 150, 0)
      doc.setFont('helvetica', 'bold')
      doc.text(`${paidAmount.toFixed(2)} ${currency}`, pageWidth - 25, yPos, { align: 'right' })
      doc.setTextColor(0, 0, 0)
      yPos += 9
    }
    
    if (remainingAmount > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('BALANCE / المتبقي:', pageWidth - 85, yPos, { align: 'right' })
      doc.setTextColor(200, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.text(`${remainingAmount.toFixed(2)} ${currency}`, pageWidth - 25, yPos, { align: 'right' })
      doc.setTextColor(0, 0, 0)
    }
    
    yPos += 20
    
    // Payment Method Box
    const payments = selectedBooking.payments || []
    if (payments.length > 0) {
      const paymentMethods = {
        'cash': { en: 'Cash', ar: 'نقدي' },
        'visa': { en: 'Credit Card (Visa)', ar: 'بطاقة ائتمان (فيزا)' },
        'instapay': { en: 'InstaPay', ar: 'انستاباي' },
        'vodafone': { en: 'Vodafone Cash', ar: 'فودافون كاش' }
      }
      
      const boxHeight = 10 + (payments.length * 7)
      doc.setFillColor(240, 248, 255)
      doc.roundedRect(20, yPos - 5, pageWidth - 40, boxHeight, 3, 3, 'F')
      doc.setDrawColor(200, 220, 240)
      doc.setLineWidth(0.5)
      doc.roundedRect(20, yPos - 5, pageWidth - 40, boxHeight, 3, 3, 'S')
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Payment Methods / طرق الدفع:', 25, yPos + 3)
      yPos += 7
      
      payments.forEach((p, idx) => {
        const pm = paymentMethods[p.method] || { en: p.method, ar: p.method }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`${idx + 1}. ${pm.en} / ${pm.ar}: ${p.amount?.toFixed(2) || 0} ${p.currency || 'USD'}`, 30, yPos + 3)
        yPos += 7
      })
      yPos += 3
    } else if (selectedBooking.paymentMethod) {
      const paymentMethods = {
        'cash': { en: 'Cash', ar: 'نقدي' },
        'visa': { en: 'Credit Card (Visa)', ar: 'بطاقة ائتمان (فيزا)' },
        'instapay': { en: 'InstaPay', ar: 'انستاباي' },
        'vodafone': { en: 'Vodafone Cash', ar: 'فودافون كاش' }
      }
      const paymentMethod = paymentMethods[selectedBooking.paymentMethod] || { en: selectedBooking.paymentMethod, ar: selectedBooking.paymentMethod }
      
      doc.setFillColor(240, 248, 255)
      doc.roundedRect(20, yPos - 5, pageWidth - 40, 12, 3, 3, 'F')
      doc.setDrawColor(200, 220, 240)
      doc.setLineWidth(0.5)
      doc.roundedRect(20, yPos - 5, pageWidth - 40, 12, 3, 3, 'S')
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Payment Method / طريقة الدفع: ${paymentMethod.en}`, 25, yPos + 3)
      yPos += 15
    }
    
    // Professional Footer
    yPos = pageHeight - 45
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.5)
    doc.line(20, yPos, pageWidth - 20, yPos)
    yPos += 8
    
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'bold')
    doc.text('Thank you for choosing HOSTEL MASR!', pageWidth / 2, yPos, { align: 'center' })
    yPos += 6
    doc.setFont('helvetica', 'normal')
    doc.text('For inquiries / للاستفسار: info@hostelmasr.com', pageWidth / 2, yPos, { align: 'center' })
    yPos += 6
    doc.setFontSize(8)
    doc.text('This is a computer-generated invoice. / هذه فاتورة آلية.', pageWidth / 2, yPos, { align: 'center' })
    
    // Save PDF
    const fileName = `Invoice_${selectedBooking.bookingId || selectedBooking._id || 'Booking'}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
    toast.success('Invoice generated successfully! / تم إنشاء الفاتورة بنجاح!')
  }

  const nights = calculateNights(formData.checkIn, formData.checkOut)

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#003580]">📅 إدارة الحجوزات</h1>
        <button
          onClick={async () => {
            // تحديث أسعار الصرف قبل فتح البوب أب
            await fetchExchangeRates()
            setFormData({
              ...initialFormData,
              exchangeRate: exchangeRates[initialFormData.currency] || 50
            })
            setEditMode(false)
            setSelectedBooking(null)
            setShowModal(true)
          }}
          className="bg-[#febb02] text-[#003580] px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors flex items-center gap-2"
        >
          <span>+</span> إضافة حجز جديد
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">لا توجد حجوزات</h3>
          <p className="text-gray-600">ابدأ بإضافة أول حجز</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking) => {
            const computedStatus = getComputedStatus(booking)
            const statusInfo = getStatusInfo(computedStatus)
            const apt = apartments.find(a => a._id === booking.apartment)
            const isActive = computedStatus === 'active'
            const isCompleted = computedStatus === 'completed'
            
            // حساب الأيام المتبقية للحجوزات القادمة
            const checkInDate = new Date(booking.checkIn)
            checkInDate.setHours(0, 0, 0, 0)
            const checkOutDate = new Date(booking.checkOut)
            checkOutDate.setHours(0, 0, 0, 0)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const daysUntilCheckIn = Math.ceil((checkInDate - today) / (1000 * 60 * 60 * 24))
            
            return (
              <motion.div
                key={booking._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl shadow-md overflow-hidden border-r-4 ${
                  isActive ? 'border-green-500' : 
                  isCompleted ? 'border-gray-400' : 
                  computedStatus === 'upcoming' ? 'border-blue-500' : 'border-yellow-400'
                }`}
              >
                <div className="p-4">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    {/* Guest & Apartment Info */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}>
                          {statusInfo.icon} {statusInfo.label}
                        </span>
                        {isActive && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white animate-pulse">
                            🔴 الآن
                          </span>
                        )}
                        {computedStatus === 'upcoming' && daysUntilCheckIn <= 3 && daysUntilCheckIn > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
                            ⏰ بعد {daysUntilCheckIn} {daysUntilCheckIn === 1 ? 'يوم' : 'أيام'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-[#003580]">{booking.guestName}</h3>
                      <p className="text-gray-600">{apt?.name || 'شقة غير محددة'}</p>
                      {booking.guestPhone && <p className="text-sm text-gray-500">📞 {booking.guestPhone}</p>}
                    </div>

                    {/* Dates */}
                    <div className="text-center min-w-[150px]">
                      <div className="text-sm text-gray-500">تاريخ الحجز</div>
                      <div className="font-bold text-[#003580]">
                        {checkInDate.toLocaleDateString('ar-EG')}
                      </div>
                      <div className="text-xs text-gray-400">إلى</div>
                      <div className="font-bold text-[#003580]">
                        {checkOutDate.toLocaleDateString('ar-EG')}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {booking.numberOfNights || calculateNights(booking.checkIn, booking.checkOut)} ليالي
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-center min-w-[120px]">
                      <div className="text-sm text-gray-500">المبلغ</div>
                      <div className="text-2xl font-black text-green-600">
                        ${(booking.totalAmountUSD || 0).toFixed(0)}
                      </div>
                      {booking.remainingAmount > 0 && (
                        <div className="text-sm text-orange-600 font-bold">
                          متبقي: ${booking.remainingAmount.toFixed(0)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <button
                        onClick={() => handleViewDetails(booking)}
                        className="w-full px-4 py-2 bg-[#003580] text-white rounded-lg font-bold hover:bg-[#00264d] transition-colors text-sm"
                      >
                        👁️ التفاصيل
                      </button>
                      <button
                        onClick={() => handleEditBooking(booking)}
                        className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors text-sm"
                      >
                        ✏️ تعديل
                      </button>
                      {booking.status !== 'ended-early' && booking.status !== 'cancelled' && (
                        <button
                          onClick={() => handleEndBooking(booking)}
                          className="w-full px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-bold hover:bg-orange-200 transition-colors text-sm"
                        >
                          🚪 إنهاء مبكر
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirm({ open: true, id: booking._id })}
                        className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200 transition-colors text-sm"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Booking Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border-2 border-gray-100"
              style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
            >
              <div className="bg-gradient-to-r from-[#003580] to-[#004a99] text-white px-6 py-5 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {editMode ? (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      تعديل الحجز
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      إضافة حجز جديد
                    </>
                  )}
                </h2>
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Booking ID & Reference */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">رقم الحجز (Booking ID)</label>
                    <input type="text" value={formData.bookingId}
                      onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      placeholder="BK123456"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">الرقم المرجعي/السريال</label>
                    <input type="text" value={formData.customReference}
                      onChange={(e) => setFormData({ ...formData, customReference: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      placeholder="REF-123"
                    />
                  </div>
                </div>

                {/* Apartment & Room Selection */}
                <div className="mb-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                  <h3 className="font-bold text-[#003580] mb-3">🏢 الشقة والغرفة</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">اسم الشقة *</label>
                      <select
                        required
                        value={formData.apartment}
                        onChange={(e) => handleApartmentSelect(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0071c2] text-[#1a1a1a] bg-white"
                      >
                        <option value="">-- اختر الشقة --</option>
                        {apartments.map((apt) => (
                          <option key={apt._id} value={apt._id}>
                            {apt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">رقم الغرفة *</label>
                      <select
                        required
                        value={formData.roomId}
                        onChange={async (e) => {
                          const newFormData = { ...formData, roomId: e.target.value }
                          setFormData(newFormData)
                          // Check for conflicts
                          if (newFormData.checkIn && newFormData.checkOut) {
                            const conflict = await checkRoomConflict(
                              e.target.value,
                              newFormData.apartment,
                              newFormData.checkIn,
                              newFormData.checkOut,
                              editMode ? selectedBooking?._id : null
                            )
                            if (conflict?.hasConflict) {
                              setConflictWarning(conflict.conflictingBooking)
                            } else {
                              setConflictWarning(null)
                            }
                          }
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0071c2] text-[#1a1a1a] bg-white"
                        disabled={!formData.apartment}
                      >
                        <option value="">-- اختر الغرفة --</option>
                        {rooms.length === 0 && formData.apartment ? (
                          <option value="" disabled>لا توجد غرف متاحة في هذه الشقة</option>
                        ) : (
                          rooms.map((room) => (
                            <option key={room.roomId || room._id} value={room.roomId || room._id}>
                              Room {room.roomNumber || room.roomId?.substring(0, 8)} - {room.type === 'Single' ? 'مفردة' : room.type === 'Double' ? 'مزدوجة' : room.type === 'Triple' ? 'ثلاثية' : room.type === 'Quad' ? 'رباعية' : room.type} ({room.status === 'available' ? 'متاحة' : room.status === 'occupied' ? 'محجوزة' : 'صيانة'})
                            </option>
                          ))
                        )}
                      </select>
                      {!formData.apartment && (
                        <p className="text-sm text-gray-500 mt-1">يرجى اختيار الشقة أولاً</p>
                      )}
                      {formData.apartment && rooms.length === 0 && (
                        <p className="text-sm text-orange-600 mt-1">⚠️ لا توجد غرف متاحة في هذه الشقة. يرجى إضافة غرف أولاً.</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Display selected apartment and room names */}
                  {formData.apartment && (
                    <div className="mt-4 p-3 bg-white rounded-lg border-2 border-blue-300">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">اسم الشقة:</span>
                        <span className="font-bold text-[#003580]">{apartments.find(a => a._id === formData.apartment)?.name || '-'}</span>
                      </div>
                      {formData.roomId && (
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span className="text-gray-600">رقم الغرفة:</span>
                          <span className="font-bold text-[#003580]">
                            {(() => {
                              const apt = apartments.find(a => a._id === formData.apartment)
                              if (apt && apt.rooms) {
                                const room = apt.rooms.find(r => r.roomId === formData.roomId)
                                return room ? room.roomNumber : '-'
                              }
                              return rooms.find(r => r.roomId === formData.roomId)?.roomNumber || '-'
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Conflict Warning */}
                  {conflictWarning && (
                    <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700 font-bold">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        ⚠️ تحذير: تعارض في الحجز!
                      </div>
                      <p className="text-sm text-red-600 mt-2">
                        الغرفة محجوزة من {new Date(conflictWarning.checkIn).toLocaleDateString('ar-EG')} إلى {new Date(conflictWarning.checkOut).toLocaleDateString('ar-EG')} للضيف: {conflictWarning.guestName}
                      </p>
                    </div>
                  )}
                </div>

                {/* Guest Information */}
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <h3 className="font-bold text-[#003580] mb-3">👤 معلومات الضيف</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">اسم المقيم *</label>
                      <input type="text" required value={formData.guestName}
                        onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">نوع الحجز</label>
                      <select value={formData.bookingType}
                        onChange={(e) => setFormData({ ...formData, bookingType: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                      >
                        <option value="individual">فردي</option>
                        <option value="group">جماعي</option>
                        <option value="family">عائلي</option>
                        <option value="business">عمل</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">الجنسية</label>
                      <input type="text" value={formData.guestNationality}
                        onChange={(e) => setFormData({ ...formData, guestNationality: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                        placeholder="مصرية"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">رقم الموبايل <span className="text-gray-400 font-normal text-sm">(اختياري)</span></label>
                      <input type="tel" value={formData.guestPhone}
                        onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                        placeholder="مثال: 01001234567"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">البريد الإلكتروني <span className="text-gray-400 font-normal text-sm">(اختياري)</span></label>
                      <input type="email" value={formData.guestEmail}
                        onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                        placeholder="مثال: guest@email.com"
                      />
                    </div>
                    {/* Transfer Booking Toggle */}
                    <div className="mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isTransferEnabled || false}
                          onChange={(e) => {
                            const isEnabled = e.target.checked
                            if (!isEnabled) {
                              // Reset transfer data when disabled
                              setFormData({
                                ...formData,
                                isTransferEnabled: false,
                                originApartmentId: '',
                                originRoomId: '',
                                transferFromBookingId: '',
                                guestOrigin: ''
                              })
                            } else {
                              setFormData({
                                ...formData,
                                isTransferEnabled: true
                              })
                            }
                          }}
                          className="w-5 h-5 text-[#0071c2] border-gray-300 rounded focus:ring-[#0071c2]"
                        />
                        <span className="font-bold text-gray-700">🔄 هذا حجز منقول</span>
                      </label>
                    </div>

                    {/* Transfer Booking Section */}
                    {formData.isTransferEnabled && (
                      <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300 shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-2xl">📍</span>
                          <h4 className="font-bold text-[#0071c2] text-lg">نقل الحجز</h4>
                        </div>
                        
                        {/* From: Separate Apartment and Room Selection */}
                        <div className="mb-4">
                          <label className="block text-gray-700 font-bold mb-3 flex items-center gap-2">
                            <span className="text-blue-600">من</span>
                            <span className="text-xs text-gray-500 font-normal">(اختر الشقة والغرفة الأصلية)</span>
                          </label>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Apartment Selection */}
                            <div>
                              <label className="block text-sm text-gray-600 mb-1.5">الشقة الأصلية *</label>
                              <select
                                value={formData.originApartmentId || ''}
                                onChange={(e) => {
                                  const apartmentId = e.target.value
                                  setFormData({
                                    ...formData,
                                    originApartmentId: apartmentId,
                                    originRoomId: '', // Reset room when apartment changes
                                    transferFromBookingId: '',
                                    guestOrigin: ''
                                  })
                                }}
                                className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:border-[#0071c2] bg-white text-gray-800 font-medium transition-all hover:border-blue-400"
                                required={formData.isTransferEnabled}
                              >
                                <option value="">-- اختر الشقة --</option>
                                {apartments.map((apt) => (
                                  <option key={apt._id} value={apt._id}>
                                    {apt.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Room Selection */}
                            <div>
                              <label className="block text-sm text-gray-600 mb-1.5">الغرفة الأصلية *</label>
                              <select
                                value={formData.originRoomId || ''}
                                onChange={(e) => {
                                  const roomId = e.target.value
                                  setFormData({
                                    ...formData,
                                    originRoomId: roomId,
                                    transferFromBookingId: '',
                                    guestOrigin: ''
                                  })
                                }}
                                disabled={!formData.originApartmentId}
                                className={`w-full px-4 py-2.5 border-2 rounded-lg focus:border-[#0071c2] text-gray-800 font-medium transition-all ${
                                  !formData.originApartmentId 
                                    ? 'border-gray-200 bg-gray-100 cursor-not-allowed' 
                                    : 'border-blue-300 bg-white hover:border-blue-400'
                                }`}
                                required={formData.isTransferEnabled && formData.originApartmentId}
                              >
                                <option value="">-- اختر الغرفة --</option>
                                {transferOriginRooms.map((room) => (
                                  <option key={room.roomId} value={room.roomId}>
                                    غرفة {room.roomNumber || room.roomId?.substring(0, 8)} {room.type ? `(${room.type === 'Single' ? 'مفردة' : room.type === 'Double' ? 'مزدوجة' : room.type === 'Triple' ? 'ثلاثية' : room.type === 'Quad' ? 'رباعية' : room.type})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Show booking info and commission warning if found */}
                          {formData.originApartmentId && formData.originRoomId && formData.transferFromBookingId && (() => {
                            const originalBooking = bookings.find(b => b._id === formData.transferFromBookingId)
                            if (!originalBooking) return null
                            
                            const apt = apartments.find(a => a._id === formData.originApartmentId)
                            const room = apt?.rooms?.find(r => r.roomId === formData.originRoomId)
                            const hasPlatformCommission = originalBooking.platformCommission && originalBooking.platformCommission > 0
                            const isFromPlatform = originalBooking.source && originalBooking.source !== 'External'
                            
                            return (
                              <div className="mt-3 p-4 bg-white rounded-lg border-2 border-blue-400 shadow-sm">
                                <div className="flex items-start gap-2">
                                  <span className="text-green-600 text-xl">✓</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-800 mb-1">
                                      تم العثور على حجز للضيف: <span className="text-blue-600">{originalBooking.guestName}</span>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      شقة {apt?.name || ''} - غرفة {room?.roomNumber || formData.originRoomId?.substring(0, 8)}
                                    </p>
                                    {hasPlatformCommission && isFromPlatform && (
                                      <div className="mt-2 p-2 bg-orange-50 border border-orange-300 rounded">
                                        <p className="text-xs text-orange-700 font-bold">
                                          ⚠️ سيتم نقل عمولة المنصة ({originalBooking.source}: {originalBooking.platformCommission} {originalBooking.currency || 'USD'}) من الحجز الأصلي
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Divider */}
                        <div className="my-4 border-t-2 border-blue-200"></div>

                        {/* To: Auto-display current apartment and room */}
                        <div>
                          <label className="block text-gray-700 font-bold mb-3 flex items-center gap-2">
                            <span className="text-green-600">إلى</span>
                            <span className="text-xs text-gray-500 font-normal">(الشقة والغرفة الجديدة)</span>
                          </label>
                          {formData.apartment && formData.roomId ? (
                            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-400 shadow-sm">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">📍</span>
                                <div>
                                  <span className="text-sm text-gray-600 block mb-1">الوجهة الحالية:</span>
                                  <span className="text-lg font-bold text-green-700">
                                    {(() => {
                                      const apt = apartments.find(a => a._id === formData.apartment)
                                      const room = apt?.rooms?.find(r => r.roomId === formData.roomId) || rooms.find(r => r.roomId === formData.roomId)
                                      return `شقة ${apt?.name || ''} - غرفة ${room?.roomNumber || formData.roomId?.substring(0, 8)}`
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                              <p className="text-sm text-gray-500 text-center">
                                ⚠️ يرجى اختيار الشقة والغرفة الجديدة أولاً
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="mb-6 p-4 bg-green-50 rounded-xl border-2 border-green-200">
                  <h3 className="font-bold text-[#003580] mb-3">📅 التواريخ</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">تاريخ البداية *</label>
                      <input type="date" required value={formData.checkIn}
                        onChange={(e) => handleDateChange('checkIn', e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      />
                      {formData.checkIn && (
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(formData.checkIn).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">تاريخ النهاية *</label>
                      <input type="date" required value={formData.checkOut}
                        onChange={(e) => handleDateChange('checkOut', e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      />
                      {formData.checkOut && (
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(formData.checkOut).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">عدد الليالي</label>
                      <input 
                        type="number" 
                        min="0" 
                        value={formData.numberOfNights || 0}
                        readOnly
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100"
                      />
                      {formData.numberOfNights > 0 && (
                        <p className="text-sm text-green-700 mt-1 font-bold">
                          {formData.numberOfNights} ليلة
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {/* Financial Information */}
                <div className="mb-6 p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                  <h3 className="font-bold text-[#003580] mb-3">💰 المعلومات المالية (إدخال يدوي)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Total Booking Price with Currency */}
                    <div className="lg:col-span-2">
                      <label className="block text-gray-700 font-bold mb-2">إجمالي مبلغ الحجز *</label>
                      <div className="flex gap-2">
                        <input type="number" min="0" step="0.01" required 
                          value={formData.totalBookingPrice}
                          onChange={(e) => {
                            const total = parseFloat(e.target.value) || 0
                            const paid = formData.isSplitPayment && formData.payments && formData.payments.length > 0
                              ? calculatePaidAmount(formData.payments)
                              : (formData.singlePaymentAmount || 0)
                            setFormData({ 
                              ...formData, 
                              totalBookingPrice: total,
                              remainingAmount: total - paid
                            })
                          }}
                          className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                        />
                        <select 
                          value={formData.totalBookingPriceCurrency}
                          onChange={(e) => setFormData({ ...formData, totalBookingPriceCurrency: e.target.value })}
                          className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white min-w-[120px]"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="EGP">EGP</option>
                          <option value="AED">AED</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">المتبقي (محسوب تلقائياً)</label>
                      <input type="number" min="0" step="0.01" value={formData.remainingAmount || 0}
                        readOnly
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">نسبة HOSTEL MASR</label>
                      <input type="number" min="0" step="0.01" value={formData.hostelShare}
                        onChange={(e) => setFormData({ ...formData, hostelShare: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">نسبة المنصة/البرنامج</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={formData.platformCommission}
                        onChange={(e) => setFormData({ ...formData, platformCommission: parseFloat(e.target.value) || 0 })}
                        className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] ${
                          formData.source === 'External' ? 'bg-gray-100' : ''
                        }`}
                        disabled={formData.source === 'External'}
                        readOnly={formData.source === 'External'}
                      />
                      {formData.source === 'External' && (
                        <p className="text-xs text-gray-500 mt-1">يتم تعيينها تلقائياً إلى 0 للمصادر الخارجية</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">المصدر</label>
                      <select value={formData.source}
                        onChange={(e) => handleSourceChange(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                      >
                        <option value="External">خارجي (External)</option>
                        <option value="Booking.com">Booking.com</option>
                        <option value="Airbnb">Airbnb</option>
                        <option value="Other">أخرى</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">سعر الصرف</label>
                      <input type="number" min="0" step="0.01" value={formData.exchangeRate}
                        onChange={(e) => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 50 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      />
                    </div>
                  </div>

                  {/* Development Fund Deduction Section */}
                  <div className="mt-4 pt-4 border-t-2 border-purple-300 bg-purple-50 rounded-lg p-4">
                    <h4 className="font-bold text-[#003580] mb-3 flex items-center gap-2">
                      <span>💎</span>
                      صندوق التطوير (Development Fund)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-gray-700 font-bold mb-2">نوع الخصم</label>
                        <select 
                          value={formData.devDeductionType}
                          onChange={(e) => {
                            const newType = e.target.value
                            setFormData({ 
                              ...formData, 
                              devDeductionType: newType,
                              devDeductionValue: newType === 'none' ? 0 : formData.devDeductionValue
                            })
                          }}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                        >
                          <option value="none">لا يوجد</option>
                          <option value="percent">نسبة مئوية (%)</option>
                          <option value="fixed">مبلغ ثابت (EGP)</option>
                        </select>
                      </div>
                      {formData.devDeductionType !== 'none' && (
                        <div>
                          <label className="block text-gray-700 font-bold mb-2">
                            {formData.devDeductionType === 'percent' ? 'النسبة (%)' : 'المبلغ (EGP)'}
                          </label>
                          <input 
                            type="number" 
                            min="0" 
                            step={formData.devDeductionType === 'percent' ? '0.1' : '1'}
                            max={formData.devDeductionType === 'percent' ? '100' : undefined}
                            value={formData.devDeductionValue || 0}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              devDeductionValue: parseFloat(e.target.value) || 0 
                            })}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                            placeholder={formData.devDeductionType === 'percent' ? 'مثال: 5' : 'مثال: 500'}
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-gray-700 font-bold mb-2">قيمة الخصم (USD)</label>
                        <input 
                          type="number" 
                          value={calculateDevelopmentDeduction().toFixed(2)}
                          readOnly
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 font-bold text-purple-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Estimated Net Profit Display */}
                  <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-400 shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span>📊</span>
                      تقدير صافي الربح (Estimated Net Profit)
                    </h4>
                    {(() => {
                      const profitCalc = calculateEstimatedNetProfit()
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div className="bg-white p-2 rounded border">
                            <div className="text-gray-600 text-xs mb-1">إجمالي الحجز</div>
                            <div className="font-bold text-gray-800">${profitCalc.total.toFixed(2)}</div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-gray-600 text-xs mb-1">- عمولة المنصة</div>
                            <div className="font-bold text-red-600">-${profitCalc.platformCommission.toFixed(2)}</div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-gray-600 text-xs mb-1">- صندوق التطوير</div>
                            <div className="font-bold text-purple-600">-${profitCalc.developmentDeduction.toFixed(2)}</div>
                          </div>
                          <div className="bg-white p-2 rounded border border-blue-400">
                            <div className="text-gray-600 text-xs mb-1">= المبلغ القابل للتوزيع</div>
                            <div className="font-bold text-blue-700">${profitCalc.finalDistributableAmount.toFixed(2)}</div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-gray-600 text-xs mb-1">- نصيب الشركاء</div>
                            <div className="font-bold text-orange-600">-${profitCalc.ownerAmount.toFixed(2)}</div>
                          </div>
                          <div className="bg-white p-2 rounded border-2 border-green-500">
                            <div className="text-gray-600 text-xs mb-1">= صافي الربح المتوقع</div>
                            <div className="font-bold text-green-700 text-lg">${profitCalc.estimatedNetProfit.toFixed(2)}</div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Payment Section - Single or Split */}
                  <div className="mt-4 pt-4 border-t border-yellow-300">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-gray-800">💳 المبلغ المدفوع</h4>
                      {!formData.isSplitPayment && (
                        <button
                          type="button"
                          onClick={() => {
                            // Convert single payment to payments array if exists
                            const existingPayments = formData.singlePaymentAmount > 0 ? [{
                              amount: formData.singlePaymentAmount,
                              currency: formData.singlePaymentCurrency,
                              method: formData.singlePaymentMethod
                            }] : []
                            setFormData({
                              ...formData,
                              isSplitPayment: true,
                              payments: existingPayments.length > 0 ? existingPayments : [],
                              singlePaymentAmount: 0
                            })
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold"
                        >
                          🔀 تجزئة
                        </button>
                      )}
                      {formData.isSplitPayment && (
                        <button
                          type="button"
                          onClick={() => {
                            // Convert payments array to single payment
                            const totalPaid = calculatePaidAmount(formData.payments || [])
                            const firstPayment = formData.payments && formData.payments.length > 0 ? formData.payments[0] : null
                            setFormData({
                              ...formData,
                              isSplitPayment: false,
                              singlePaymentAmount: totalPaid,
                              singlePaymentCurrency: firstPayment?.currency || formData.currency || 'USD',
                              singlePaymentMethod: firstPayment?.method || 'cash',
                              payments: []
                            })
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-bold"
                        >
                          🔄 دفعة واحدة
                        </button>
                      )}
                    </div>

                    {!formData.isSplitPayment ? (
                      /* Single Payment Mode */
                      <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-gray-600 text-sm mb-1">المبلغ *</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formData.singlePaymentAmount || 0}
                              onChange={(e) => {
                                const amount = parseFloat(e.target.value) || 0
                                const total = formData.totalBookingPrice || 0
                                setFormData({
                                  ...formData,
                                  singlePaymentAmount: amount,
                                  paidAmount: amount,
                                  remainingAmount: total - amount
                                })
                              }}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600 text-sm mb-1">العملة *</label>
                            <select
                              value={formData.singlePaymentCurrency || 'USD'}
                              onChange={(e) => {
                                const currency = e.target.value
                                const rate = exchangeRates[currency] || formData.exchangeRate || 50
                                setFormData({
                                  ...formData,
                                  singlePaymentCurrency: currency,
                                  exchangeRate: rate
                                })
                              }}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                            >
                              <option value="USD">USD - دولار</option>
                              <option value="EUR">EUR - يورو</option>
                              <option value="GBP">GBP - جنيه استرليني</option>
                              <option value="EGP">EGP - جنيه مصري</option>
                              <option value="AED">AED - درهم إماراتي</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-gray-600 text-sm mb-1">طريقة الدفع *</label>
                            <select
                              value={formData.singlePaymentMethod || 'cash'}
                              onChange={(e) => setFormData({ ...formData, singlePaymentMethod: e.target.value })}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                            >
                              <option value="cash">💵 نقدي</option>
                              <option value="vodafone">📞 فودافون كاش</option>
                              <option value="instapay">📱 انستاباي</option>
                              <option value="visa">💳 فيزا</option>
                            </select>
                          </div>
                        </div>
                        {formData.singlePaymentAmount > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">إجمالي المدفوع:</span>
                              <span className="font-bold text-lg text-green-600">
                                ${formData.singlePaymentCurrency === 'USD' 
                                  ? formData.singlePaymentAmount.toFixed(2)
                                  : (formData.singlePaymentAmount / (exchangeRates[formData.singlePaymentCurrency] || formData.exchangeRate || 50)).toFixed(2)
                                } USD
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Split Payment Mode */
                      <>
                        <div className="flex justify-end mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              const newPayment = { amount: 0, currency: formData.currency || 'USD', method: 'cash' }
                              setFormData({
                                ...formData,
                                payments: [...(formData.payments || []), newPayment],
                                paidAmount: calculatePaidAmount([...(formData.payments || []), newPayment]),
                                remainingAmount: (formData.totalBookingPrice || 0) - calculatePaidAmount([...(formData.payments || []), newPayment])
                              })
                            }}
                            className="px-4 py-2 bg-[#003580] text-white rounded-lg hover:bg-[#00264d] text-sm font-bold"
                          >
                            ➕ إضافة دفعة
                          </button>
                        </div>

                        {(!formData.payments || formData.payments.length === 0) ? (
                          <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 rounded-lg">
                            لا توجد دفعات. اضغط "إضافة دفعة" لإضافة دفعة جديدة.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {formData.payments.map((payment, index) => (
                          <div key={index} className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <span className="font-bold text-gray-700">الدفعة #{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedPayments = formData.payments.filter((_, i) => i !== index)
                                  const newPaidAmount = calculatePaidAmount(updatedPayments)
                                  setFormData({
                                    ...formData,
                                    payments: updatedPayments,
                                    paidAmount: newPaidAmount,
                                    remainingAmount: (formData.totalBookingPrice || 0) - newPaidAmount
                                  })
                                }}
                                className="text-red-600 hover:text-red-800 font-bold text-lg"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-gray-600 text-sm mb-1">المبلغ *</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={payment.amount || 0}
                                  onChange={(e) => {
                                    const updatedPayments = [...formData.payments]
                                    updatedPayments[index].amount = parseFloat(e.target.value) || 0
                                    const newPaidAmount = calculatePaidAmount(updatedPayments)
                                    setFormData({
                                      ...formData,
                                      payments: updatedPayments,
                                      paidAmount: newPaidAmount,
                                      remainingAmount: (formData.totalBookingPrice || 0) - newPaidAmount
                                    })
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-gray-600 text-sm mb-1">العملة *</label>
                                <select
                                  value={payment.currency || 'USD'}
                                  onChange={(e) => {
                                    const updatedPayments = [...formData.payments]
                                    updatedPayments[index].currency = e.target.value
                                    const newPaidAmount = calculatePaidAmount(updatedPayments)
                                    setFormData({
                                      ...formData,
                                      payments: updatedPayments,
                                      paidAmount: newPaidAmount,
                                      remainingAmount: (formData.totalBookingPrice || 0) - newPaidAmount
                                    })
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                                >
                                  <option value="USD">USD - دولار</option>
                                  <option value="EUR">EUR - يورو</option>
                                  <option value="GBP">GBP - جنيه استرليني</option>
                                  <option value="EGP">EGP - جنيه مصري</option>
                                  <option value="AED">AED - درهم إماراتي</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-gray-600 text-sm mb-1">طريقة الدفع *</label>
                                <select
                                  value={payment.method || 'cash'}
                                  onChange={(e) => {
                                    const updatedPayments = [...formData.payments]
                                    updatedPayments[index].method = e.target.value
                                    setFormData({
                                      ...formData,
                                      payments: updatedPayments
                                    })
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                                >
                                  <option value="cash">💵 نقدي</option>
                                  <option value="vodafone">📞 فودافون كاش</option>
                                  <option value="instapay">📱 انستاباي</option>
                                  <option value="visa">💳 فيزا</option>
                                </select>
                              </div>
                            </div>
                            {payment.amount > 0 && (
                              <div className="mt-2 text-sm text-gray-600">
                                <span className="font-medium">المبلغ بالدولار:</span>{' '}
                                <span className="font-bold text-green-600">
                                  ${payment.currency === 'USD' 
                                    ? payment.amount.toFixed(2)
                                    : (payment.amount / (exchangeRates[payment.currency] || formData.exchangeRate || 50)).toFixed(2)
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                            ))}
                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-700">إجمالي المدفوع:</span>
                                <span className="font-bold text-lg text-green-600">
                                  ${calculatePaidAmount(formData.payments).toFixed(2)} USD
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-gray-700 font-bold mb-2">ملاحظات</label>
                  <textarea value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                    rows="2"
                  />
                </div>


                <div className="mt-6 flex gap-4">
                  <button type="submit" className="flex-1 bg-[#003580] text-white py-3 rounded-lg font-bold hover:bg-[#00264d]">
                    {editMode ? '💾 حفظ التعديلات' : '✅ إضافة الحجز'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)}
                    className="px-8 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl border-2 border-gray-100 flex flex-col"
              style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
            >
              <div className="bg-gradient-to-r from-[#003580] to-[#004a99] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  تفاصيل الحجز
                </h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#003580 #f0f0f0' }}>
                <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-sm"><span className="text-gray-500 text-xs">Booking ID:</span> <span className="font-bold block">{selectedBooking.bookingId || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">الترقيم الخاص:</span> <span className="font-bold block">{selectedBooking.customReference || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">اسم المقيم:</span> <span className="font-bold block">{selectedBooking.guestName}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">نوع الحجز:</span> <span className="font-bold block">{selectedBooking.bookingType === 'individual' ? 'فردي' : selectedBooking.bookingType === 'group' ? 'جماعي' : selectedBooking.bookingType === 'family' ? 'عائلي' : selectedBooking.bookingType === 'business' ? 'عمل' : '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">الجنسية:</span> <span className="font-bold block">{selectedBooking.guestNationality || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">رقم الموبايل:</span> <span className="font-bold block">{selectedBooking.guestPhone || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">اسم الشقة:</span> <span className="font-bold block">{apartments.find(a => a._id === selectedBooking.apartment)?.name || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">رقم الغرفة:</span> <span className="font-bold block">
                    {(() => {
                      const apt = apartments.find(a => a._id === selectedBooking.apartment)
                      if (apt && apt.rooms && selectedBooking.roomId) {
                        const room = apt.rooms.find(r => r.roomId === selectedBooking.roomId)
                        return room ? room.roomNumber : '-'
                      }
                      return '-'
                    })()}
                  </span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">عدد الليالي:</span> <span className="font-bold block">{selectedBooking.numberOfNights || calculateNights(selectedBooking.checkIn, selectedBooking.checkOut)}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">تاريخ البداية:</span> <span className="font-bold block text-xs">{new Date(selectedBooking.checkIn).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span></div>
                  <div className="text-sm"><span className="text-gray-500 text-xs">تاريخ النهاية:</span> <span className="font-bold block text-xs">{new Date(selectedBooking.checkOut).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span></div>
                  {/* Transfer Information */}
                  {selectedBooking.originApartmentId && selectedBooking.originRoomId ? (
                    <div className="col-span-2 text-sm">
                      <span className="text-gray-500 text-xs">نقل الحجز:</span>
                      <div className="mt-1 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="font-bold text-blue-800">
                          <div>📍 من: {(() => {
                            const apt = apartments.find(a => a._id === selectedBooking.originApartmentId)
                            const room = apt?.rooms?.find(r => r.roomId === selectedBooking.originRoomId)
                            return `شقة ${apt?.name || ''} - غرفة ${room?.roomNumber || selectedBooking.originRoomId?.substring(0, 8)}`
                          })()}</div>
                          <div className="mt-1">➡️ إلى: {(() => {
                            const apt = apartments.find(a => a._id === selectedBooking.apartment)
                            const room = apt?.rooms?.find(r => r.roomId === selectedBooking.roomId)
                            return `شقة ${apt?.name || ''} - غرفة ${room?.roomNumber || selectedBooking.roomId?.substring(0, 8)}`
                          })()}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {selectedBooking.guestOrigin && (
                        <div className="text-sm"><span className="text-gray-500 text-xs">قادم من:</span> <span className="font-bold block">{selectedBooking.guestOrigin}</span></div>
                      )}
                      {selectedBooking.guestDestination && (
                        <div className="text-sm"><span className="text-gray-500 text-xs">إلى:</span> <span className="font-bold block">{selectedBooking.guestDestination}</span></div>
                      )}
                    </>
                  )}
                </div>
                
                <div className="border-t pt-3 mt-3">
                  <h4 className="font-bold text-[#003580] mb-2 text-sm">💰 التفاصيل المالية</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span>إجمالي مبلغ الحجز:</span> <span className="font-bold">${(selectedBooking.totalBookingPrice || selectedBooking.totalAmountUSD || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>إجمالي ما تم دفعه:</span> <span className="font-bold text-green-600">${selectedBooking.paidAmount?.toFixed(2) || 0}</span></div>
                    <div className="flex justify-between"><span>المتبقي:</span> <span className="font-bold text-orange-600">${selectedBooking.remainingAmount?.toFixed(2) || 0}</span></div>
                    <div className="flex justify-between"><span>نسبة HOSTEL MASR:</span> <span className="font-bold">${(selectedBooking.hostelShare || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>نسبة المنصة/البرنامج:</span> <span className="font-bold">${(selectedBooking.platformCommission || 0).toFixed(2)}</span></div>
                    
                    {/* Payment Methods Display */}
                    {(selectedBooking.payments && selectedBooking.payments.length > 0) ? (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="font-bold text-gray-700 mb-2">💳 طرق الدفع:</div>
                        <div className="space-y-2">
                          {selectedBooking.payments.map((payment, idx) => (
                            <div key={idx} className="bg-gray-50 p-2 rounded-lg">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  {payment.method === 'cash' ? '💵 نقدي' : 
                                   payment.method === 'visa' ? '💳 فيزا' : 
                                   payment.method === 'instapay' ? '📱 انستاباي' : 
                                   payment.method === 'vodafone' ? '📞 فودافون كاش' : payment.method}
                                </span>
                                <span className="font-bold text-green-600">
                                  {payment.amount?.toFixed(2) || 0} {payment.currency || 'USD'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between"><span>طريقة الدفع:</span> <span className="font-bold">{selectedBooking.paymentMethod === 'cash' ? '💵 نقدي' : selectedBooking.paymentMethod === 'visa' ? '💳 فيزا' : selectedBooking.paymentMethod === 'instapay' ? '📱 انستاباي' : selectedBooking.paymentMethod === 'vodafone' ? '📞 فودافون كاش' : selectedBooking.paymentMethod || '-'}</span></div>
                    )}
                    
                    <div className="flex justify-between border-t pt-2"><span>المصدر:</span> <span className="font-bold">{selectedBooking.source || '-'}</span></div>
                  </div>
                </div>

                {/* Partners Section */}
                {selectedBooking.apartmentData?.partners && selectedBooking.apartmentData.partners.length > 0 && (
                  <div className="bg-purple-50 rounded-lg p-3 mt-3 border border-purple-200">
                    <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                      🤝 الشركاء ونسبهم
                    </h4>
                    <div className="space-y-1.5">
                      {selectedBooking.apartmentData.partners.map((partner, index) => {
                        const partnerShare = ((selectedBooking.hostelShare || 0) * (partner.percentage || 0)) / 100
                        return (
                          <div key={index} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                            <div>
                              <span className="font-medium text-xs">{partner.name}</span>
                              {partner.phone && <span className="text-xs text-gray-500 mr-1">📞 {partner.phone}</span>}
                              <span className="text-xs text-purple-600 mr-1">({partner.percentage}%)</span>
                            </div>
                            <span className="font-bold text-purple-600 text-xs">
                              ${partnerShare.toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {selectedBooking.notes && (
                  <div className="border-t pt-3 mt-3">
                    <h4 className="font-bold text-[#003580] mb-2 text-sm">📝 ملاحظات</h4>
                    <p className="text-gray-600 text-sm">{selectedBooking.notes}</p>
                  </div>
                )}
                </div>
              </div>
              
              {/* Fixed Bottom Section with Buttons */}
              <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
                {/* PDF Buttons */}
                <div className="flex gap-2 mb-3">
                  <button 
                    onClick={generateBookingDetailsPDF}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-2.5 rounded-lg font-bold hover:from-purple-600 hover:to-purple-700 shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    تفاصيل (PDF)
                  </button>
                  <button 
                    onClick={generateCustomerInvoicePDF}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-2.5 rounded-lg font-bold hover:from-green-600 hover:to-green-700 shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    فاتورة (PDF)
                  </button>
                </div>

                <div className="flex gap-2">
                  {selectedBooking.status !== 'cancelled' && selectedBooking.status !== 'ended-early' && (
                    <button 
                      onClick={() => {
                        setShowDetailsModal(false)
                        setShowExtendModal(true)
                      }}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-sm"
                    >
                      ⏱️ تمديد
                    </button>
                  )}
                  <button onClick={() => setShowDetailsModal(false)}
                    className="flex-1 bg-gradient-to-r from-[#003580] to-[#004a99] text-white py-2.5 rounded-lg font-bold hover:from-[#004a99] hover:to-[#0060b3] shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-sm">
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End Booking Early Modal */}
      <AnimatePresence>
        {showEndModal && selectedBooking && (
          <EndBookingModal
            booking={selectedBooking}
            onClose={() => setShowEndModal(false)}
            onConfirm={handleConfirmEndBooking}
          />
        )}
      </AnimatePresence>

      {/* Extend Booking Modal */}
      <AnimatePresence>
        {showExtendModal && selectedBooking && (
          <ExtendBookingModal
            booking={selectedBooking}
            onClose={() => {
              setShowExtendModal(false)
              setSelectedBooking(null)
            }}
            onConfirm={handleExtendBooking}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={() => handleDeleteBooking(deleteConfirm.id)}
        title="حذف الحجز"
        message="هل أنت متأكد من حذف هذا الحجز؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />
    </div>
  )
}

// Extend Booking Modal Component
const ExtendBookingModal = ({ booking, onClose, onConfirm }) => {
  const [extensionDays, setExtensionDays] = useState(1)
  const [extensionAmount, setExtensionAmount] = useState(0)

  const calculateNewCheckOut = () => {
    if (!extensionDays) return booking.checkOut
    const currentCheckOut = new Date(booking.checkOut)
    currentCheckOut.setDate(currentCheckOut.getDate() + parseInt(extensionDays))
    return currentCheckOut.toISOString().split('T')[0]
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border-2 border-gray-100"
        >
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-5 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              ⏱️ تمديد الحجز
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-6">
            <div className="mb-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <p className="text-sm text-gray-600 mb-2">الحجز الحالي:</p>
              <p className="font-bold text-[#003580]">
                {new Date(booking.checkIn).toLocaleDateString('ar-EG')} → {new Date(booking.checkOut).toLocaleDateString('ar-EG')}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                المبلغ الأصلي: ${(booking.totalBookingPrice || booking.totalAmountUSD || 0).toFixed(2)}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ ملاحظة: عمولة المنصة ستبقى كما هي (${(booking.originalPlatformCommission || booking.platformCommission || 0).toFixed(2)})
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-bold mb-2">عدد الأيام الإضافية *</label>
                <input
                  type="number"
                  min="1"
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-2">مبلغ التمديد *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={extensionAmount}
                  onChange={(e) => setExtensionAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500"
                />
              </div>

              {extensionDays > 0 && (
                <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                  <p className="text-sm text-gray-600 mb-1">تاريخ المغادرة الجديد:</p>
                  <p className="font-bold text-green-700 text-lg">
                    {new Date(calculateNewCheckOut()).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    المبلغ الإجمالي الجديد: ${((booking.totalBookingPrice || booking.totalAmountUSD || 0) + extensionAmount).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => onConfirm(extensionDays, extensionAmount)}
                disabled={!extensionDays || extensionDays <= 0 || !extensionAmount || extensionAmount <= 0}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-bold hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                ✅ تأكيد التمديد
              </button>
              <button
                onClick={onClose}
                className="px-8 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// End Booking Early Modal Component
const EndBookingModal = ({ booking, onClose, onConfirm }) => {
  const [actualCheckOut, setActualCheckOut] = useState(new Date().toISOString().split('T')[0])
  
  const originalNights = Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24))
  const actualNights = Math.max(1, Math.ceil((new Date(actualCheckOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)))
  const unusedNights = Math.max(0, originalNights - actualNights)
  const pricePerNight = (booking.totalAmountUSD || 0) / originalNights
  const refundAmount = unusedNights * pricePerNight

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border-2 border-gray-100"
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
        >
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-5 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              إنهاء الحجز مبكراً
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-600 mb-2">الضيف: <span className="font-bold">{booking.guestName}</span></p>
            <p className="text-gray-600">الحجز الأصلي: {originalNights} ليالي</p>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">تاريخ المغادرة الفعلي</label>
            <input
              type="date"
              value={actualCheckOut}
              min={booking.checkIn?.split('T')[0]}
              max={booking.checkOut?.split('T')[0]}
              onChange={(e) => setActualCheckOut(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
            />
          </div>

          <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-200 mb-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>الليالي المستخدمة:</div>
              <div className="font-bold">{actualNights}</div>
              <div>الليالي غير المستخدمة:</div>
              <div className="font-bold text-orange-600">{unusedNights}</div>
              <div>سعر الليلة:</div>
              <div className="font-bold">${pricePerNight.toFixed(2)}</div>
              <div className="border-t pt-2 text-lg">المبلغ المسترد للعميل:</div>
              <div className="border-t pt-2 font-black text-orange-600 text-xl">${refundAmount.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => onConfirm(refundAmount)}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3.5 rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/30 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              ✓ تأكيد الإنهاء
            </button>
            <button
              onClick={onClose}
              className="flex-1 border-2 border-gray-300 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
    </AnimatePresence>
  )
}

export default Bookings
