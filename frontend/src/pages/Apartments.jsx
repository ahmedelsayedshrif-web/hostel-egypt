import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { apartmentsAPI, bookingsAPI, roiAPI, expensesAPI } from '../services/api'
import { apartmentsFirestore, bookingsFirestore, expensesFirestore, db } from '../services/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { useToast, ConfirmDialog } from '../components/Toast'
// import { useAuth } from '../contexts/AuthContext' // Temporarily removed - AuthContext not found
import { canAddApartment, canDeleteApartment } from '../utils/permissions'
import { formatDate, formatDateArabic } from '../utils/dateFormat'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const Apartments = () => {
  // Default user role - can be updated when AuthContext is available
  const userRole = 'admin' // Default to admin to show all features
  const [apartments, setApartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  const [selectedApartment, setSelectedApartment] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [apartmentBookings, setApartmentBookings] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [roiData, setRoiData] = useState(null)
  const [apartmentExpenses, setApartmentExpenses] = useState([])
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseFormData, setExpenseFormData] = useState({
    category: '',
    amount: '',
    currency: 'EGP',
    description: '',
    date: new Date().toISOString().split('T')[0]
  })
  const [editingExpense, setEditingExpense] = useState(null)
  const [expensesUnsubscribe, setExpensesUnsubscribe] = useState(null)
  const toast = useToast()

  useEffect(() => {
    fetchApartments()
    fetchAllBookings()

    // Set up real-time listeners
    const unsubscribeApartments = apartmentsFirestore.subscribe((apartments) => {
      console.log('✅ Apartments updated in real-time:', apartments.length)
      const cityFilter = searchParams.get('city') || ''
      let filtered = apartments.filter(apt => apt.status !== 'deleted')
      if (cityFilter) {
        filtered = filtered.filter(apt =>
          apt.location?.city?.toLowerCase().includes(cityFilter.toLowerCase())
        )
      }
      setApartments(filtered)
    })

    const unsubscribeBookings = bookingsFirestore.subscribe((bookings) => {
      console.log('✅ Bookings updated in real-time:', bookings.length)
      setAllBookings(bookings)
    })

    // Update timer every minute to refresh remaining days
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    // Cleanup listeners on unmount
    return () => {
      if (unsubscribeApartments) unsubscribeApartments()
      if (unsubscribeBookings) unsubscribeBookings()
      clearInterval(interval)
    }
  }, [searchParams])

  useEffect(() => {
    // Update current time every second for real-time countdown
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchApartments = async () => {
    try {
      setError(null)

      // Try Firestore first (for production/shared data)
      try {
        const apartmentsData = await apartmentsFirestore.getAll()

        // Use Firestore data if available (even if empty - means Firestore is working)
        if (Array.isArray(apartmentsData)) {
          // Filter by city if needed
          const cityFilter = searchParams.get('city') || ''
          let filtered = apartmentsData.filter(apt => apt.status !== 'deleted')
          if (cityFilter) {
            filtered = filtered.filter(apt =>
              apt.location?.city?.toLowerCase().includes(cityFilter.toLowerCase())
            )
          }
          setApartments(filtered)
          return
        }
      } catch (firestoreError) {
        console.log('Firestore not available, trying API fallback:', firestoreError)
      }

      // Fallback to API only if Firestore completely failed
      const params = {
        city: searchParams.get('city') || '',
        isActive: true,
      }
      const response = await apartmentsAPI.getAll(params).catch(err => {
        console.error('Error fetching apartments:', err)
        return { data: [] }
      })
      const data = Array.isArray(response.data) ? response.data : (response.data?.apartments || [])
      setApartments(data)
    } catch (error) {
      console.error('Error fetching apartments:', error)
      setApartments([])
      setError(null)
    }
  }

  const fetchAllBookings = async () => {
    try {
      // Try Firestore first
      try {
        const bookingsData = await bookingsFirestore.getAll()
        if (bookingsData && bookingsData.length > 0) {
          setAllBookings(bookingsData)
          return
        }
      } catch (firestoreError) {
        console.log('Firestore not available, trying API fallback:', firestoreError)
      }

      // Fallback to API
      const response = await bookingsAPI.getAll().catch(() => ({ data: [] }))
      const bookings = Array.isArray(response.data) ? response.data : []
      setAllBookings(bookings)
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setAllBookings([])
    }
  }

  const handleDelete = async (id) => {
    try {
      // Try Firestore first
      try {
        await apartmentsFirestore.delete(id)
        toast.success('تم حذف الشقة بنجاح')
        fetchApartments()
        return
      } catch (firestoreError) {
        console.log('Firestore delete failed, trying API fallback:', firestoreError)
      }

      // Fallback to API
      await apartmentsAPI.delete(id)
      toast.success('تم حذف الشقة بنجاح')
      fetchApartments()
    } catch (error) {
      console.error('Error deleting apartment:', error)
      toast.error('حدث خطأ أثناء حذف الشقة')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 border-green-500'
      case 'rented':
        return 'bg-red-100 border-red-500'
      case 'booked':
        return 'bg-yellow-100 border-yellow-500'
      default:
        return 'bg-gray-100 border-gray-500'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'available':
        return 'متاحة'
      case 'rented':
        return 'متأجرة'
      case 'booked':
        return 'محجوزة'
      default:
        return 'غير معروف'
    }
  }

  const calculateRemainingDays = (checkOut) => {
    if (!checkOut) return null
    const checkout = new Date(checkOut)
    const diffTime = checkout - currentTime
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return days > 0 ? days : 0
  }

  // Helper function to safely convert date
  const safeDate = (dateValue) => {
    if (!dateValue) return null
    if (typeof dateValue === 'string') {
      return new Date(dateValue)
    } else if (dateValue && dateValue.toDate) {
      return dateValue.toDate()
    } else if (dateValue && dateValue.seconds) {
      return new Date(dateValue.seconds * 1000)
    }
    return new Date(dateValue)
  }

  // Function to get room status and remaining days
  // IMPORTANT: This function calculates active bookings based on ACTUAL DATES, not saved status
  // This ensures all active bookings are displayed correctly regardless of their saved status
  const getRoomStatus = (apartmentId, roomId) => {
    if (!roomId || !allBookings || allBookings.length === 0) {
      return { status: 'available', remainingDays: null, guestName: null }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Normalize apartment ID to string for comparison
    const aptIdStr = String(apartmentId || '').trim()
    const roomIdStr = String(roomId || '').trim()

    // Find active bookings for this room
    // CRITICAL: Ignore booking.status completely - calculate based on dates only
    const activeBookings = allBookings.filter(booking => {
      // Skip only explicitly deleted bookings
      if (booking.status === 'deleted') {
        return false
      }

      // Check apartment match - handle ALL possible formats:
      // 1. booking.apartment as string ID
      // 2. booking.apartment as object with _id or id
      // 3. booking.apartmentId (alternative field name)
      let bookingAptId = null
      if (booking.apartment) {
        if (typeof booking.apartment === 'string') {
          bookingAptId = booking.apartment
        } else if (typeof booking.apartment === 'object') {
          bookingAptId = booking.apartment._id || booking.apartment.id
        }
      } else if (booking.apartmentId) {
        bookingAptId = booking.apartmentId
      }

      const bookingAptIdStr = String(bookingAptId || '').trim()

      // Check if apartment matches (normalized string comparison)
      if (bookingAptIdStr !== aptIdStr || !bookingAptIdStr) {
        return false
      }

      // Check room match - handle ALL possible formats:
      // 1. booking.roomId as string ID
      // 2. booking.room as object with _id or id or roomId
      // 3. booking.roomId from room object
      let bookingRoomId = null
      if (booking.roomId) {
        bookingRoomId = booking.roomId
      } else if (booking.room) {
        if (typeof booking.room === 'string') {
          bookingRoomId = booking.room
        } else if (typeof booking.room === 'object') {
          bookingRoomId = booking.room.roomId || booking.room._id || booking.room.id
        }
      }

      const bookingRoomIdStr = String(bookingRoomId || '').trim()

      // Check if room matches (normalized string comparison)
      if (bookingRoomIdStr !== roomIdStr || !bookingRoomIdStr) {
        return false
      }

      // Exclude ONLY explicitly cancelled or ended-early bookings
      // DO NOT exclude based on status like 'completed' - check dates instead!
      if (booking.status === 'cancelled' || booking.status === 'ended-early') {
        return false
      }

      // Check if checkIn exists and is valid
      if (!booking.checkIn) {
        return false
      }

      const checkIn = safeDate(booking.checkIn)
      if (!checkIn || isNaN(checkIn.getTime())) {
        return false
      }
      checkIn.setHours(0, 0, 0, 0)

      // If checkOut is missing or empty, it's an open-ended booking
      // Consider it active if checkIn is today or in the past
      if (!booking.checkOut || booking.checkOut === '') {
        // Open-ended booking: active if checkIn is today or in the past
        return checkIn <= today
      }

      // Regular booking: check if today is between checkIn and checkOut
      // THIS IS THE CRITICAL LOGIC - ignore saved status, use dates only
      const checkOut = safeDate(booking.checkOut)
      if (!checkOut || isNaN(checkOut.getTime())) {
        return false
      }
      checkOut.setHours(0, 0, 0, 0)

      // Booking is ACTIVE if today is between checkIn and checkOut
      // This catches ALL bookings that are actually active by date,
      // regardless of their saved status (confirmed, completed, active, etc.)

      // FIX: Ensure logic is: today >= checkIn && today <= checkOut (Inclusive of checkout day to show "Leaving Today")
      // This means the guest is currently IN the room (event if checking out today)
      const isCurrentlyActive = checkIn <= today && today <= checkOut
      return isCurrentlyActive
    })

    if (activeBookings.length === 0) {
      return { status: 'available', remainingDays: null, guestName: null }
    }

    // Get the booking with the latest checkout date (or open-ended bookings first)
    const latestBooking = activeBookings.sort((a, b) => {
      // Open-ended bookings (no checkOut) should come first
      if (!a.checkOut || a.checkOut === '') return -1
      if (!b.checkOut || b.checkOut === '') return 1
      // Otherwise, sort by checkout date (latest first)
      return new Date(b.checkOut) - new Date(a.checkOut)
    })[0]

    // For open-ended bookings, remainingDays is null
    const remainingDays = latestBooking.checkOut && latestBooking.checkOut !== ''
      ? calculateRemainingDays(latestBooking.checkOut)
      : null

    return {
      status: 'occupied',
      remainingDays: remainingDays,
      guestName: latestBooking.guestName || null
    }
  }

  // Calculate apartment details from rooms array
  const calculateApartmentDetails = (apartment) => {
    if (!apartment || !apartment.rooms || apartment.rooms.length === 0) {
      return {
        roomsCount: apartment?.numberOfRooms || apartment?.rooms?.length || 0,
        bedrooms: apartment?.bedrooms || 0,
        bathrooms: apartment?.bathrooms || 0,
        beds: apartment?.beds || 0,
        guests: apartment?.guests || 0
      }
    }

    // Calculate from rooms array
    const rooms = apartment.rooms
    const roomsCount = rooms.length

    // Calculate bedrooms: each room is typically 1 bedroom, unless specified
    const bedrooms = rooms.reduce((sum, room) => {
      // If room has bedrooms field, use it, otherwise count room as 1 bedroom
      return sum + (parseInt(room.bedrooms) || 1)
    }, 0)

    // Calculate bathrooms: count based on bathroomType
    const bathrooms = rooms.reduce((sum, room) => {
      if (room.bathroomType === 'private') return sum + 1
      if (room.bathroomType === 'shared') return sum + 0.5
      return sum + 1 // default: assume private
    }, 0)

    // Calculate total beds
    const beds = rooms.reduce((sum, room) => {
      return sum + (parseInt(room.beds) || 1)
    }, 0)

    // Calculate total guests capacity
    const guests = rooms.reduce((sum, room) => {
      // Use guests field if available, otherwise use beds count
      return sum + (parseInt(room.guests) || parseInt(room.beds) || 1)
    }, 0)

    return {
      roomsCount,
      bedrooms: bedrooms > 0 ? bedrooms : roomsCount,
      bathrooms: Math.ceil(bathrooms) > 0 ? Math.ceil(bathrooms) : roomsCount,
      beds: beds > 0 ? beds : roomsCount,
      guests: guests > 0 ? guests : beds || roomsCount
    }
  }

  const fetchApartmentExpenses = async (apartmentId) => {
    if (!apartmentId) {
      console.warn('[Apartments] No apartment ID provided for fetching expenses')
      setApartmentExpenses([])
      return
    }

    try {
      console.log('[Apartments] Fetching expenses for apartment:', apartmentId)

      // Try Firestore first
      try {
        const expenses = await expensesFirestore.getByApartment(apartmentId)
        console.log('[Apartments] Expenses from Firestore:', expenses?.length || 0, 'expenses')
        if (Array.isArray(expenses)) {
          setApartmentExpenses(expenses)
        } else {
          setApartmentExpenses([])
        }
        return
      } catch (firestoreError) {
        console.error('[Apartments] Firestore expenses error:', firestoreError)
        // Check if it's an index error
        if (firestoreError.message && (firestoreError.message.includes('index') || firestoreError.code === 'failed-precondition')) {
          console.warn('[Apartments] Firestore index may be missing. Trying to fetch all expenses and filter locally.')
          // Try fetching all expenses and filtering locally
          try {
            const allExpenses = await expensesFirestore.getAll()
            const filtered = allExpenses.filter(e => (e.apartment === apartmentId || e.apartment?._id === apartmentId || e.apartment?.id === apartmentId))
            console.log('[Apartments] Filtered expenses (from all):', filtered.length)
            setApartmentExpenses(filtered)
            return
          } catch (fallbackError) {
            console.error('[Apartments] Fallback fetch also failed:', fallbackError)
          }
        }
      }

      // Fallback to API
      try {
        const response = await expensesAPI.getAll({ apartment: apartmentId }).catch(() => ({ data: [] }))
        const expenses = Array.isArray(response.data) ? response.data : []
        console.log('[Apartments] Expenses from API:', expenses.length, 'expenses')
        setApartmentExpenses(expenses)
      } catch (apiError) {
        console.error('[Apartments] API expenses error:', apiError)
        setApartmentExpenses([])
      }
    } catch (error) {
      console.error('[Apartments] Error fetching expenses:', error)
      setApartmentExpenses([])
    }
  }

  const openApartmentDetails = async (apartment) => {
    // Ensure apartment has both id and _id
    const apartmentId = apartment._id || apartment.id
    if (!apartmentId) {
      console.error('[Apartments] Apartment missing ID:', apartment)
      toast.error('خطأ: لا يمكن تحديد معرف الشقة')
      return
    }

    // Normalize apartment object
    const normalizedApartment = {
      ...apartment,
      _id: apartmentId,
      id: apartmentId
    }

    setSelectedApartment(normalizedApartment)
    setShowDetails(true)

    // Fetch bookings and expenses for this apartment
    try {
      const [bookingsRes, roiRes] = await Promise.all([
        bookingsAPI.getAll().catch(() => ({ data: [] })),
        roiAPI.getByApartment(apartmentId).catch(() => ({ data: null }))
      ])
      const allBookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : []
      const aptBookings = allBookings.filter(b => {
        const bookingAptId = b.apartment?._id || b.apartment?.id || b.apartment
        return bookingAptId === apartmentId
      })
      setApartmentBookings(aptBookings)
      setRoiData(roiRes.data)

      // Fetch expenses
      await fetchApartmentExpenses(apartmentId)

      // Set up real-time listener for expenses
      try {
        const unsubscribe = expensesFirestore.subscribeByApartment(apartmentId, (expenses) => {
          console.log('[Apartments] Expenses updated in real-time:', expenses?.length || 0)
          setApartmentExpenses(expenses || [])
        })
        setExpensesUnsubscribe(() => unsubscribe)
      } catch (listenerError) {
        console.error('[Apartments] Error setting up expenses listener:', listenerError)
        // If it's an index error, try without orderBy
        if (listenerError.message && (listenerError.message.includes('index') || listenerError.code === 'failed-precondition')) {
          console.warn('[Apartments] Index error, trying without orderBy')
          try {
            // Try with just where clause
            const expensesRef = collection(db, 'expenses')
            const q = query(expensesRef, where('apartment', '==', apartmentId))
            const unsubscribe = onSnapshot(q, (snapshot) => {
              const expenses = snapshot.docs.map(doc => {
                const data = doc.data()
                if (data.date && data.date.toDate) {
                  data.date = data.date.toDate().toISOString()
                }
                if (data.createdAt && data.createdAt.toDate) {
                  data.createdAt = data.createdAt.toDate().toISOString()
                }
                return { id: doc.id, _id: doc.id, ...data }
              })
              // Sort manually
              expenses.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
              console.log('[Apartments] Expenses updated (without orderBy):', expenses.length)
              setApartmentExpenses(expenses || [])
            })
            setExpensesUnsubscribe(() => unsubscribe)
          } catch (fallbackError) {
            console.error('[Apartments] Fallback listener also failed:', fallbackError)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching apartment details:', error)
      setApartmentBookings([])
      setRoiData(null)
      setApartmentExpenses([])
    }
  }

  const closeDetails = () => {
    // Unsubscribe from expenses listener
    if (expensesUnsubscribe) {
      expensesUnsubscribe()
      setExpensesUnsubscribe(null)
    }

    setShowDetails(false)
    setSelectedApartment(null)
    setApartmentBookings([])
    setRoiData(null)
    setApartmentExpenses([])
    setShowExpenseModal(false)
    setEditingExpense(null)
    setExpenseFormData({
      category: '',
      amount: '',
      currency: 'EGP',
      description: '',
      date: new Date().toISOString().split('T')[0]
    })
  }

  const handleAddExpense = () => {
    setEditingExpense(null)
    setExpenseFormData({
      category: '',
      amount: '',
      currency: 'EGP',
      description: '',
      date: new Date().toISOString().split('T')[0]
    })
    setShowExpenseModal(true)
  }

  const handleEditExpense = (expense) => {
    setEditingExpense(expense)
    setExpenseFormData({
      category: expense.category || '',
      amount: expense.amount || '',
      currency: expense.currency || 'EGP',
      description: expense.description || '',
      date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    })
    setShowExpenseModal(true)
  }

  const handleSaveExpense = async () => {
    if (!expenseFormData.category || !expenseFormData.amount) {
      toast.warning('يرجى ملء الفئة والمبلغ')
      return
    }

    if (!selectedApartment) {
      toast.error('خطأ: لم يتم تحديد الشقة')
      return
    }

    // Get apartment ID (support both id and _id)
    const apartmentId = selectedApartment._id || selectedApartment.id
    if (!apartmentId) {
      toast.error('خطأ: لا يمكن تحديد معرف الشقة')
      console.error('[Apartments] Selected apartment:', selectedApartment)
      return
    }

    try {
      const expenseData = {
        apartment: apartmentId,
        category: expenseFormData.category,
        amount: parseFloat(expenseFormData.amount),
        currency: expenseFormData.currency || 'EGP',
        description: expenseFormData.description || '',
        date: expenseFormData.date || new Date().toISOString().split('T')[0]
      }

      console.log('[Apartments] Saving expense:', expenseData)
      console.log('[Apartments] Apartment ID:', apartmentId)

      let saved = false

      if (editingExpense) {
        // Update expense
        const expenseId = editingExpense.id || editingExpense._id
        try {
          await expensesFirestore.update(expenseId, expenseData)
          console.log('[Apartments] Expense updated in Firestore')
          toast.success('تم تحديث المصروف بنجاح')
          saved = true
        } catch (firestoreError) {
          console.error('[Apartments] Firestore update failed:', firestoreError)
          try {
            await expensesAPI.update(expenseId, expenseData)
            console.log('[Apartments] Expense updated via API')
            toast.success('تم تحديث المصروف بنجاح')
            saved = true
          } catch (apiError) {
            console.error('[Apartments] API update also failed:', apiError)
            throw apiError
          }
        }
      } else {
        // Create expense
        try {
          const result = await expensesFirestore.create(expenseData)
          console.log('[Apartments] Expense created in Firestore:', result)
          toast.success('تم إضافة المصروف بنجاح')
          saved = true
        } catch (firestoreError) {
          console.error('[Apartments] Firestore create failed:', firestoreError)
          try {
            const result = await expensesAPI.create(expenseData)
            console.log('[Apartments] Expense created via API:', result)
            toast.success('تم إضافة المصروف بنجاح')
            saved = true
          } catch (apiError) {
            console.error('[Apartments] API create also failed:', apiError)
            throw apiError
          }
        }
      }

      if (saved) {
        // Wait a bit for Firestore to sync
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Refresh expenses
        console.log('[Apartments] Refreshing expenses for apartment:', apartmentId)
        await fetchApartmentExpenses(apartmentId)

        setShowExpenseModal(false)
        setEditingExpense(null)
        setExpenseFormData({
          category: '',
          amount: '',
          currency: 'EGP',
          description: '',
          date: new Date().toISOString().split('T')[0]
        })
      }
    } catch (error) {
      console.error('[Apartments] Error saving expense:', error)
      toast.error(`حدث خطأ أثناء حفظ المصروف: ${error.message || error}`)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    try {
      // Try Firestore first
      try {
        await expensesFirestore.delete(expenseId)
        toast.success('تم حذف المصروف بنجاح')
      } catch (firestoreError) {
        await expensesAPI.delete(expenseId)
        toast.success('تم حذف المصروف بنجاح')
      }

      // Refresh expenses
      await fetchApartmentExpenses(selectedApartment._id)
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('حدث خطأ أثناء حذف المصروف')
    }
  }

  // ROI Donut Chart Component
  const ROIDonutChart = ({ percentage, statusColor, isComplete }) => {
    const size = 200
    const strokeWidth = 20
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference

    const colorMap = {
      red: '#ef4444',
      yellow: '#eab308',
      green: '#22c55e'
    }
    const color = isComplete ? '#22c55e' : (colorMap[statusColor] || '#6b7280')

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-black" style={{ color }}>
            {(percentage || 0).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">مسترد</div>
        </div>
      </div>
    )
  }

  const generatePDFReport = (apartment) => {
    setGeneratingPDF(true)

    // Calculate financial summary
    const safeBookings = Array.isArray(apartmentBookings) ? apartmentBookings : []
    const totalRevenue = safeBookings.reduce((sum, b) => {
      const amount = b?.totalBookingPrice || b?.totalAmountUSD || b?.totalAmount || 0
      return sum + (typeof amount === 'number' ? Math.max(0, amount) : Math.max(0, parseFloat(amount) || 0))
    }, 0)
    const totalOwnerAmount = safeBookings.reduce((sum, b) => sum + (b?.ownerAmount || 0), 0)
    const totalPlatformFees = safeBookings.reduce((sum, b) => sum + (b?.platformCommission || 0), 0)
    const totalBrokerProfit = safeBookings.reduce((sum, b) => sum + (b?.brokerProfit || 0), 0)
    const totalPaid = safeBookings.reduce((sum, b) => sum + (b?.paidAmount || 0), 0)
    const totalPending = safeBookings.reduce((sum, b) => sum + (b?.remainingAmount || 0), 0)

    // Calculate monthly expenses
    const monthlyExpenses = Array.isArray(apartment?.monthlyExpenses) ? apartment.monthlyExpenses : []
    const totalMonthlyExpenses = monthlyExpenses.reduce((sum, e) => sum + (e?.amount || 0), 0)

    // Calculate apartment expenses from apartmentExpenses array
    const apartmentExpensesTotal = apartmentExpenses.reduce((sum, e) => sum + (e?.amount || 0), 0)

    // Calculate net profit: Revenue - Platform Fees - Expenses
    const revenueAfterCommission = totalRevenue - totalPlatformFees
    const totalExpenses = totalMonthlyExpenses + apartmentExpensesTotal
    const netProfit = revenueAfterCommission - totalExpenses

    // Partner calculations - only distribute if net profit is positive
    const partners = Array.isArray(apartment?.partners) ? apartment.partners : []
    const partnerDetails = partners.map(p => ({
      name: p?.name || '',
      percentage: p?.percentage || 0,
      totalEarnings: netProfit > 0 ? (netProfit * (p?.percentage || 0) / 100) : 0
    }))

    const reportDate = formatDate(new Date())

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير شقة - ${apartment.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Cairo', sans-serif;
      direction: rtl;
      padding: 30px;
      background: white;
      color: #1a1a1a;
      font-size: 14px;
    }
    
    .header {
      background: linear-gradient(135deg, #003580 0%, #0055a5 100%);
      color: white;
      padding: 30px;
      border-radius: 15px;
      margin-bottom: 25px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .header p {
      font-size: 16px;
      opacity: 0.9;
    }
    
    .report-date {
      background: #f0f4f8;
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 25px;
      text-align: center;
      color: #666;
    }
    
    .section {
      background: #fff;
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #003580;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #003580;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    
    .info-item {
      background: #f8f9fa;
      padding: 12px 15px;
      border-radius: 8px;
    }
    
    .info-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .financial-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .financial-card {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      padding: 15px;
      border-radius: 10px;
      text-align: center;
    }
    
    .financial-card.revenue { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); }
    .financial-card.owner { background: linear-gradient(135deg, #e2d5f1 0%, #d4c4e9 100%); }
    .financial-card.platform { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); }
    .financial-card.profit { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); }
    
    .financial-card .label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    
    .financial-card .value {
      font-size: 20px;
      font-weight: 700;
    }
    
    .partner-card {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .partner-name {
      font-weight: 600;
      font-size: 16px;
    }
    
    .partner-percentage {
      background: #003580;
      color: white;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 14px;
    }
    
    .partner-earnings {
      font-weight: 700;
      color: #003580;
      font-size: 18px;
    }
    
    .expense-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      background: #fff5f5;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    th, td {
      padding: 12px;
      text-align: right;
      border-bottom: 1px solid #e0e0e0;
    }
    
    th {
      background: #003580;
      color: white;
      font-weight: 600;
    }
    
    tr:nth-child(even) {
      background: #f8f9fa;
    }
    
    .status-badge {
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .status-confirmed { background: #d4edda; color: #155724; }
    .status-completed { background: #cce5ff; color: #004085; }
    .status-cancelled { background: #f8d7da; color: #721c24; }
    
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
      border-top: 2px solid #e0e0e0;
      margin-top: 30px;
    }
    
    .no-print {
      display: none;
    }
    
    @media print {
      body { padding: 15px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏠 ${apartment.name}</h1>
    <p>📍 ${apartment.location?.city || ''} - ${apartment.location?.address || ''}</p>
  </div>
  
  <div class="report-date">
    📅 تاريخ إصدار التقرير: ${reportDate}
  </div>

  <!-- Basic Info -->
  <div class="section">
    <div class="section-title">
      <span>🏢</span> معلومات الشقة الأساسية
    </div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">عدد الغرف</div>
        <div class="info-value">${apartment.rooms?.length || 0}</div>
      </div>
      <div class="info-item">
        <div class="info-label">غرف النوم</div>
        <div class="info-value">${apartment.bedrooms || 0}</div>
      </div>
      <div class="info-item">
        <div class="info-label">الحمامات</div>
        <div class="info-value">${apartment.bathrooms || 0}</div>
      </div>
      <div class="info-item">
        <div class="info-label">الأسرّة</div>
        <div class="info-value">${apartment.beds || 0}</div>
      </div>
      <div class="info-item">
        <div class="info-label">عدد الضيوف</div>
        <div class="info-value">${apartment.guests || 0}</div>
      </div>
    </div>
  </div>

  <!-- Partners -->
  ${partners.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span>🤝</span> الشركاء (${partners.length})
    </div>
    ${partnerDetails.map(p => `
    <div class="partner-card">
      <div>
        <div class="partner-name">${p.name}</div>
        <div class="partner-earnings">$${(p.totalEarnings || 0).toFixed(2)}</div>
      </div>
      <div class="partner-percentage">${p.percentage || 0}%</div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Monthly Expenses -->
  ${monthlyExpenses.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span>💸</span> المصاريف الشهرية (إجمالي: ${totalMonthlyExpenses.toLocaleString()} ج.م)
    </div>
    ${monthlyExpenses.map(e => `
    <div class="expense-item">
      <span>${e.name}</span>
      <span style="font-weight: 600;">${e.amount?.toLocaleString()} ج.م</span>
    </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Bookings History -->
  ${apartmentBookings.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span>📅</span> سجل الحجوزات (${apartmentBookings.length})
    </div>
    <table>
      <thead>
        <tr>
          <th>الضيف</th>
          <th>من</th>
          <th>إلى</th>
          <th>الليالي</th>
          <th>الإجمالي</th>
          <th>المدفوع</th>
          <th>ربحك</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${apartmentBookings.map(b => `
        <tr>
          <td>${b.guestName || '-'}</td>
          <td>${formatDate(b.checkIn)}</td>
          <td>${formatDate(b.checkOut)}</td>
          <td>${b.numberOfNights || '-'}</td>
          <td>$${(b.totalAmountUSD || 0).toFixed(2)}</td>
          <td>$${(b.paidAmount || 0).toFixed(2)}</td>
          <td style="color: #003580; font-weight: 600;">$${(b.brokerProfit || 0).toFixed(2)}</td>
          <td>
            <span class="status-badge status-${b.status || 'confirmed'}">
              ${b.status === 'completed' ? 'مكتمل' : b.status === 'cancelled' ? 'ملغي' : 'مؤكد'}
            </span>
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : `
  <div class="section">
    <div class="section-title">
      <span>📅</span> سجل الحجوزات
    </div>
    <p style="text-align: center; color: #666; padding: 20px;">لا توجد حجوزات مسجلة لهذه الشقة</p>
  </div>
  `}

  <!-- Amenities -->
  ${apartment.amenities && apartment.amenities.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span>✨</span> المرافق والخدمات
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
      ${apartment.amenities.map(a => `
        <span style="background: #e8f5e9; padding: 8px 15px; border-radius: 20px; font-size: 13px;">${a}</span>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <p>🏠 HOSTEL MASR - نظام إدارة الحجوزات</p>
    <p>تم إنشاء هذا التقرير آلياً - ${reportDate}</p>
  </div>
</body>
</html>
    `

    // Open in new window and print
    const printWindow = window.open('', '_blank')
    printWindow.document.write(htmlContent)
    printWindow.document.close()

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        setGeneratingPDF(false)
      }, 500)
    }

    toast.success('جاري إنشاء التقرير...')
  }

  // Remove error display - system will work normally even without backend

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-booking-blue">الشقق المتاحة</h1>
        {canAddApartment(userRole) && (
          <Link
            to="/apartments/add"
            className="bg-booking-yellow text-booking-blue px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors"
          >
            + إضافة شقة جديدة
          </Link>
        )}
      </div>

      {apartments.length === 0 && !error ? (
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <p className="text-gray-600 text-xl mb-6">لا توجد شقق متاحة حالياً</p>
            {canAddApartment(userRole) && (
              <Link
                to="/apartments/add"
                className="inline-block bg-booking-yellow text-booking-blue px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors"
              >
                أضف أول شقة
              </Link>
            )}
          </div>
        </div>
      ) : apartments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apartments.map((apartment, index) => {
            return (
              <motion.div
                key={apartment._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{
                  scale: 1.08,
                  y: -15,
                  rotate: [0, -1, 1, -1, 0],
                  transition: {
                    duration: 0.3,
                    type: "spring",
                    stiffness: 300
                  }
                }}
                className="relative bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-300 cursor-pointer transition-all duration-300"
              >
                <div onClick={() => openApartmentDetails(apartment)}>
                  <div className="relative h-48 bg-gray-200">
                    {apartment.images && apartment.images.length > 0 ? (
                      <img
                        src={apartment.images[0].startsWith('http')
                          ? apartment.images[0]
                          : `http://127.0.0.1:5000${apartment.images[0]}`
                        }
                        alt={apartment.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/800x600?text=No+Image'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        🏠
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">
                      {apartment.name}
                      {apartment.apartmentNumber && (
                        <span className="text-xs text-gray-500 mr-2">#{apartment.apartmentNumber}</span>
                      )}
                    </h3>
                    <p className="text-gray-500 mb-2 text-xs truncate">
                      {apartment.location?.city} - {apartment.location?.address}
                    </p>

                    {/* حالة الغرف - تصميم مضغوط وذكي */}
                    {apartment.rooms && apartment.rooms.length > 0 && (
                      <div className="space-y-1">
                        {apartment.rooms.map((room, roomIdx) => {
                          const roomStatus = getRoomStatus(apartment._id, room.roomId || room._id)
                          return (
                            <div key={room.roomId || room._id || roomIdx} className="flex items-center justify-between gap-2 bg-gray-50 rounded-md px-2.5 py-1.5 hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <span className="font-semibold text-gray-800 text-[11px] whitespace-nowrap">غرفة {room.roomNumber || `${roomIdx + 1}`}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap leading-none ${roomStatus.status === 'available'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-red-500 text-white'
                                  }`}>
                                  {roomStatus.status === 'available' ? 'متاحة' : 'متأجرة'}
                                </span>
                                {roomStatus.status === 'occupied' && roomStatus.guestName && (
                                  <span className="text-[10px] text-gray-500 truncate max-w-[80px]" title={roomStatus.guestName}>
                                    {roomStatus.guestName}
                                  </span>
                                )}
                              </div>
                              {roomStatus.status === 'occupied' && roomStatus.remainingDays !== null && roomStatus.remainingDays > 0 && (
                                <div className="flex items-center gap-0.5 bg-gray-800 text-white px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap leading-none">
                                  <span className="text-[9px]">⏱</span>
                                  <span className="font-bold">{roomStatus.remainingDays} يوم</span>
                                </div>
                              )}
                              {roomStatus.status === 'occupied' && roomStatus.remainingDays === 0 && (
                                <span className="text-red-600 font-bold text-[10px] whitespace-nowrap">ينتهي اليوم</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {canDeleteApartment(userRole) && (
                  <div className="p-4 pt-0">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        setDeleteConfirm({ open: true, id: apartment._id })
                      }}
                      className="w-full bg-red-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-600 transition-colors"
                    >
                      حذف
                    </button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      ) : null}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="حذف الشقة"
        message="هل أنت متأكد من حذف هذه الشقة؟ سيتم حذف جميع الحجوزات والمصاريف المرتبطة بها."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />

      {/* Apartment Details Modal */}
      {showDetails && selectedApartment && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeDetails}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-booking-blue text-white p-6 rounded-t-2xl flex-shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedApartment.name}</h2>
                  <p className="text-blue-100">
                    📍 {selectedApartment.location?.city} - {selectedApartment.location?.address}
                  </p>
                </div>
                <button
                  onClick={closeDetails}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#003580 #f0f0f0' }}>
              {/* Status & Rooms Count */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-gray-600 text-sm mb-1">الحالة</div>
                  <div className={`text-lg font-bold ${selectedApartment.bookingStatus === 'available' ? 'text-green-600' :
                    selectedApartment.bookingStatus === 'rented' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                    {getStatusLabel(selectedApartment.bookingStatus || 'available')}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-gray-600 text-sm mb-1">عدد الغرف</div>
                  <div className="text-2xl font-bold text-booking-blue">
                    {(() => {
                      const details = calculateApartmentDetails(selectedApartment)
                      return details.roomsCount
                    })()}
                  </div>
                </div>
              </div>

              {/* Current Tenant Info */}
              {(selectedApartment.bookingStatus === 'rented' || selectedApartment.bookingStatus === 'booked') && selectedApartment.currentBooking && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">
                    <span>👤</span>
                    المستأجر الحالي
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-600 text-sm">اسم الضيف</div>
                      <div className="font-bold text-lg">{selectedApartment.currentGuest?.name || 'غير محدد'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">رقم الهاتف</div>
                      <div className="font-bold">{selectedApartment.currentGuest?.phone || 'غير محدد'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">تاريخ الوصول</div>
                      <div className="font-bold">
                        {formatDate(selectedApartment.currentBooking.checkIn)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">تاريخ المغادرة</div>
                      <div className="font-bold text-red-600">
                        {formatDate(selectedApartment.currentBooking.checkOut)}
                      </div>
                    </div>
                  </div>
                  {selectedApartment.remainingDays !== null && (
                    <div className="mt-4 pt-4 border-t border-orange-200">
                      <div className="flex items-center justify-between">
                        <span className="text-orange-800 font-bold">⏱️ الأيام المتبقية:</span>
                        <span className="text-2xl font-black text-orange-600">
                          {calculateRemainingDays(selectedApartment.currentBooking.checkOut)} يوم
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Apartment Details */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🏠</span>
                  تفاصيل الشقة
                </h3>
                {(() => {
                  const details = calculateApartmentDetails(selectedApartment)
                  return (
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-2xl mb-1">🛏️</div>
                        <div className="text-gray-600 text-xs">غرف النوم</div>
                        <div className="font-bold text-lg">{details.bedrooms}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-2xl mb-1">🛁</div>
                        <div className="text-gray-600 text-xs">الحمامات</div>
                        <div className="font-bold text-lg">{details.bathrooms}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-2xl mb-1">🛋️</div>
                        <div className="text-gray-600 text-xs">الأسرّة</div>
                        <div className="font-bold text-lg">{details.beds}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-2xl mb-1">👥</div>
                        <div className="text-gray-600 text-xs">الضيوف</div>
                        <div className="font-bold text-lg">{details.guests}</div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Owner Info */}
              {/* Amenities */}
              {selectedApartment.amenities && selectedApartment.amenities.length > 0 && (
                <div className="bg-green-50 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
                    <span>✨</span>
                    المرافق والخدمات
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedApartment.amenities.map((amenity, idx) => (
                      <span key={idx} className="bg-white px-3 py-2 rounded-lg text-sm font-medium text-green-700 border border-green-200">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ROI Tracker */}
              {roiData && roiData.hasInvestment && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 border-2 border-purple-300">
                  <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                    <span>📈</span>
                    تتبع العائد على الاستثمار (ROI)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Donut Chart */}
                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'المسترد', value: roiData.recoveredAmount },
                              { name: 'المتبقي', value: roiData.remaining }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                          >
                            <Cell fill={roiData.statusColor === 'green' ? '#10b981' : roiData.statusColor === 'yellow' ? '#eab308' : '#ef4444'} />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => {
                              const safeValue = value || 0
                              if (name === 'المسترد') return [`$${safeValue.toFixed(2)}`, 'مسترد']
                              return [`$${safeValue.toFixed(2)}`, 'متبقي']
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => {
                              if (value === 'المسترد') return `المسترد: $${(roiData?.recoveredAmount || 0).toFixed(2)}`
                              return `المتبقي: $${(roiData?.remaining || 0).toFixed(2)}`
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* ROI Details */}
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                        <div className="text-sm text-gray-600 mb-1">هدف الاستثمار</div>
                        <div className="text-2xl font-black text-purple-700">
                          {roiData.investmentTarget.toLocaleString()} ج.م
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          تاريخ البدء: {formatDate(roiData.investmentStartDate)}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                        <div className="text-sm text-gray-600 mb-1">المبلغ المسترد</div>
                        <div className="text-2xl font-black text-green-700">
                          ${roiData.recoveredAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          ({roiData.recoveryPercentage.toFixed(1)}%)
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
                        <div className="text-sm text-gray-600 mb-1">المتبقي</div>
                        <div className="text-2xl font-black text-orange-700">
                          ${roiData.remaining.toFixed(2)}
                        </div>
                      </div>

                      {roiData.isComplete && (
                        <div className="bg-green-100 border-2 border-green-500 rounded-lg p-3 text-center">
                          <div className="text-green-800 font-bold text-lg">✅ تم تحقيق نقطة التعادل!</div>
                          <div className="text-sm text-green-700 mt-1">تم استرداد الاستثمار بالكامل</div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 text-center mt-2">
                        عدد الحجوزات: {roiData.bookingCount}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bookings Summary for this apartment */}
              {apartmentBookings.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <span>📊</span>
                    ملخص الحجوزات ({apartmentBookings.length} حجز)
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-gray-600 text-xs mb-1">إجمالي الإيرادات</div>
                      <div className="font-bold text-lg text-green-600">
                        ${apartmentBookings.reduce((sum, b) => sum + (b.totalAmountUSD || 0), 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-gray-600 text-xs mb-1">المحصّل</div>
                      <div className="font-bold text-lg text-blue-600">
                        ${apartmentBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-gray-600 text-xs mb-1">صافي ربحك</div>
                      <div className="font-bold text-lg text-booking-blue">
                        ${apartmentBookings.reduce((sum, b) => sum + (b.brokerProfit || 0), 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Partners Info */}
              {selectedApartment.partners && selectedApartment.partners.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-amber-800 mb-4 flex items-center gap-2">
                    <span>🤝</span>
                    الشركاء ({selectedApartment.partners.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedApartment.partners.map((partner, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg">
                        <div>
                          <div className="font-bold">{partner.name}</div>
                          {partner.phone && <div className="text-sm text-gray-500">📞 {partner.phone}</div>}
                        </div>
                        <div className="bg-amber-500 text-white px-4 py-1 rounded-full font-bold">
                          {partner.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Combined Expenses Section */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-5 border-2 border-red-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
                    <span>💰</span>
                    المصاريف والمصروفات
                  </h3>
                  <button
                    onClick={handleAddExpense}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition-colors text-sm flex items-center gap-2"
                  >
                    <span>➕</span>
                    إضافة مصروف
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Monthly Expenses */}
                  {selectedApartment.monthlyExpenses && selectedApartment.monthlyExpenses.length > 0 && (
                    <div>
                      <h4 className="text-md font-bold text-red-700 mb-2 flex items-center gap-2">
                        <span>💸</span>
                        المصاريف الشهرية
                      </h4>
                      <div className="space-y-2">
                        {selectedApartment.monthlyExpenses.map((expense, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border-r-4 border-red-400">
                            <span>{expense.name}</span>
                            <span className="font-bold text-red-600">{expense.amount?.toLocaleString()} ج.م</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Individual Expenses */}
                  <div>
                    <h4 className="text-md font-bold text-orange-700 mb-2 flex items-center gap-2">
                      <span>📋</span>
                      المصروفات ({apartmentExpenses.length})
                    </h4>
                    {apartmentExpenses.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 bg-white rounded-lg">
                        لا توجد مصروفات مسجلة
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {apartmentExpenses.map((expense) => (
                          <div key={expense.id || expense._id} className="bg-white p-3 rounded-lg flex items-center justify-between border-r-4 border-orange-400">
                            <div className="flex-1">
                              <div className="font-bold text-gray-800">{expense.category}</div>
                              {expense.description && (
                                <div className="text-sm text-gray-600 mt-1">{expense.description}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {formatDate(expense.date)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-bold text-orange-600">
                                  {expense.amount?.toLocaleString()} {expense.currency || 'EGP'}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditExpense(expense)}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
                                      handleDeleteExpense(expense.id || expense._id)
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Total Expenses */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-red-100 to-orange-100 p-4 rounded-lg mt-4 border-2 border-red-300">
                    <span className="font-bold text-lg">إجمالي جميع المصاريف</span>
                    <span className="font-bold text-red-800 text-xl">
                      {(() => {
                        const monthlyTotal = (selectedApartment.monthlyExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)
                        const expensesTotal = apartmentExpenses.reduce((sum, e) => {
                          const amount = parseFloat(e.amount || 0)
                          return sum + amount
                        }, 0)
                        return (monthlyTotal + expensesTotal).toLocaleString()
                      })()} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* ROI Tracker */}
              {roiData && roiData.hasInvestment && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
                  <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <span>📈</span>
                    تتبع العائد على الاستثمار (ROI)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    {/* Donut Chart */}
                    <div className="flex justify-center">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'المسترد', value: roiData.recoveredAmount, fill: roiData.statusColor === 'green' ? '#10b981' : roiData.statusColor === 'yellow' ? '#eab308' : '#ef4444' },
                              { name: 'المتبقي', value: roiData.remaining, fill: '#e5e7eb' }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                          >
                            <Cell fill={roiData.statusColor === 'green' ? '#10b981' : roiData.statusColor === 'yellow' ? '#eab308' : '#ef4444'} />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => {
                              const safeValue = value || 0
                              if (name === 'المسترد') return [`$${safeValue.toFixed(2)}`, 'مسترد']
                              return [`$${safeValue.toFixed(2)}`, 'متبقي']
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* ROI Stats */}
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                        <div className="text-sm text-gray-600 mb-1">الهدف الاستثماري</div>
                        <div className="text-2xl font-black text-blue-600">
                          ${roiData.investmentTarget.toLocaleString()}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                        <div className="text-sm text-gray-600 mb-1">المبلغ المسترد</div>
                        <div className="text-2xl font-black text-green-600">
                          ${(roiData?.recoveredAmount || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(roiData?.recoveryPercentage || 0).toFixed(1)}% من الهدف
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">المبلغ المتبقي</div>
                        <div className="text-2xl font-black text-gray-700">
                          ${(roiData?.remaining || 0).toFixed(2)}
                        </div>
                      </div>

                      {roiData.isComplete && (
                        <div className="bg-green-500 text-white rounded-lg p-4 text-center font-bold">
                          🎉 تم تحقيق نقطة التعادل!
                        </div>
                      )}

                      {!roiData.isComplete && (
                        <div className={`rounded-lg p-3 text-center font-bold ${roiData.statusColor === 'green' ? 'bg-green-100 text-green-800' :
                          roiData.statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                          {roiData.statusColor === 'green' && '✅ قريب من الربحية'}
                          {roiData.statusColor === 'yellow' && '⚠️ قيد الاسترداد'}
                          {roiData.statusColor === 'red' && '🔴 يحتاج استثمارات إضافية'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-blue-200 text-xs text-gray-600">
                    <p>تاريخ بداية الاستثمار: {formatDate(roiData.investmentStartDate)}</p>
                    <p className="mt-1">عدد الحجوزات المساهمة: {roiData.bookingCount}</p>
                  </div>
                </div>
              )}

              {/* Rooms Section */}
              {selectedApartment.rooms && selectedApartment.rooms.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <span>🚪</span>
                    تفاصيل الغرف ({selectedApartment.rooms.length})
                  </h3>
                  <div className="space-y-4">
                    {selectedApartment.rooms.map((room, idx) => {
                      const roomStatus = getRoomStatus(selectedApartment._id, room.roomId || room._id)
                      return (
                        <div key={room.roomId || room._id || idx} className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="font-bold text-lg text-gray-800">غرفة {room.roomNumber || `#${idx + 1}`}</div>
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                                  {room.type === 'Single' ? 'فردي' : room.type === 'Double' ? 'مزدوج' : room.type === 'Triple' ? 'ثلاثي' : room.type === 'Quad' ? 'رباعي' : room.type}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${roomStatus.status === 'available'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                                  }`}>
                                  {roomStatus.status === 'available' ? 'متاحة' : 'مشغولة'}
                                </span>
                              </div>

                              {/* Room Details */}
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                                {room.beds && (
                                  <div className="flex items-center gap-1">
                                    <span>🛏️</span>
                                    <span>عدد الأسرة: <strong className="text-gray-800">{room.beds}</strong></span>
                                  </div>
                                )}
                                {room.bathroomType && (
                                  <div className="flex items-center gap-1">
                                    <span>🛁</span>
                                    <span>الحمام: <strong className="text-gray-800">{room.bathroomType === 'private' ? 'خاص' : 'مشترك'}</strong></span>
                                  </div>
                                )}
                              </div>

                              {/* Guest Info if occupied */}
                              {roomStatus.status === 'occupied' && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-xs text-red-600 mb-1">المقيم الحالي:</div>
                                      <div className="font-bold text-red-800">{roomStatus.guestName || 'غير محدد'}</div>
                                    </div>
                                    {roomStatus.remainingDays !== null && (
                                      <div className="text-right">
                                        <div className="text-xs text-red-600 mb-1">متبقي:</div>
                                        <div className="text-2xl font-black text-red-600">{roomStatus.remainingDays}</div>
                                        <div className="text-xs text-red-600">يوم</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Room Images */}
                          {room.images && room.images.length > 0 ? (
                            <div className="mt-3">
                              <div className="text-sm font-bold text-gray-700 mb-2">صور الغرفة:</div>
                              <div className="grid grid-cols-4 gap-2">
                                {room.images.map((imgUrl, imgIdx) => (
                                  <img
                                    key={imgIdx}
                                    src={imgUrl.startsWith('http') ? imgUrl : `http://127.0.0.1:5000${imgUrl}`}
                                    alt={`Room ${room.roomNumber} - Image ${imgIdx + 1}`}
                                    className="w-full h-24 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all cursor-pointer hover:scale-105"
                                    onError={(e) => {
                                      e.target.src = 'https://via.placeholder.com/150x150?text=No+Image'
                                    }}
                                    onClick={() => window.open(imgUrl.startsWith('http') ? imgUrl : `http://127.0.0.1:5000${imgUrl}`, '_blank')}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 bg-gray-100 rounded-lg p-4 text-center text-gray-400 text-sm">
                              لا توجد صور لهذه الغرفة
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => generatePDFReport(selectedApartment)}
                  disabled={generatingPDF}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-center hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generatingPDF ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>📄 تصدير تقرير PDF</>
                  )}
                </button>
                <Link
                  to={`/apartments/edit/${selectedApartment._id}`}
                  className="flex-1 bg-booking-blue text-white py-3 rounded-xl font-bold text-center hover:bg-blue-700 transition-colors"
                >
                  ✏️ تعديل الشقة
                </Link>
                <button
                  onClick={() => {
                    closeDetails()
                    setDeleteConfirm({ open: true, id: selectedApartment._id })
                  }}
                  className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  🗑️ حذف
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && selectedApartment && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowExpenseModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-orange-500 text-white p-4 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingExpense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  الفئة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={expenseFormData.category}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                  placeholder="مثال: كهرباء، مياه، صيانة..."
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  المبلغ <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseFormData.amount || ''}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                  onWheel={(e) => e.target.blur()}
                  placeholder=""
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  العملة
                </label>
                <select
                  value={expenseFormData.currency}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, currency: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
                >
                  <option value="EGP">ج.م (EGP)</option>
                  <option value="USD">$ (USD)</option>
                  <option value="EUR">€ (EUR)</option>
                  <option value="GBP">£ (GBP)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  التاريخ
                </label>
                <input
                  type="date"
                  value={expenseFormData.date}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  الوصف (اختياري)
                </label>
                <textarea
                  value={expenseFormData.description}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                  placeholder="وصف إضافي للمصروف..."
                  rows="3"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveExpense}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors"
                >
                  {editingExpense ? 'تحديث' : 'إضافة'}
                </button>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default Apartments
