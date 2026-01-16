import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { bookingsAPI, apartmentsAPI, partnersAPI, currencyAPI, expensesAPI } from '../services/api'
import { bookingsFirestore, apartmentsFirestore, partnersFirestore, settingsFirestore, expensesFirestore } from '../services/firebase'
import { useToast } from '../components/Toast'
import { canViewPartnerShares } from '../utils/permissions'
import { calculateWaterfallPartnerProfits } from '../utils/waterfallCalculator'
import { getBookingAmountInUSD, getBookingPaidAmountInUSD, detectBookingOriginalCurrency } from '../utils/bookingCurrency'
import { formatDate, formatDateArabic } from '../utils/dateFormat'

const Financial = () => {
  // Default user role - can be updated when AuthContext is available
  const userRole = 'admin' // Default to admin to show all features
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [apartments, setApartments] = useState([])
  const [partners, setPartners] = useState([])
  const [expenses, setExpenses] = useState([])
  const [currencyRates, setCurrencyRates] = useState({})


  // Filters - Default to current month/year
  const currentDate = new Date()
  const [filters, setFilters] = useState({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    apartment: 'all',
    owner: 'all',
    partner: 'all',
    status: 'all',
    paymentMethod: 'all',
    platform: 'all',
    dateFrom: '',
    dateTo: '',
    showAllMonths: false,
  })

  // Display
  // IMPORTANT: Default currency to EGP (Egyptian Pound) as requested
  const [currency, setCurrency] = useState('EGP')
  const [activeTab, setActiveTab] = useState('overview')
  const [showMonthlyReport, setShowMonthlyReport] = useState(false)

  const months = [
    { value: 1, label: 'يناير' }, { value: 2, label: 'فبراير' },
    { value: 3, label: 'مارس' }, { value: 4, label: 'أبريل' },
    { value: 5, label: 'مايو' }, { value: 6, label: 'يونيو' },
    { value: 7, label: 'يوليو' }, { value: 8, label: 'أغسطس' },
    { value: 9, label: 'سبتمبر' }, { value: 10, label: 'أكتوبر' },
    { value: 11, label: 'نوفمبر' }, { value: 12, label: 'ديسمبر' }
  ]

  const years = [2026, 2025, 2024, 2023, 2022, 2021]

  useEffect(() => {
    fetchAllData()

    // Set up real-time listeners
    const unsubscribeBookings = bookingsFirestore.subscribe((bookingsData) => {
      console.log('✅ Bookings updated in real-time (Financial):', bookingsData.length)
      setBookings(bookingsData)
    })

    const unsubscribeApartments = apartmentsFirestore.subscribe((apartmentsData) => {
      console.log('✅ Apartments updated in real-time (Financial):', apartmentsData.length)
      setApartments(apartmentsData)
    })

    const unsubscribePartners = partnersFirestore.subscribe((partnersData) => {
      console.log('✅ Partners updated in real-time (Financial):', partnersData.length)
      setPartners(partnersData)
    })

    const unsubscribeExpenses = expensesFirestore.subscribe((expensesData) => {
      console.log('✅ Expenses updated in real-time (Financial):', expensesData.length)
      setExpenses(expensesData)
    })

    const unsubscribeRates = settingsFirestore.listenToCurrencyRates((rates) => {
      console.log('✅ Currency rates updated in real-time (Financial):', rates.length)
      if (rates && rates.length > 0) {
        const ratesObj = {}
        rates.forEach(rate => {
          if (rate && rate.currency) {
            ratesObj[rate.currency] = rate.rateToEGP || 50
          }
        })
        if (Object.keys(ratesObj).length > 0) {
          setCurrencyRates(ratesObj)
        }
      }
    })

    return () => {
      if (unsubscribeBookings) unsubscribeBookings()
      if (unsubscribeApartments) unsubscribeApartments()
      if (unsubscribePartners) unsubscribePartners()
      if (unsubscribeExpenses) unsubscribeExpenses()
      if (unsubscribeRates) unsubscribeRates()
    }
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      // Try Firestore first
      let bookingsData = []
      let apartmentsData = []
      let partnersData = []
      let ratesData = []

      try {
        [bookingsData, apartmentsData, partnersData] = await Promise.all([
          bookingsFirestore.getAll().catch(() => []),
          apartmentsFirestore.getAll().catch(() => []),
          partnersFirestore.getAll().catch(() => [])
        ])

        // Fetch expenses
        try {
          const expensesData = await expensesFirestore.getAll().catch(() => [])
          setExpenses(expensesData || [])
        } catch (e) {
          console.log('Firestore expenses not available')
        }

        try {
          ratesData = await settingsFirestore.getCurrencyRates()
        } catch (e) {
          console.log('Firestore rates not available')
        }
      } catch (firestoreError) {
        console.log('Firestore not available, trying API:', firestoreError)
      }

      // Fallback to API if Firestore data is empty
      if (!bookingsData || bookingsData.length === 0) {
        const bookingsRes = await bookingsAPI.getAll().catch(() => ({ data: [] }))
        bookingsData = Array.isArray(bookingsRes.data) ? bookingsRes.data : []
      }

      if (!apartmentsData || apartmentsData.length === 0) {
        const apartmentsRes = await apartmentsAPI.getAll().catch(() => ({ data: [] }))
        apartmentsData = Array.isArray(apartmentsRes.data) ? apartmentsRes.data : []
      }

      if (!partnersData || partnersData.length === 0) {
        const ownersRes = await partnersAPI.getAll().catch(() => ({ data: [] }))
        partnersData = Array.isArray(ownersRes.data) ? ownersRes.data : []
      }

      if (!ratesData || ratesData.length === 0) {
        const ratesRes = await currencyAPI.getRates().catch(() => ({ data: [] }))
        ratesData = Array.isArray(ratesRes.data) ? ratesRes.data : []
      }

      // Fetch expenses if not already loaded from Firestore
      let expensesData = []
      try {
        expensesData = await expensesFirestore.getAll().catch(() => [])
        if (expensesData && expensesData.length > 0) {
          setExpenses(expensesData)
        } else {
          // Fallback to API
          const expensesRes = await expensesAPI.getAll().catch(() => ({ data: [] }))
          expensesData = Array.isArray(expensesRes.data) ? expensesRes.data : []
          setExpenses(expensesData)
        }
      } catch (e) {
        console.error('Error fetching expenses:', e)
        // Try API as fallback
        try {
          const expensesRes = await expensesAPI.getAll().catch(() => ({ data: [] }))
          expensesData = Array.isArray(expensesRes.data) ? expensesRes.data : []
          setExpenses(expensesData)
        } catch (apiError) {
          console.error('API expenses fetch also failed:', apiError)
          setExpenses([])
        }
      }

      setBookings(bookingsData)
      setApartments(apartmentsData)
      setPartners(partnersData)

      const rates = {}
      ratesData.forEach(r => {
        if (r && r.currency) {
          rates[r.currency] = r.rateToEGP || 50
        }
      })
      setCurrencyRates(rates)
    } catch (error) {
      console.error('Error:', error)
    }
    setLoading(false)
  }

  // Filter bookings based on all filters
  const getFilteredBookings = () => {
    if (!Array.isArray(bookings)) return []

    // Normalize start/end of selected month to include bookings that span months
    const monthStart = new Date(filters.year, filters.month - 1, 1)
    const monthEnd = new Date(filters.year, filters.month, 0)
    monthStart.setHours(0, 0, 0, 0)
    monthEnd.setHours(23, 59, 59, 999)

    return bookings.filter(booking => {
      const checkInDate = booking?.checkIn ? new Date(booking.checkIn) : null
      const checkOutDate = booking?.checkOut ? new Date(booking.checkOut) : checkInDate
      if (!checkInDate || isNaN(checkInDate.getTime())) return false
      if (!checkOutDate || isNaN(checkOutDate.getTime())) return false

      checkInDate.setHours(0, 0, 0, 0)
      checkOutDate.setHours(23, 59, 59, 999)

      // Month/Year filter: include any booking that overlaps the selected month
      if (!filters.showAllMonths) {
        const overlapsSelectedMonth = checkInDate <= monthEnd && checkOutDate >= monthStart
        if (!overlapsSelectedMonth) return false
      }

      // Date range filter (still based on check-in)
      if (filters.dateFrom && new Date(booking.checkIn) < new Date(filters.dateFrom)) return false
      if (filters.dateTo && new Date(booking.checkIn) > new Date(filters.dateTo)) return false

      // Apartment filter
      if (filters.apartment !== 'all' && booking.apartment !== filters.apartment) return false

      // Partner filter (via apartment)
      if (filters.partner !== 'all') {
        const apt = apartments.find(a => a._id === booking.apartment)
        if (!apt || apt.mainOwner !== filters.partner) return false
      }

      // Status filter
      if (filters.status !== 'all' && booking.status !== filters.status) return false

      // Payment method filter
      if (filters.paymentMethod !== 'all' && booking.paymentMethod !== filters.paymentMethod) return false

      // Platform filter
      if (filters.platform !== 'all' && booking.platform !== filters.platform) return false

      return true
    })
  }

  // Get filtered expenses based on filters
  const getFilteredExpenses = () => {
    if (!Array.isArray(expenses)) {
      return []
    }

    return expenses.filter(expense => {
      // Get apartment ID (support both string and object)
      const expenseAptId = expense.apartment?._id || expense.apartment?.id || expense.apartment

      // Filter by apartment
      if (filters.apartment !== 'all' && expenseAptId !== filters.apartment) {
        return false
      }

      // Convert expense date to Date object
      let expenseDate = null
      if (expense.date) {
        if (expense.date.toDate) {
          expenseDate = expense.date.toDate()
        } else if (expense.date.seconds) {
          expenseDate = new Date(expense.date.seconds * 1000)
        } else {
          expenseDate = new Date(expense.date)
        }
      } else if (expense.createdAt) {
        if (expense.createdAt.toDate) {
          expenseDate = expense.createdAt.toDate()
        } else if (expense.createdAt.seconds) {
          expenseDate = new Date(expense.createdAt.seconds * 1000)
        } else {
          expenseDate = new Date(expense.createdAt)
        }
      }

      if (!expenseDate || isNaN(expenseDate.getTime())) {
        console.warn('[Financial] Invalid expense date:', expense)
        return false
      }

      // Filter by date range
      if (filters.dateFrom && expenseDate < new Date(filters.dateFrom)) return false
      if (filters.dateTo && expenseDate > new Date(filters.dateTo)) return false

      // Filter by month/year if not showing all months
      if (!filters.showAllMonths) {
        const expenseMonth = expenseDate.getMonth() + 1
        const expenseYear = expenseDate.getFullYear()
        if (expenseMonth !== filters.month || expenseYear !== filters.year) return false
      }

      return true
    })
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

  // Calculate booking status based on dates
  // IMPORTANT: Open-ended bookings (no checkOut) are considered active if checkIn has passed
  const getComputedStatus = (booking) => {
    if (booking.status === 'cancelled' || booking.status === 'ended-early') {
      return booking.status
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const checkInDate = safeDate(booking.checkIn)
    if (!checkInDate || isNaN(checkInDate.getTime())) {
      return booking.status || 'confirmed'
    }
    checkInDate.setHours(0, 0, 0, 0)

    // IMPORTANT: If checkOut is missing or empty, it's an open-ended booking
    // Open-ended bookings are active if checkIn has passed
    if (!booking.checkOut || booking.checkOut === '') {
      // Open-ended booking: active if checkIn is today or in the past
      if (checkInDate <= today) {
        return 'active' // الحجز المفتوح يظهر كنشط
      }
      // If checkIn is in the future, it's upcoming
      return 'upcoming'
    }

    const checkOutDate = safeDate(booking.checkOut)
    if (!checkOutDate || isNaN(checkOutDate.getTime())) {
      // Invalid checkOut, treat as open-ended
      if (checkInDate <= today) {
        return 'active'
      }
      return 'upcoming'
    }
    checkOutDate.setHours(0, 0, 0, 0)

    // If checkout date has passed = completed
    if (checkOutDate < today) {
      return 'completed'
    }

    // If check-in date is today or passed and checkout is still future = active
    if (checkInDate <= today && checkOutDate >= today) {
      return 'active'
    }

    // If check-in date is still future = upcoming
    if (checkInDate > today) {
      return 'upcoming'
    }

    return booking.status || 'confirmed'
  }

  // Helper function to convert amount to USD
  // This function needs to use currencyRates from state, but we'll make it safe
  const convertToUSD = (amount, currency) => {
    if (!amount || amount === 0) return 0
    const amountNum = parseFloat(amount) || 0

    if (!currency || currency === 'USD') {
      return amountNum
    }

    // Use currencyRates from state, with safe fallback
    const safeRates = currencyRates || { USD: 50, EUR: 54, GBP: 63, AED: 13.6, SAR: 13.3 }
    const usdRate = safeRates.USD || 50
    const currencyRate = safeRates[currency] || usdRate

    if (currency === 'EGP') {
      return amountNum / usdRate
    }

    // For other currencies, convert via EGP
    // amount in currency * currencyRate = amount in EGP
    // amount in EGP / usdRate = amount in USD
    const amountInEGP = amountNum * currencyRate
    const amountInUSD = amountInEGP / usdRate
    return amountInUSD
  }

  // Calculate summary from filtered bookings
  const calculateSummary = () => {
    const filtered = getFilteredBookings()
    const filteredExpenses = getFilteredExpenses()

    // Ensure currencyRates is always defined to prevent crashes
    const safeCurrencyRates = currencyRates || { USD: 50, EUR: 54, GBP: 63, AED: 13.6, SAR: 13.3 }

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

    // Convert all amounts to USD for consistency
    // totalRevenue = sum of all booking amounts (completed + active + upcoming)
    // IMPORTANT: For cross-month bookings, split revenue by nights (same as Dashboard)
    let totalRevenue = 0
    const bookingWarnings = []
    filtered.forEach(b => {
      try {
        // Validate booking currency info
        if (!b.totalBookingPriceCurrency && !b.totalAmountUSD) {
          bookingWarnings.push(`⚠️ [Financial] Booking ${b._id || b.id} (${b.guestName || 'Unknown'}) missing currency info`)
        }

        const bookingTotalUSD = getBookingAmountInUSD(b, safeCurrencyRates)

        // Calculate revenue split by nights for cross-month bookings (same as Dashboard)
        const checkInDateForSplit = safeDate(b.checkIn)
        const checkOutDateForSplit = safeDate(b.checkOut)
        if (checkInDateForSplit && checkOutDateForSplit && !isNaN(checkInDateForSplit.getTime()) && !isNaN(checkOutDateForSplit.getTime())) {
          const checkInMonth = checkInDateForSplit.getMonth() + 1
          const checkInYear = checkInDateForSplit.getFullYear()
          const checkOutMonth = checkOutDateForSplit.getMonth() + 1
          const checkOutYear = checkOutDateForSplit.getFullYear()

          // IMPORTANT: For cross-month bookings, count full revenue in checkout month
          // This matches the payment methods and paid amount logic
          if ((checkInMonth !== checkOutMonth || checkInYear !== checkOutYear) && !filters.showAllMonths) {
            // Check if checkout is in the selected month
            if (checkOutMonth === filters.month && checkOutYear === filters.year) {
              // Booking ends in this month - count full revenue
              totalRevenue += bookingTotalUSD
            }
            // Otherwise don't count (revenue = 0 for this month)
          } else {
            // Single month booking or showing all months - use full amount
            totalRevenue += bookingTotalUSD
          }
        } else {
          // Fallback: use full amount if dates are invalid
          totalRevenue += bookingTotalUSD
        }
      } catch (e) {
        console.error('Error calculating booking amount:', e, b)
      }
    })

    // IMPORTANT: Profits and revenue are only counted AFTER booking completion
    // Active/upcoming bookings show in pending amounts
    // paidAmount = sum of paid amounts for completed bookings only (with cross-month split)
    let paidAmount = 0
    let pendingAmount = 0

    filtered.forEach(b => {
      const status = getComputedStatus(b)
      const bookingTotalUSD = getBookingAmountInUSD(b, safeCurrencyRates)
      let bookingPaidUSD = getBookingPaidAmountInUSD(b, safeCurrencyRates)

      // IMPORTANT: Fix data inconsistency - if paid > total, cap paid at total
      if (bookingPaidUSD > bookingTotalUSD && bookingTotalUSD > 0) {
        bookingPaidUSD = bookingTotalUSD
      }

      // IMPORTANT: For completed bookings that are fully paid, ensure remaining is 0
      const checkOutDateForStatus = safeDate(b.checkOut)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isCompleted = status === 'completed' || (checkOutDateForStatus && !isNaN(checkOutDateForStatus.getTime()) && checkOutDateForStatus.setHours(0, 0, 0, 0) < today.getTime())
      const calculatedRemaining = Math.max(0, bookingTotalUSD - bookingPaidUSD)

      // If completed and fully paid (remaining < 0.01), set remaining to 0
      const finalRemaining = (isCompleted && calculatedRemaining < 0.01) ? 0 : calculatedRemaining

      // Calculate paid/remaining split for cross-month bookings (same as Dashboard)
      const checkInDateForSplit = safeDate(b.checkIn)
      const checkOutDateForSplit = safeDate(b.checkOut)
      let monthPaidUSD = bookingPaidUSD
      let monthRemainingUSD = finalRemaining
      let monthTotalUSD = bookingTotalUSD

      if (checkInDateForSplit && checkOutDateForSplit && !isNaN(checkInDateForSplit.getTime()) && !isNaN(checkOutDateForSplit.getTime())) {
        const checkInMonth = checkInDateForSplit.getMonth() + 1
        const checkInYear = checkInDateForSplit.getFullYear()
        const checkOutMonth = checkOutDateForSplit.getMonth() + 1
        const checkOutYear = checkOutDateForSplit.getFullYear()

        // IMPORTANT: For cross-month bookings, count full amounts in checkout month
        // This matches the payment methods logic where full payment is counted in checkout month
        if ((checkInMonth !== checkOutMonth || checkInYear !== checkOutYear) && !filters.showAllMonths) {
          // Check if checkout is in the selected month
          if (checkOutMonth === filters.month && checkOutYear === filters.year) {
            // Booking ends in this month - count full amounts
            monthPaidUSD = bookingPaidUSD
            monthRemainingUSD = finalRemaining
            monthTotalUSD = bookingTotalUSD
          } else {
            // Booking doesn't end in this month - don't count
            monthPaidUSD = 0
            monthRemainingUSD = 0
            monthTotalUSD = 0
          }
        }
      }

      // IMPORTANT: For completed fully-paid bookings, ensure monthRemainingUSD is 0
      if (isCompleted && finalRemaining < 0.01) {
        monthRemainingUSD = 0
      }

      // IMPORTANT: Ensure we always add something for each booking to match totalRevenue
      // If dates are invalid, use full amounts (same as totalRevenue fallback)
      // IMPORTANT: paidAmount + pendingAmount must equal totalRevenue
      // For completed bookings: paidAmount = monthPaidUSD, pendingAmount = monthRemainingUSD
      // For active/upcoming bookings: paidAmount = 0, pendingAmount = monthTotalUSD
      if (status === 'completed') {
        // Completed bookings: Add paid amount to paidAmount, remaining to pendingAmount
        paidAmount += monthPaidUSD
        // Add remaining amount to pending for completed bookings
        pendingAmount += monthRemainingUSD
      } else {
        // Active/upcoming bookings: Add full amount to pending
        // Use monthTotalUSD which is already calculated with proper splitting or full amount
        pendingAmount += monthTotalUSD
      }
    })

    // Log booking warnings if any
    if (bookingWarnings.length > 0) {
      console.warn(`[Financial] Found ${bookingWarnings.length} booking warnings:`)
      bookingWarnings.slice(0, 10).forEach(warning => console.warn(warning)) // Limit to first 10
    }

    // VALIDATION: totalRevenue should equal paidAmount + pendingAmount (with small tolerance for rounding)
    const calculatedTotal = paidAmount + pendingAmount
    const difference = Math.abs(totalRevenue - calculatedTotal)
    if (difference > 0.01) {
      console.error(`[Financial] ❌ Revenue mismatch: totalRevenue=$${totalRevenue.toFixed(2)}, paidAmount=$${paidAmount.toFixed(2)}, pendingAmount=$${pendingAmount.toFixed(2)}, calculatedTotal=$${calculatedTotal.toFixed(2)}, difference=$${difference.toFixed(2)}`)
    } else {
      console.log(`[Financial] ✅ Revenue match verified: totalRevenue=$${totalRevenue.toFixed(2)} = paidAmount=$${paidAmount.toFixed(2)} + pendingAmount=$${pendingAmount.toFixed(2)}`)
    }

    const ownerAmount = filtered.reduce((sum, b) => {
      // ownerAmount might be in USD or booking currency depending on booking version
      const { currency: bookingCurrency } = detectBookingOriginalCurrency(b, safeCurrencyRates)
      let ownerAmountUSD = 0
      if (b.ownerAmountUSD !== undefined || b.totalAmountUSD !== undefined) {
        // New format: already in USD
        ownerAmountUSD = typeof b.ownerAmount === 'number' ? b.ownerAmount : (parseFloat(b.ownerAmount || 0) || 0)
      } else {
        // Old format: might need conversion
        const ownerAmountRaw = typeof b.ownerAmount === 'number' ? b.ownerAmount : (parseFloat(b.ownerAmount || 0) || 0)
        ownerAmountUSD = convertToUSD(ownerAmountRaw, bookingCurrency)
      }
      return sum + ownerAmountUSD
    }, 0)

    const platformCommission = filtered.reduce((sum, b) => {
      // IMPORTANT: Platform commission is ONLY deducted in the checkout month
      // Check if checkout date is in the selected month
      const checkOutDate = b.checkOut ? new Date(b.checkOut) : null
      if (!checkOutDate || isNaN(checkOutDate.getTime())) return sum

      const checkoutMonth = checkOutDate.getMonth() + 1
      const checkoutYear = checkOutDate.getFullYear()
      const isCheckoutInSelectedMonth = !filters.showAllMonths && checkoutMonth === filters.month && checkoutYear === filters.year

      // Only add commission if showing all months OR checkout is in selected month
      if (filters.showAllMonths || isCheckoutInSelectedMonth) {
        // platformCommission might be in USD or booking currency depending on booking version
        const bookingCurrency = b.totalBookingPriceCurrency || b.currency || 'USD'
        let platformCommissionUSD = 0
        if (b.platformCommissionUSD !== undefined || b.totalAmountUSD !== undefined) {
          // New format: already in USD
          platformCommissionUSD = typeof b.platformCommission === 'number' ? b.platformCommission : (parseFloat(b.platformCommission || 0) || 0)
        } else {
          // Old format: might need conversion
          const platformCommissionRaw = typeof b.platformCommission === 'number' ? b.platformCommission : (parseFloat(b.platformCommission || 0) || 0)
          platformCommissionUSD = convertToUSD(platformCommissionRaw, bookingCurrency)
        }
        return sum + platformCommissionUSD
      }
      return sum
    }, 0)

    const cleaningFees = filtered.reduce((sum, b) => {
      const bookingCurrency = b.totalBookingPriceCurrency || b.currency || 'USD'
      const amountRaw = typeof b.cleaningFee === 'number' ? b.cleaningFee : parseFloat(b.cleaningFee || 0) || 0
      return sum + convertToUSD(amountRaw, bookingCurrency)
    }, 0)

    const totalNights = filtered.reduce((sum, b) => sum + (b.numberOfNights || 0), 0)

    // Calculate total expenses (convert to USD if needed)
    // Start with individual expenses
    let totalExpenses = filteredExpenses.reduce((sum, e) => {
      const amount = parseFloat(e.amount || 0)
      const expenseCurrency = e.currency || 'EGP'
      // Convert to USD for consistency
      if (expenseCurrency === 'USD') return sum + amount
      if (expenseCurrency === 'EGP') {
        const usdRate = safeCurrencyRates.USD || 50
        return sum + (amount / usdRate)
      }
      // For other currencies, use exchange rate
      const rate = safeCurrencyRates[expenseCurrency] || 50
      return sum + (amount / rate)
    }, 0)

    // Add monthly expenses from all apartments (for the selected month)
    if (!filters.showAllMonths) {
      apartments.forEach(apt => {
        // Only include if apartment is in filter or showing all
        if (filters.apartment === 'all' || (apt._id || apt.id) === filters.apartment) {
          if (apt.monthlyExpenses && Array.isArray(apt.monthlyExpenses)) {
            const monthlyTotalEGP = apt.monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
            const usdRate = safeCurrencyRates.USD || 50
            const monthlyTotalUSD = monthlyTotalEGP / usdRate
            totalExpenses += monthlyTotalUSD
          }
        }
      })
    }

    // Calculate partner earnings using Waterfall logic
    // IMPORTANT: Filter to only completed bookings for profit calculation
    const completedBookingsForWaterfall = filtered.filter(b => {
      const status = getComputedStatus(b)
      return status === 'completed'
    })

    // IMPORTANT: Pass all apartments (not just those with bookings) to ensure all partners are included
    const apartmentsForWaterfall = filters.apartment !== 'all'
      ? apartments.filter(a => (a._id || a.id) === filters.apartment)
      : apartments

    const { partnerProfits: waterfallPartnerProfits } = calculateWaterfallPartnerProfits(
      completedBookingsForWaterfall,
      apartmentsForWaterfall,
      filteredExpenses,
      safeCurrencyRates,
      convertToUSD
    )

    // Convert to partnerEarnings format for compatibility with existing UI
    const partnerEarnings = {}
    let totalPartnerAmount = 0

    // IMPORTANT: Include all partners, even those with 0 earnings
    waterfallPartnerProfits.forEach(partner => {
      const partnerKey = partner.name || partner.partnerId || 'unknown'
      // IMPORTANT: Partner amounts cannot be negative
      const partnerAmount = Math.max(0, partner.amount || 0)

      // If partner already exists, merge the data (for partners with multiple apartments)
      if (partnerEarnings[partnerKey]) {
        partnerEarnings[partnerKey].amount += partnerAmount
        partnerEarnings[partnerKey].bookings += (partner.bookingsCount || 0)
        // Keep the highest percentage if multiple
        if ((partner.percentage || 0) > (partnerEarnings[partnerKey].percentage || 0)) {
          partnerEarnings[partnerKey].percentage = partner.percentage || 0
        }
      } else {
        partnerEarnings[partnerKey] = {
          amount: partnerAmount,
          bookings: partner.bookingsCount || 0,
          percentage: partner.percentage || 0,
          type: partner.type || 'investor'
        }
      }
      totalPartnerAmount += partnerAmount
    })

    // IMPORTANT: Ensure totalPartnerAmount is never negative
    totalPartnerAmount = Math.max(0, totalPartnerAmount)

    // Calculate net profit from paid amount (only completed bookings)
    // IMPORTANT: netProfit should only be calculated from completed bookings (paidAmount)
    // not from totalRevenue which includes active/upcoming bookings
    // Recalculate platformCommission, cleaningFees, and totalPartnerAmount for completed bookings only
    let completedPlatformCommission = 0
    let completedCleaningFees = 0

    completedBookingsForWaterfall.forEach(b => {
      // Platform commission (only in checkout month)
      const checkOutDate = b.checkOut ? new Date(b.checkOut) : null
      if (!checkOutDate || isNaN(checkOutDate.getTime())) return

      const checkoutMonth = checkOutDate.getMonth() + 1
      const checkoutYear = checkOutDate.getFullYear()
      const isCheckoutInSelectedMonth = !filters.showAllMonths && checkoutMonth === filters.month && checkoutYear === filters.year

      if (filters.showAllMonths || isCheckoutInSelectedMonth) {
        const bookingCurrency = b.totalBookingPriceCurrency || b.currency || 'USD'
        let platformCommissionUSD = 0
        if (b.platformCommissionUSD !== undefined || b.totalAmountUSD !== undefined) {
          platformCommissionUSD = typeof b.platformCommission === 'number' ? b.platformCommission : (parseFloat(b.platformCommission || 0) || 0)
        } else {
          const platformCommissionRaw = typeof b.platformCommission === 'number' ? b.platformCommission : (parseFloat(b.platformCommission || 0) || 0)
          platformCommissionUSD = convertToUSD(platformCommissionRaw, bookingCurrency)
        }
        completedPlatformCommission += platformCommissionUSD

        // Cleaning fees
        const cleaningFeeRaw = typeof b.cleaningFee === 'number' ? b.cleaningFee : parseFloat(b.cleaningFee || 0) || 0
        completedCleaningFees += convertToUSD(cleaningFeeRaw, bookingCurrency)
      }
    })

    // Calculate net profit from paid amount (only completed bookings)
    const calculatedNetProfit = paidAmount - completedPlatformCommission - completedCleaningFees - totalExpenses - totalPartnerAmount

    // IMPORTANT: For display purposes, use completed values to show accurate information
    // The platformCommission and cleaningFees shown should match what was actually deducted
    // Use completedPlatformCommission and completedCleaningFees for display instead of platformCommission and cleaningFees
    const displayPlatformCommission = completedPlatformCommission
    const displayCleaningFees = completedCleaningFees

    // IMPORTANT: Calculate ownerAmount only from completed bookings for display consistency
    let displayOwnerAmount = 0
    completedBookingsForWaterfall.forEach(b => {
      const { currency: bookingCurrency } = detectBookingOriginalCurrency(b, safeCurrencyRates)
      let ownerAmountUSD = 0
      if (b.ownerAmountUSD !== undefined || b.totalAmountUSD !== undefined) {
        // New format: already in USD
        ownerAmountUSD = typeof b.ownerAmount === 'number' ? b.ownerAmount : (parseFloat(b.ownerAmount || 0) || 0)
      } else {
        // Old format: might need conversion
        const ownerAmountRaw = typeof b.ownerAmount === 'number' ? b.ownerAmount : (parseFloat(b.ownerAmount || 0) || 0)
        ownerAmountUSD = convertToUSD(ownerAmountRaw, bookingCurrency)
      }
      displayOwnerAmount += ownerAmountUSD
    })

    // Payment method breakdown
    // IMPORTANT: Handle split payments (payments array) correctly, especially for cross-month bookings
    // CRITICAL: All amounts must be aggregated directly in EGP (not USD first)
    const paymentMethods = {}
    let totalPaymentsCheck = 0 // For validation
    filtered.forEach(b => {
      // Calculate split ratio for cross-month bookings (same as revenue split)
      const checkInDateForPaymentSplit = safeDate(b.checkIn)
      const checkOutDateForPaymentSplit = safeDate(b.checkOut)
      let paymentSplitRatio = 1.0 // Default: full amount for single-month bookings

      if (checkInDateForPaymentSplit && checkOutDateForPaymentSplit && !isNaN(checkInDateForPaymentSplit.getTime()) && !isNaN(checkOutDateForPaymentSplit.getTime()) && !filters.showAllMonths) {
        const checkInMonth = checkInDateForPaymentSplit.getMonth() + 1
        const checkInYear = checkInDateForPaymentSplit.getFullYear()
        const checkOutMonth = checkOutDateForPaymentSplit.getMonth() + 1
        const checkOutYear = checkOutDateForPaymentSplit.getFullYear()

        // IMPORTANT: For cross-month bookings, count the full payment in the checkout month
        // This matches the accounting logic where revenue is recognized when the booking completes
        if ((checkInMonth !== checkOutMonth || checkInYear !== checkOutYear)) {
          // Check if checkout is in the selected month
          if (checkOutMonth === filters.month && checkOutYear === filters.year) {
            // Booking ends in this month - count full payment
            paymentSplitRatio = 1.0
          } else {
            // Booking doesn't end in this month - don't count payment
            paymentSplitRatio = 0
          }
        }
      }

      // IMPORTANT: Process payments - always use payments array if available, otherwise fallback to paidAmount
      // CRITICAL: Each payment must be converted from its original currency to EGP individually
      if (b.payments && Array.isArray(b.payments) && b.payments.length > 0) {
        // Process each payment separately, converting each to EGP based on its currency
        b.payments.forEach(payment => {
          if (payment && payment.method && payment.amount) {
            const method = payment.method
            const paymentAmount = typeof payment.amount === 'number' ? payment.amount : (parseFloat(payment.amount || 0) || 0)

            // CRITICAL: Smart currency detection for old data
            // PROBLEM: Old data may have EGP amounts stored with currency='USD'
            // EXAMPLE: payment.amount=746, payment.currency='USD' (WRONG - should be EGP)
            // SOLUTION: Always validate amount against declared currency

            // IMPORTANT: Use locked exchange rate from booking if available
            const lockedRates = b.exchangeRateAtBooking || {}
            const usdRate = lockedRates.USD || safeCurrencyRates.USD || 50

            let originalPaymentCurrency = (payment.currency && payment.currency.trim() !== '') ? payment.currency : null

            // CRITICAL: Validate currency - if amount is large and currency is USD, it's likely EGP
            // PROBLEM: Old data has EGP amounts (746, 9802) stored with currency='USD'
            // SOLUTION: If amount > 50, always treat as EGP (not USD)
            if (!originalPaymentCurrency || originalPaymentCurrency === 'USD') {
              // Real USD payments: 15.80, 30.13, 84.73, 207.64 (small numbers, typically < 50)
              // Real EGP payments: 746, 9802, 4000, 3000 (large numbers, typically > 50)

              if (paymentAmount > 50) {
                // Large amount (> 50) = definitely EGP, not USD
                // Even if currency='USD' in database, treat as EGP
                originalPaymentCurrency = 'EGP'
              } else if (paymentAmount < 1) {
                // Very small amount (< 1) = likely USD
                originalPaymentCurrency = 'USD'
              } else {
                // Medium amount (1-50): check booking currency
                const { currency: bookingCurrency } = detectBookingOriginalCurrency(b, safeCurrencyRates)
                originalPaymentCurrency = bookingCurrency || 'EGP'
              }
            }

            // CRITICAL: Convert ALL payments to EGP regardless of original currency
            // Even if customer paid in USD, we aggregate everything in EGP
            // This is the requirement: all payments
            let normalizedMethod = payment.method || 'unknown'
            const lowerMethod = normalizedMethod.toLowerCase().trim()
            if (lowerMethod.includes('vodafone') || lowerMethod.includes('فودافون')) normalizedMethod = 'Vodafone Cash'
            else if (lowerMethod.includes('visa') || lowerMethod.includes('credit') || lowerMethod.includes('card') || lowerMethod.includes('فيزا')) normalizedMethod = 'Visa'
            else if (lowerMethod.includes('insta') || lowerMethod.includes('انستا')) normalizedMethod = 'InstaPay'
            else if (lowerMethod === 'cash' || lowerMethod === 'كاش' || lowerMethod === 'نقد') normalizedMethod = 'Cash'
            else if (lowerMethod.includes('bank') || lowerMethod.includes('بنك')) normalizedMethod = 'Bank Transfer'

            let paymentInEGP = 0

            if (!originalPaymentCurrency || originalPaymentCurrency === 'EGP') {
              // Already in EGP, use directly (no conversion needed)
              paymentInEGP = paymentAmount
            } else if (originalPaymentCurrency === 'USD') {
              // Convert USD to EGP using locked rate (exchangeRateAtBooking)
              // IMPORTANT: Even if customer paid in USD, convert to EGP for aggregation
              paymentInEGP = paymentAmount * usdRate
            } else {
              // Convert other currencies (EUR, GBP, etc.) to EGP using locked rates
              // For other currencies, currencyRate is rateToEGP (e.g., EUR: 54 means 1 EUR = 54 EGP)
              const currencyRate = lockedRates[originalPaymentCurrency] || safeCurrencyRates[originalPaymentCurrency] || usdRate
              paymentInEGP = paymentAmount * currencyRate
            }

            // IMPORTANT: Apply split ratio for cross-month bookings (after converting to EGP)
            const splitPaymentInEGP = paymentInEGP * paymentSplitRatio

            // #region agent log
            // #region agent log
            // console.log(`[DEBUG Payment] Booking ${b._id}: method=${normalizedMethod}...`)
            // #endregion

            if (!paymentMethods[normalizedMethod]) paymentMethods[normalizedMethod] = 0
            paymentMethods[normalizedMethod] += splitPaymentInEGP
            totalPaymentsCheck += splitPaymentInEGP
          }
        })
      } else {
        // Fallback: use single paymentMethod and paidAmount
        // CRITICAL: For old bookings without payments array, we need to reconstruct payment info
        // paidAmount is stored in USD in the database, but original payment was in bookingCurrency
        const method = b.paymentMethod || 'unknown'
        const { currency: bookingCurrency } = detectBookingOriginalCurrency(b, safeCurrencyRates)
        const lockedRates = b.exchangeRateAtBooking || {}
        const usdRate = lockedRates.USD || safeCurrencyRates.USD || 50

        // IMPORTANT: Get paid amount correctly
        // If booking has payments array but we're in fallback (shouldn't happen, but safe guard)
        let paidInEGP = 0

        // Check if booking actually has payments array (shouldn't reach here if it does)
        if (b.payments && Array.isArray(b.payments) && b.payments.length > 0) {
          // This shouldn't happen, but if it does, process payments
          b.payments.forEach(payment => {
            if (payment && payment.amount) {
              const paymentAmount = typeof payment.amount === 'number' ? payment.amount : (parseFloat(payment.amount || 0) || 0)

              // CRITICAL: Auto-detect currency for old data (same logic as above)
              let originalPaymentCurrency = (payment.currency && payment.currency.trim() !== '') ? payment.currency : null
              if (!originalPaymentCurrency || originalPaymentCurrency === 'USD') {
                if (paymentAmount > 50) {
                  originalPaymentCurrency = 'EGP'
                } else if (paymentAmount < 1) {
                  originalPaymentCurrency = 'USD'
                } else {
                  originalPaymentCurrency = bookingCurrency || 'EGP'
                }
              }

              // CRITICAL: Convert ALL payments to EGP regardless of original currency
              // Even if customer paid in USD, convert to EGP for aggregation
              if (originalPaymentCurrency === 'EGP') {
                paidInEGP += paymentAmount
              } else if (originalPaymentCurrency === 'USD') {
                // Convert USD to EGP using locked rate
                paidInEGP += paymentAmount * usdRate
              } else {
                // Convert other currencies to EGP
                const currencyRate = lockedRates[originalPaymentCurrency] || safeCurrencyRates[originalPaymentCurrency] || usdRate
                paidInEGP += paymentAmount * currencyRate
              }
            }
          })
        } else {
          // No payments array - use paidAmount
          // IMPORTANT: paidAmount is stored in USD, but original payment was in bookingCurrency
          // We need to convert it back to EGP
          const paidInUSD = getBookingPaidAmountInUSD(b, safeCurrencyRates)

          // Convert from USD to EGP using locked rate
          // This reconstructs the original payment amount in EGP
          paidInEGP = paidInUSD * usdRate
        }

        // IMPORTANT: Apply split ratio for cross-month bookings (after converting to EGP)
        const splitPaidInEGP = paidInEGP * paymentSplitRatio
        if (!paymentMethods[method]) paymentMethods[method] = 0
        paymentMethods[method] += splitPaidInEGP
        totalPaymentsCheck += splitPaidInEGP
      }
    })

    // Validation: Log payment methods summary for debugging
    // IMPORTANT: paidAmount is in USD, convert to EGP for comparison
    const totalPaidInEGP = paidAmount * (safeCurrencyRates.USD || 50)

    // #region agent log
    console.log('[DEBUG Summary] Payment Methods Breakdown:', {
      instapay: paymentMethods.instapay || 0,
      cash: paymentMethods.cash || 0,
      visa: paymentMethods.visa || 0,
      vodafone: paymentMethods.vodafone || 0,
      totalFromPayments: totalPaymentsCheck,
      paidAmountUSD: paidAmount,
      paidAmountEGP: totalPaidInEGP,
      difference: Math.abs(totalPaymentsCheck - totalPaidInEGP),
      exchangeRate: safeCurrencyRates.USD || 50
    })
    // #endregion

    console.log('[Financial] 💳 Payment Methods Summary (EGP):', {
      instapay: paymentMethods.instapay || 0,
      cash: paymentMethods.cash || 0,
      visa: paymentMethods.visa || 0,
      vodafone: paymentMethods.vodafone || 0,
      totalCalculated: totalPaymentsCheck,
      totalPaidAmountInEGP: totalPaidInEGP,
      difference: Math.abs(totalPaymentsCheck - totalPaidInEGP),
      bookingsProcessed: filtered.length
    })

    // Additional validation: Check if totals match
    if (Math.abs(totalPaymentsCheck - totalPaidInEGP) > 1) {
      console.warn(`[Financial] ⚠️ Payment methods total (${totalPaymentsCheck.toFixed(2)} EGP) doesn't match paid amount (${totalPaidInEGP.toFixed(2)} EGP). Difference: ${Math.abs(totalPaymentsCheck - totalPaidInEGP).toFixed(2)} EGP`)
    }

    // Platform breakdown
    const platforms = {}
    filtered.forEach(b => {
      const platform = b.platform || 'direct'
      if (!platforms[platform]) platforms[platform] = { revenue: 0, commission: 0, count: 0 }
      platforms[platform].revenue += b.totalBookingPrice || b.totalAmountUSD || b.totalAmount || 0
      platforms[platform].commission += b.platformCommission || 0
      platforms[platform].count += 1
    })

    // Apartment breakdown (with expenses)
    // Initialize apartment stats for all apartments (even without bookings)
    const apartmentStats = {}

    // First, collect all relevant apartment IDs
    const relevantApartmentIds = new Set()

    // Add apartments from bookings
    filtered.forEach(b => {
      const aptId = b.apartment?._id || b.apartment?.id || b.apartment
      if (aptId) relevantApartmentIds.add(aptId)
    })

    // Add apartments from expenses
    filteredExpenses.forEach(e => {
      const expenseAptId = e.apartment?._id || e.apartment?.id || e.apartment
      if (expenseAptId) relevantApartmentIds.add(expenseAptId)
    })

    // If apartment filter is set, only show that apartment
    if (filters.apartment !== 'all') {
      relevantApartmentIds.clear()
      relevantApartmentIds.add(filters.apartment)
    }

    // Initialize stats for all relevant apartments
    relevantApartmentIds.forEach(aptId => {
      const apt = apartments.find(a => (a._id || a.id) === aptId)
      if (apt) {
        const aptName = apt.name || 'غير محدد'
        if (!apartmentStats[aptName]) {
          apartmentStats[aptName] = {
            revenue: 0,
            profit: 0,
            bookings: 0,
            nights: 0,
            expenses: 0,
            monthlyExpenses: 0,
            individualExpenses: 0,
            netProfit: 0
          }
        }
      }
    })

    // Add booking data
    filtered.forEach(b => {
      const aptId = b.apartment?._id || b.apartment?.id || b.apartment
      const apt = apartments.find(a => (a._id || a.id) === aptId)
      const aptName = apt?.name || b.apartmentName || 'غير محدد'

      if (!apartmentStats[aptName]) {
        apartmentStats[aptName] = {
          revenue: 0,
          profit: 0,
          bookings: 0,
          nights: 0,
          expenses: 0,
          monthlyExpenses: 0,
          individualExpenses: 0,
          netProfit: 0
        }
      }

      apartmentStats[aptName].revenue += b.totalBookingPrice || b.totalAmountUSD || b.totalAmount || 0
      apartmentStats[aptName].profit += b.brokerProfit || 0
      apartmentStats[aptName].bookings += 1
      apartmentStats[aptName].nights += b.numberOfNights || 0
    })

    // Add expenses to apartment stats
    filteredExpenses.forEach(e => {
      const expenseAptId = e.apartment?._id || e.apartment?.id || e.apartment
      const apt = apartments.find(a => (a._id || a.id) === expenseAptId)
      const aptName = apt?.name || 'غير محدد'

      // Initialize if not exists
      if (!apartmentStats[aptName]) {
        apartmentStats[aptName] = {
          revenue: 0,
          profit: 0,
          bookings: 0,
          nights: 0,
          expenses: 0,
          monthlyExpenses: 0,
          individualExpenses: 0,
          netProfit: 0
        }
      }

      const amount = parseFloat(e.amount || 0)
      const expenseCurrency = e.currency || 'EGP'
      let expenseInUSD = amount
      if (expenseCurrency === 'EGP') {
        const usdRate = safeCurrencyRates.USD || 50
        expenseInUSD = amount / usdRate
      } else if (expenseCurrency !== 'USD') {
        const rate = safeCurrencyRates[expenseCurrency] || 50
        expenseInUSD = amount / rate
      }
      apartmentStats[aptName].individualExpenses += expenseInUSD
      apartmentStats[aptName].expenses += expenseInUSD
    })

    // Add monthly expenses from apartments
    apartments.forEach(apt => {
      const aptName = apt?.name || 'غير محدد'

      // Only include if apartment is in relevant list or showing all apartments
      if (filters.apartment === 'all' || (apt._id || apt.id) === filters.apartment) {
        // Initialize if not exists
        if (!apartmentStats[aptName]) {
          apartmentStats[aptName] = {
            revenue: 0,
            profit: 0,
            bookings: 0,
            nights: 0,
            expenses: 0,
            monthlyExpenses: 0,
            individualExpenses: 0,
            netProfit: 0
          }
        }

        // Calculate monthly expenses for the selected month/year
        if (apt.monthlyExpenses && Array.isArray(apt.monthlyExpenses)) {
          const monthlyTotalEGP = apt.monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
          const usdRate = safeCurrencyRates.USD || 50
          const monthlyTotalUSD = monthlyTotalEGP / usdRate
          apartmentStats[aptName].monthlyExpenses += monthlyTotalUSD
          apartmentStats[aptName].expenses += monthlyTotalUSD
        }
      }
    })

    // Calculate net profit for all apartments
    Object.keys(apartmentStats).forEach(aptName => {
      apartmentStats[aptName].netProfit = apartmentStats[aptName].profit - apartmentStats[aptName].expenses
    })

    return {
      totalBookings: filtered.length,
      totalRevenue,
      paidAmount,
      pendingAmount,
      ownerAmount: displayOwnerAmount, // نصيب المالك (من الحجوزات المكتملة فقط)
      totalPartnerAmount, // إجمالي نصيب الشركاء
      platformCommission: displayPlatformCommission, // عمولة المنصات (من الحجوزات المكتملة فقط)
      cleaningFees: displayCleaningFees, // رسوم التنظيف (من الحجوزات المكتملة فقط)
      totalExpenses, // إجمالي المصروفات
      brokerProfit: calculatedNetProfit, // صافي الربح بعد خصم المصروفات (محسوب بشكل صحيح)
      totalNights,
      partnerEarnings,
      paymentMethods,
      platforms,
      apartmentStats,
      bookings: filtered,
      expenses: filteredExpenses
    }
  }

  const summary = calculateSummary()

  const formatMoney = (amount, isAlreadyInEGP = false) => {
    const safeAmount = amount || 0
    // IMPORTANT: Use currencyRates from state, not safeCurrencyRates (which is only in calculateSummary scope)
    const safeRates = currencyRates || { USD: 50, EUR: 54, GBP: 63, AED: 13.6, SAR: 13.3 }
    const usdRate = safeRates.USD || 50

    if (currency === 'EGP') {
      // If amount is already in EGP (e.g., paymentMethods), use directly
      if (isAlreadyInEGP) {
        return `${safeAmount.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
      }
      // Otherwise, convert USD amount to EGP for display
      const amountInEGP = safeAmount * usdRate
      return `${amountInEGP.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
    }
    // For USD display
    // If amount is already in EGP, convert to USD first
    if (isAlreadyInEGP) {
      const amountInUSD = safeAmount / usdRate
      return `$${amountInUSD.toFixed(2)}`
    }
    return `$${safeAmount.toFixed(2)}`
  }

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: '💵 نقدي',
      visa: '💳 فيزا',
      instapay: '📱 انستاباي',
      vodafone: '📞 فودافون كاش',
      unknown: '❓ غير محدد'
    }
    return labels[method] || method
  }

  const getPlatformLabel = (platform) => {
    const labels = {
      'booking.com': '🅱️ Booking.com',
      'airbnb': '🏠 Airbnb',
      'direct': '📞 مباشر',
      'other': '🔗 أخرى'
    }
    return labels[platform] || platform
  }

  const getStatusLabel = (status) => {
    const labels = {
      confirmed: '✅ مؤكد',
      completed: '✔️ مكتمل',
      cancelled: '❌ ملغي',
      pending: '⏳ معلق'
    }
    return labels[status] || status
  }

  // Print monthly report
  const handlePrintReport = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-500">جاري التحميل...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl lg:text-5xl font-bold text-booking-blue flex items-center gap-3 mb-6">
          💰 التقارير المالية
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrency(currency === 'USD' ? 'EGP' : 'USD')}
            className="bg-booking-blue text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700"
          >
            {currency === 'USD' ? '$ → ج.م' : 'ج.م → $'}
          </button>
          <button
            onClick={() => setShowMonthlyReport(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"
          >
            📊 تقرير الشهر
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg p-6 mb-6"
      >
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          🔍 الفلاتر والتصفية
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Show All Months Toggle */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showAllMonths}
                onChange={(e) => setFilters({ ...filters, showAllMonths: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <span className="font-medium">عرض كل الشهور</span>
            </label>
          </div>

          {/* Month */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الشهر</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
              disabled={filters.showAllMonths}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue disabled:bg-gray-100"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">السنة</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
              disabled={filters.showAllMonths}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue disabled:bg-gray-100"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Apartment */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الشقة</label>
            <select
              value={filters.apartment}
              onChange={(e) => setFilters({ ...filters, apartment: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue"
            >
              <option value="all">جميع الشقق</option>
              {apartments.map(apt => (
                <option key={apt._id} value={apt._id}>{apt.name}</option>
              ))}
            </select>
          </div>

          {/* Partner - Admin Only */}
          {canViewPartnerShares(userRole) && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">الشريك</label>
              <select
                value={filters.partner}
                onChange={(e) => setFilters({ ...filters, partner: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue"
              >
                <option value="all">جميع الشركاء</option>
                {partners.map(partner => (
                  <option key={partner._id} value={partner._id}>{partner.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الحالة</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue"
            >
              <option value="all">الكل</option>
              <option value="confirmed">مؤكد</option>
              <option value="completed">مكتمل</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">طريقة الدفع</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue"
            >
              <option value="all">الكل</option>
              <option value="cash">💵 نقدي</option>
              <option value="visa">💳 فيزا</option>
              <option value="instapay">📱 انستاباي</option>
              <option value="vodafone">📞 فودافون كاش</option>
            </select>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المنصة</label>
            <select
              value={filters.platform}
              onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue"
            >
              <option value="all">الكل</option>
              <option value="booking.com">Booking.com</option>
              <option value="airbnb">Airbnb</option>
              <option value="direct">مباشر</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">من تاريخ</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-booking-blue"
            />
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                apartment: 'all',
                partner: 'all',
                status: 'all',
                paymentMethod: 'all',
                platform: 'all',
                dateFrom: '',
                dateTo: '',
                showAllMonths: false,
              })}
              className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300"
            >
              🔄 إعادة تعيين
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { id: 'overview', label: '📊 نظرة عامة' },
          { id: 'apartments', label: '🏠 الشقق' },
          ...(canViewPartnerShares(userRole) ? [{ id: 'partners', label: '🤝 الشركاء' }] : []),
          { id: 'platforms', label: '🌐 المنصات' },
          { id: 'payments', label: '💳 المدفوعات' },
          { id: 'bookings', label: '📅 الحجوزات' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${activeTab === tab.id
              ? 'bg-booking-blue text-white shadow-lg'
              : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-lg p-5">
              <div className="text-gray-500 text-sm mb-1">إجمالي الإيرادات</div>
              <div className="text-2xl font-black text-booking-blue">{formatMoney(summary.totalRevenue)}</div>
              <div className="text-xs text-gray-400">{summary.totalBookings} حجز</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-5">
              <div className="text-gray-500 text-sm mb-1">المبلغ المحصّل</div>
              <div className="text-2xl font-black text-green-600">{formatMoney(summary.paidAmount)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-5">
              <div className="text-gray-500 text-sm mb-1">المبلغ المعلق</div>
              <div className="text-2xl font-black text-orange-500">{formatMoney(summary.pendingAmount)}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-5 text-white">
              <div className="text-green-100 text-sm mb-1">صافي ربحك 💰</div>
              <div className="text-2xl font-black">{formatMoney(summary.brokerProfit)}</div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📊 توزيع الإيرادات</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span>💵 إجمالي الإيرادات</span>
                  <span className="font-bold">{formatMoney(summary.totalRevenue)}</span>
                </div>
                {canViewPartnerShares(userRole) && (
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span>🤝 نصيب الشركاء</span>
                    <span className="font-bold text-purple-600">{formatMoney(Math.max(0, summary.totalPartnerAmount || 0))}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span>🌐 عمولة المنصات</span>
                  <span className="font-bold text-red-600">-{formatMoney(summary.platformCommission)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span>🧹 رسوم التنظيف</span>
                  <span className="font-bold text-orange-600">-{formatMoney(summary.cleaningFees)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span>📋 المصروفات</span>
                  <span className="font-bold text-red-600">-{formatMoney(summary.totalExpenses || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg border-2 border-green-400">
                  <span className="font-bold">💰 صافي ربحك</span>
                  <span className="font-black text-green-600 text-xl">{formatMoney(summary.brokerProfit)}</span>
                </div>
              </div>
            </div>

            {/* Partner Earnings - Admin Only */}
            {canViewPartnerShares(userRole) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">🤝 أرباح الشركاء</h3>
                {summary.partnerEarnings && Object.keys(summary.partnerEarnings).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(summary.partnerEarnings).map(([name, data]) => (
                      <div key={name || 'unknown'} className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                        <div>
                          <span className="font-medium">{name || 'شريك'}</span>
                          <span className="text-sm text-purple-600 mr-2">({data.percentage || 0}%)</span>
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-purple-600">{formatMoney(Math.max(0, data.amount || 0))}</div>
                          <div className="text-xs text-gray-500">{data.bookings || 0} حجز</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">لا يوجد شركاء في هذه الفترة</div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Apartments Tab */}
      {activeTab === 'apartments' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">🏠 إحصائيات الشقق</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-right">الشقة</th>
                    <th className="px-4 py-3 text-right">الحجوزات</th>
                    <th className="px-4 py-3 text-right">الليالي</th>
                    <th className="px-4 py-3 text-right">الإيرادات</th>
                    <th className="px-4 py-3 text-right">المصروفات</th>
                    <th className="px-4 py-3 text-right">صافي الربح</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.apartmentStats).map(([name, stats]) => (
                    <tr key={name} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="px-4 py-3">{stats.bookings}</td>
                      <td className="px-4 py-3">{stats.nights} ليلة</td>
                      <td className="px-4 py-3 font-bold text-blue-600">{formatMoney(stats.revenue)}</td>
                      <td className="px-4 py-3 font-bold text-red-600">-{formatMoney(stats.expenses || 0)}</td>
                      <td className="px-4 py-3 font-bold text-green-600">{formatMoney(stats.netProfit !== undefined ? stats.netProfit : stats.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Expenses per Apartment */}
          {!filters.showAllMonths && (
            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl shadow-lg p-6 border-2 border-red-200">
              <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                <span>💰</span>
                مصروفات الشقق في {months[filters.month - 1].label} {filters.year}
              </h3>
              <div className="space-y-4">
                {Object.entries(summary.apartmentStats)
                  .filter(([name, stats]) => (stats.monthlyExpenses || 0) > 0 || (stats.individualExpenses || 0) > 0)
                  .map(([name, stats]) => {
                    const monthlyExpenses = stats.monthlyExpenses || 0
                    const individualExpenses = stats.individualExpenses || 0
                    const totalExpenses = monthlyExpenses + individualExpenses

                    return (
                      <div key={name} className="bg-white rounded-lg p-4 border-r-4 border-red-400">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-lg text-gray-800">{name}</h4>
                          <span className="font-bold text-red-700 text-xl">
                            {formatMoney(totalExpenses)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-red-50 p-3 rounded-lg">
                            <div className="text-gray-600 mb-1">💸 المصاريف الشهرية</div>
                            <div className="font-bold text-red-600">{formatMoney(monthlyExpenses)}</div>
                          </div>
                          <div className="bg-orange-50 p-3 rounded-lg">
                            <div className="text-gray-600 mb-1">📋 المصروفات الفردية</div>
                            <div className="font-bold text-orange-600">{formatMoney(individualExpenses)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                {Object.entries(summary.apartmentStats)
                  .filter(([name, stats]) => (stats.monthlyExpenses || 0) > 0 || (stats.individualExpenses || 0) > 0)
                  .length === 0 && (
                    <div className="text-center py-8 text-gray-500 bg-white rounded-lg">
                      لا توجد مصروفات مسجلة للشقق في هذا الشهر
                    </div>
                  )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Platforms Tab */}
      {activeTab === 'platforms' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🌐 إحصائيات المنصات</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(summary.platforms).map(([platform, stats]) => (
              <div key={platform} className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
                <div className="text-2xl mb-2">{getPlatformLabel(platform)}</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">عدد الحجوزات:</span>
                    <span className="font-bold">{stats.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">الإيرادات:</span>
                    <span className="font-bold text-blue-600">{formatMoney(stats.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">العمولة:</span>
                    <span className="font-bold text-red-500">-{formatMoney(stats.commission)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">💳 توزيع طرق الدفع</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(summary.paymentMethods).map(([method, amount]) => (
              <div key={method} className="bg-green-50 rounded-xl p-5 border-2 border-green-200 text-center">
                <div className="text-2xl mb-2">{getPaymentMethodLabel(method)}</div>
                <div className="font-black text-xl text-green-600">{formatMoney(amount, true)}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Partners Tab - Admin Only */}
      {activeTab === 'partners' && canViewPartnerShares(userRole) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🤝 أرباح الشركاء</h3>
          {summary.partnerEarnings && Object.keys(summary.partnerEarnings).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(summary.partnerEarnings).map(([name, data]) => (
                <div key={name || 'unknown'} className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                  <div>
                    <span className="font-bold text-lg">{name || 'شريك'}</span>
                    <span className="text-sm text-purple-600 mr-2">({data.percentage || 0}%)</span>
                    <div className="text-xs text-gray-500 mt-1">{data.bookings || 0} حجز</div>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-purple-600 text-xl">{formatMoney(Math.max(0, data.amount || 0))}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-4">🤝</div>
              <div className="text-lg">لا يوجد شركاء في هذه الفترة</div>
            </div>
          )}
        </motion.div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📅 تفاصيل الحجوزات ({summary.bookings.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-booking-blue text-white">
                <tr>
                  <th className="px-3 py-2 text-right">الضيف</th>
                  <th className="px-3 py-2 text-right">الشقة</th>
                  <th className="px-3 py-2 text-right">التواريخ</th>
                  <th className="px-3 py-2 text-right">الليالي</th>
                  <th className="px-3 py-2 text-right">الإجمالي</th>
                  <th className="px-3 py-2 text-right">المدفوع</th>
                  <th className="px-3 py-2 text-right">المتبقي</th>
                  <th className="px-3 py-2 text-right">طريقة الدفع</th>
                  <th className="px-3 py-2 text-right">ربحك</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {summary.bookings.map((booking, idx) => (
                  <tr key={booking._id} className={`border-b ${idx % 2 === 0 ? 'bg-gray-50' : ''}`}>
                    <td className="px-3 py-2 font-medium">{booking.guestName}</td>
                    <td className="px-3 py-2">{booking.apartmentName}</td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(booking.checkIn)} →
                      {formatDate(booking.checkOut)}
                    </td>
                    <td className="px-3 py-2">{booking.numberOfNights}</td>
                    <td className="px-3 py-2 font-bold">{formatMoney(getBookingAmountInUSD(booking, safeCurrencyRates))}</td>
                    <td className="px-3 py-2 text-green-600">
                      {(() => {
                        const totalUSD = getBookingAmountInUSD(booking, safeCurrencyRates)
                        let paidUSD = getBookingPaidAmountInUSD(booking, safeCurrencyRates)
                        if (paidUSD > totalUSD && totalUSD > 0) {
                          paidUSD = totalUSD
                        }
                        return formatMoney(paidUSD)
                      })()}
                    </td>
                    <td className="px-3 py-2 text-orange-500">
                      {(() => {
                        const totalUSD = getBookingAmountInUSD(booking, safeCurrencyRates)
                        let paidUSD = getBookingPaidAmountInUSD(booking, safeCurrencyRates)
                        if (paidUSD > totalUSD && totalUSD > 0) {
                          paidUSD = totalUSD
                        }
                        let remainingUSD = Math.max(0, totalUSD - paidUSD)
                        const status = getComputedStatus(booking)
                        const isCompleted = status === 'completed'
                        if (isCompleted && remainingUSD < 0.01) {
                          remainingUSD = 0
                          return '-'  // لا نعرض المتبقي للحجوزات المكتملة والمدفوعة بالكامل
                        }
                        return formatMoney(remainingUSD)
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        // Calculate split ratio for cross-month bookings
                        const checkInDateForDisplay = safeDate(booking.checkIn)
                        const checkOutDateForDisplay = safeDate(booking.checkOut)
                        let paymentSplitRatio = 1.0

                        if (checkInDateForDisplay && checkOutDateForDisplay && !isNaN(checkInDateForDisplay.getTime()) && !isNaN(checkOutDateForDisplay.getTime()) && !filters.showAllMonths) {
                          const checkInMonth = checkInDateForDisplay.getMonth() + 1
                          const checkInYear = checkInDateForDisplay.getFullYear()
                          const checkOutMonth = checkOutDateForDisplay.getMonth() + 1
                          const checkOutYear = checkOutDateForDisplay.getFullYear()

                          if ((checkInMonth !== checkOutMonth || checkInYear !== checkOutYear) && booking.numberOfNights > 0) {
                            const totalNights = booking.numberOfNights || 1
                            const monthStart = new Date(filters.year, filters.month - 1, 1)
                            const monthEnd = new Date(filters.year, filters.month, 0, 23, 59, 59, 999)
                            monthStart.setHours(0, 0, 0, 0)

                            let nightsInSelectedMonth = 0
                            let currentDate = new Date(checkInDateForDisplay)
                            currentDate.setHours(0, 0, 0, 0)
                            const endDate = new Date(checkOutDateForDisplay)
                            endDate.setHours(0, 0, 0, 0)

                            while (currentDate < endDate) {
                              const currentMonth = currentDate.getMonth() + 1
                              const currentYear = currentDate.getFullYear()
                              if (currentMonth === filters.month && currentYear === filters.year) {
                                nightsInSelectedMonth++
                              }
                              currentDate.setDate(currentDate.getDate() + 1)
                            }

                            paymentSplitRatio = nightsInSelectedMonth / totalNights
                          }
                        }

                        // IMPORTANT: Use locked exchange rates from booking if available
                        const lockedRates = booking.exchangeRateAtBooking || {}
                        const usdRate = lockedRates.USD || safeCurrencyRates.USD || 50

                        if (booking.payments && Array.isArray(booking.payments) && booking.payments.length > 1) {
                          return (
                            <div className="text-xs space-y-1">
                              {booking.payments.map((p, idx) => {
                                const paymentAmount = typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount || 0) || 0)
                                const paymentCurrency = p.currency || 'USD'

                                // Convert payment amount to USD using locked rates if available
                                let paymentInUSD = paymentAmount
                                if (paymentCurrency === 'EGP') {
                                  paymentInUSD = paymentAmount / usdRate
                                } else if (paymentCurrency !== 'USD') {
                                  const currencyRate = lockedRates[paymentCurrency] || safeCurrencyRates[paymentCurrency] || safeCurrencyRates.USD || 50
                                  paymentInUSD = (paymentAmount * currencyRate) / usdRate
                                }

                                // IMPORTANT: Apply split ratio for cross-month bookings
                                const splitPaymentInUSD = paymentInUSD * paymentSplitRatio

                                return (
                                  <div key={idx}>{getPaymentMethodLabel(p.method || 'unknown')}: {formatMoney(splitPaymentInUSD)}</div>
                                )
                              })}
                            </div>
                          )
                        } else {
                          return getPaymentMethodLabel(booking.paymentMethod || (booking.payments && booking.payments.length > 0 ? booking.payments[0].method : 'unknown'))
                        }
                      })()}
                    </td>
                    <td className="px-3 py-2 font-bold text-green-600">{formatMoney(booking.brokerProfit || 0)}</td>
                    <td className="px-3 py-2">{getStatusLabel(booking.status)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-200 font-bold">
                <tr>
                  <td colSpan="4" className="px-3 py-2">الإجمالي</td>
                  <td className="px-3 py-2">{formatMoney(summary.totalRevenue)}</td>
                  <td className="px-3 py-2 text-green-600">{formatMoney(summary.paidAmount)}</td>
                  <td className="px-3 py-2 text-orange-500">{formatMoney(summary.pendingAmount)}</td>
                  <td></td>
                  <td className="px-3 py-2 text-green-600">{formatMoney(summary.brokerProfit)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      )}

      {/* Monthly Report Modal */}
      <AnimatePresence>
        {showMonthlyReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setShowMonthlyReport(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full"
              onClick={e => e.stopPropagation()}
            >
              {/* Report Header */}
              <div className="text-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-booking-blue">📊 تقرير شهر {months[filters.month - 1].label} {filters.year}</h2>
                <p className="text-gray-500 mt-1">HOSTEL MASR - نظام إدارة الحجوزات</p>
                <p className="text-sm text-gray-400">تاريخ التقرير: {formatDate(new Date())}</p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-blue-600">{summary.totalBookings}</div>
                  <div className="text-sm text-gray-600">حجز</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-purple-600">{summary.totalNights}</div>
                  <div className="text-sm text-gray-600">ليلة</div>
                </div>
                <div className="bg-green-50 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-green-600">{formatMoney(summary.totalRevenue)}</div>
                  <div className="text-sm text-gray-600">إجمالي الإيرادات</div>
                </div>
                <div className="bg-gradient-to-br from-green-400 to-green-500 p-4 rounded-xl text-center text-white">
                  <div className="text-2xl font-bold">{formatMoney(summary.brokerProfit)}</div>
                  <div className="text-sm">صافي ربحك</div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-bold text-lg mb-3">💰 الملخص المالي</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between"><span>إجمالي الإيرادات:</span><span className="font-bold">{formatMoney(summary.totalRevenue)}</span></div>
                    <div className="flex justify-between"><span>المحصّل:</span><span className="font-bold text-green-600">{formatMoney(summary.paidAmount)}</span></div>
                    <div className="flex justify-between"><span>المعلق:</span><span className="font-bold text-orange-500">{formatMoney(summary.pendingAmount)}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span>نصيب الشركاء:</span><span className="font-bold text-purple-600">{formatMoney(summary.totalPartnerAmount || 0)}</span></div>
                    <div className="flex justify-between"><span>عمولة المنصات:</span><span className="font-bold text-red-500">{formatMoney(summary.platformCommission)}</span></div>
                    <div className="flex justify-between"><span>رسوم التنظيف:</span><span className="font-bold text-orange-500">{formatMoney(summary.cleaningFees)}</span></div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t-2 border-green-400">
                  <div className="flex justify-between text-lg">
                    <span className="font-bold">صافي ربحك:</span>
                    <span className="font-black text-green-600 text-xl">{formatMoney(summary.brokerProfit)}</span>
                  </div>
                </div>
              </div>

              {/* Apartments Summary */}
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3">🏠 ملخص الشقق</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-right">الشقة</th>
                      <th className="px-3 py-2 text-right">الحجوزات</th>
                      <th className="px-3 py-2 text-right">الليالي</th>
                      <th className="px-3 py-2 text-right">الإيرادات</th>
                      <th className="px-3 py-2 text-right">ربحك</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.apartmentStats).map(([name, stats]) => (
                      <tr key={name} className="border-b">
                        <td className="px-3 py-2">{name}</td>
                        <td className="px-3 py-2">{stats.bookings}</td>
                        <td className="px-3 py-2">{stats.nights}</td>
                        <td className="px-3 py-2">{formatMoney(stats.revenue)}</td>
                        <td className="px-3 py-2 text-green-600">{formatMoney(stats.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Monthly Expenses per Apartment */}
              {Object.entries(summary.apartmentStats)
                .filter(([name, stats]) => (stats.monthlyExpenses || 0) > 0 || (stats.individualExpenses || 0) > 0)
                .length > 0 && (
                  <div className="mb-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border-2 border-red-200">
                    <h3 className="font-bold text-lg mb-3 text-red-800">💰 مصروفات الشقق</h3>
                    <div className="space-y-3">
                      {Object.entries(summary.apartmentStats)
                        .filter(([name, stats]) => (stats.monthlyExpenses || 0) > 0 || (stats.individualExpenses || 0) > 0)
                        .map(([name, stats]) => {
                          const monthlyExpenses = stats.monthlyExpenses || 0
                          const individualExpenses = stats.individualExpenses || 0
                          const totalExpenses = monthlyExpenses + individualExpenses

                          return (
                            <div key={name} className="bg-white rounded-lg p-3 border-r-4 border-red-400">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-gray-800">{name}</h4>
                                <span className="font-bold text-red-700">{formatMoney(totalExpenses)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-red-50 p-2 rounded">
                                  <div className="text-gray-600">المصاريف الشهرية</div>
                                  <div className="font-bold text-red-600">{formatMoney(monthlyExpenses)}</div>
                                </div>
                                <div className="bg-orange-50 p-2 rounded">
                                  <div className="text-gray-600">المصروفات الفردية</div>
                                  <div className="font-bold text-orange-600">{formatMoney(individualExpenses)}</div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

              {/* Payment Methods Summary */}
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3">💳 طرق الدفع</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(summary.paymentMethods).map(([method, amount]) => (
                    <div key={method} className="bg-green-50 p-3 rounded-lg text-center">
                      <div className="font-medium">{getPaymentMethodLabel(method)}</div>
                      <div className="font-bold text-green-600">{formatMoney(amount, true)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Partners Summary */}
              {summary.partnerEarnings && Object.keys(summary.partnerEarnings).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3">🤝 أرباح الشركاء</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(summary.partnerEarnings).map(([name, data]) => (
                      <div key={name || 'unknown'} className="bg-purple-50 p-3 rounded-lg">
                        <div className="font-medium">{name || 'شريك'} ({data.percentage || 0}%)</div>
                        <div className="font-bold text-purple-600">{formatMoney(Math.max(0, data.amount || 0))}</div>
                        <div className="text-xs text-gray-500">{data.bookings || 0} حجز</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bookings List */}
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3">📅 قائمة الحجوزات</h3>
                <table className="w-full text-xs">
                  <thead className="bg-booking-blue text-white">
                    <tr>
                      <th className="px-2 py-1 text-right">الضيف</th>
                      <th className="px-2 py-1 text-right">الشقة</th>
                      <th className="px-2 py-1 text-right">التواريخ</th>
                      <th className="px-2 py-1 text-right">الليالي</th>
                      <th className="px-2 py-1 text-right">الإجمالي</th>
                      <th className="px-2 py-1 text-right">طريقة الدفع</th>
                      <th className="px-2 py-1 text-right">ربحك</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.bookings.map((booking, idx) => (
                      <tr key={booking._id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="px-2 py-1">{booking.guestName}</td>
                        <td className="px-2 py-1">{booking.apartmentName}</td>
                        <td className="px-2 py-1">
                          {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                        </td>
                        <td className="px-2 py-1">{booking.numberOfNights}</td>
                        <td className="px-2 py-1">{formatMoney(booking.totalBookingPrice || booking.totalAmountUSD || booking.totalAmount || 0)}</td>
                        <td className="px-2 py-1">{getPaymentMethodLabel(booking.paymentMethod)}</td>
                        <td className="px-2 py-1 text-green-600">{formatMoney(booking.brokerProfit || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex gap-3 print:hidden">
                <button
                  onClick={handlePrintReport}
                  className="flex-1 bg-booking-blue text-white py-3 rounded-xl font-bold hover:bg-blue-700"
                >
                  🖨️ طباعة التقرير
                </button>
                <button
                  onClick={() => setShowMonthlyReport(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Financial
