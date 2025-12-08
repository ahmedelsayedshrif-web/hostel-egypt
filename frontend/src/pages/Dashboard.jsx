import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { monthlyAPI, apartmentsAPI, currencyAPI, bookingsAPI, roiAPI } from '../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedApartment, setSelectedApartment] = useState('')
  const [monthlySummary, setMonthlySummary] = useState({ summary: {}, bookings: [], expenses: [], partnerProfits: [] })
  const [apartments, setApartments] = useState([])
  const [exchangeRates, setExchangeRates] = useState({ USD: 50, EUR: 54, GBP: 63 })
  const [displayCurrency, setDisplayCurrency] = useState('USD')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [bookingDetails, setBookingDetails] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [roiSummaries, setRoiSummaries] = useState([])

  useEffect(() => {
    fetchApartments()
    fetchExchangeRates()
    fetchROISummaries()
  }, [])

  const fetchROISummaries = async () => {
    try {
      const apartmentsWithInvestment = apartments.filter(apt => apt.investmentTarget && apt.investmentTarget > 0)
      const roiPromises = apartmentsWithInvestment.map(apt => 
        roiAPI.getByApartment(apt._id).catch(() => ({ data: null }))
      )
      const roiResults = await Promise.all(roiPromises)
      const summaries = roiResults
        .map((result, index) => ({
          ...result.data,
          apartment: apartmentsWithInvestment[index]
        }))
        .filter(r => r && r.hasInvestment)
        .sort((a, b) => b.recoveryPercentage - a.recoveryPercentage) // Sort by recovery percentage descending
        .slice(0, 5) // Top 5
      setRoiSummaries(summaries)
    } catch (error) {
      console.error('Error fetching ROI summaries:', error)
      setRoiSummaries([])
    }
  }

  useEffect(() => {
    if (apartments.length > 0) {
      fetchROISummaries()
    }
  }, [apartments])

  useEffect(() => {
    fetchMonthlySummary()
  }, [selectedMonth, selectedYear, selectedApartment])

  const fetchApartments = async () => {
    try {
      const response = await apartmentsAPI.getAll()
      const data = Array.isArray(response.data) ? response.data : []
      setApartments(data)
    } catch (error) {
      console.error('Error fetching apartments:', error)
      setApartments([])
    }
  }

  const fetchExchangeRates = async () => {
    try {
      const response = await currencyAPI.getRates()
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
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

  const fetchMonthlySummary = async () => {
    setLoading(true)
    try {
      const params = {
        year: selectedYear,
        month: selectedMonth
      }
      if (selectedApartment) {
        params.apartmentId = selectedApartment
      }
      const response = await monthlyAPI.getSummary(params).catch(err => {
        console.error('Error fetching monthly summary:', err)
        return { data: { summary: {}, bookings: [], expenses: [], partnerProfits: [] } }
      })
      setMonthlySummary(response.data || { summary: {}, bookings: [], expenses: [], partnerProfits: [] })
    } catch (error) {
      console.error('Error fetching monthly summary:', error)
      setMonthlySummary({ summary: {}, bookings: [], expenses: [], partnerProfits: [] })
    } finally {
      setLoading(false)
    }
  }

  const fetchBookingDetails = async (bookingId) => {
    try {
      const response = await bookingsAPI.getById(bookingId)
      if (response.data) {
        const booking = response.data
        const apt = apartments.find(a => a._id === booking.apartment)
        setBookingDetails({
          booking,
          apartment: apt,
          partners: apt?.partners || []
        })
        setShowBookingModal(true)
      }
    } catch (error) {
      console.error('Error fetching booking details:', error)
    }
  }

  const getPaymentMethodLabel = (method) => {
    const methods = {
      cash: 'نقدي',
      vodafone_cash: 'فودافون كاش',
      instapay: 'انستاباي',
      visa: 'فيزا',
      bank_transfer: 'تحويل بنكي'
    }
    return methods[method] || method
  }

  const getPlatformLabel = (platform) => {
    const platforms = {
      direct: 'مباشر',
      airbnb: 'Airbnb',
      booking: 'Booking.com',
      other: 'أخرى'
    }
    return platforms[platform] || platform
  }

  const formatAmount = (amountUSD, amountEGP) => {
    if (displayCurrency === 'EGP') {
      return `${(amountEGP || amountUSD * exchangeRates.USD).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
    }
    return `$${(amountUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getStatusColor = (status) => {
    const colors = {
      confirmed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
      active: 'bg-green-500 text-white',
      upcoming: 'bg-blue-100 text-blue-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status) => {
    const labels = {
      confirmed: 'مؤكد',
      pending: 'معلق',
      cancelled: 'ملغي',
      completed: 'مكتمل',
      active: 'نشط الآن',
      upcoming: 'قادم'
    }
    return labels[status] || status
  }

  // حساب الحالة الفعلية بناءً على التواريخ
  const getComputedStatus = (booking) => {
    // إذا كان ملغي، لا نغير الحالة
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

  const summary = monthlySummary?.summary || {}
  const partnerProfits = monthlySummary?.partnerProfits || []

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-booking-blue mb-4">لوحة التحكم</h1>
        
        {/* Filters */}
        <div className="card-booking p-3 sm:p-5 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div>
              <label className="label-booking">الشهر</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="select-booking"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const monthNames = [
                    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
                  ]
                  return (
                    <option key={month} value={month}>
                      {monthNames[month - 1]}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="label-booking">السنة</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="select-booking"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-booking">الشقة</label>
              <select
                value={selectedApartment}
                onChange={(e) => setSelectedApartment(e.target.value)}
                className="select-booking"
              >
                <option value="">جميع الشقق</option>
                {apartments.map(apt => (
                  <option key={apt._id} value={apt._id}>
                    {apt.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-booking">عرض المبالغ بـ</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDisplayCurrency('USD')}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
                    displayCurrency === 'USD' 
                      ? 'bg-booking-blue text-white shadow-md' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  دولار $
                </button>
                <button
                  onClick={() => setDisplayCurrency('EGP')}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
                    displayCurrency === 'EGP' 
                      ? 'bg-emerald-500 text-white shadow-md' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  جنيه ج.م
                </button>
              </div>
            </div>
            <div>
              <label className="label-booking">سعر الصرف</label>
              <div className="text-sm space-y-1 pt-2 bg-gray-50 rounded-xl p-3">
                <div className="flex justify-between">
                  <span>USD:</span>
                  <span className="font-bold">{exchangeRates.USD?.toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-booking-blue"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            {/* Total Revenue */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="card-blue-border p-6 hover-lift"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-600 text-sm">إجمالي الإيرادات</div>
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatAmount(summary.totalPaid, summary.totalPaidEGP)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {summary.totalBookings || 0} حجز
              </div>
            </motion.div>

            {/* Pending Amount */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.02, duration: 0.2 }}
              className="card-orange-border p-6 hover-lift"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-600 text-sm">المبلغ المعلق</div>
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {formatAmount(summary.pendingAmount, summary.pendingAmountEGP)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                مبالغ لم تُحصّل بعد
              </div>
            </motion.div>

            {/* Collected Amount */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04, duration: 0.2 }}
              className="card-green-border p-6 hover-lift"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-600 text-sm">المبلغ المحصّل</div>
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatAmount(summary.collectedAmount, summary.collectedAmountEGP)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                تم تحصيله فعلياً
              </div>
            </motion.div>

            {/* Net Profit */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.2 }}
              className="card-gradient-blue p-6 hover-lift"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-white text-sm opacity-90">صافي ربحك</div>
                <svg className="w-8 h-8 text-booking-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-white">
                {formatAmount(summary.netProfit, summary.netProfitEGP)}
              </div>
              <div className="text-sm text-booking-yellow mt-1 font-semibold">
                بعد خصم جميع المصاريف
              </div>
            </motion.div>
          </div>

          {/* Summary Cards Row 2 - Deductions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            {/* Platform Commission */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.2 }}
              className="card-red-border p-5 hover-lift"
            >
              <div className="text-gray-600 text-sm mb-1">عمولة المنصة</div>
              <div className="text-xl font-bold text-red-600">
                {formatAmount(summary.totalPlatformCommission, (summary.totalPlatformCommission || 0) * exchangeRates.USD)}
              </div>
            </motion.div>

            {/* Owner Payments */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="card-purple-border p-5 hover-lift"
            >
              <div className="text-gray-600 text-sm mb-1">نصيب الشركاء</div>
              <div className="text-xl font-bold text-purple-600">
                {formatAmount(summary.totalCompanyOwnerPayouts || 0, (summary.totalCompanyOwnerPayoutsEGP || 0))}
              </div>
            </motion.div>

            {/* Expenses */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.2 }}
              className="card-gray-border p-5 hover-lift"
            >
              <div className="text-gray-600 text-sm mb-1">المصاريف</div>
              <div className="text-xl font-bold text-gray-600">
                {formatAmount(summary.totalExpenses, summary.totalExpensesEGP)}
              </div>
            </motion.div>

            {/* Expected Profit from Active */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.2 }}
              className="card-yellow-border p-5 hover-lift"
            >
              <div className="text-gray-600 text-sm mb-1">الربح المنتظر (حجوزات نشطة)</div>
              <div className="text-xl font-bold text-yellow-600">
                {formatAmount(summary.expectedProfitFromActive, summary.expectedProfitFromActiveEGP)}
              </div>
              <div className="text-xs text-gray-500">{summary.activeBookings || 0} حجز نشط</div>
            </motion.div>
          </div>

          {/* Partner Profits */}
          {partnerProfits.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-booking p-6 mb-6"
            >
              <h2 className="text-xl font-bold text-booking-blue mb-4 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                أرباح الشركاء
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {partnerProfits.map((partner, index) => (
                  <div 
                    key={index}
                    className="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-5 border border-purple-100 hover-lift"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-800">{partner.name}</span>
                      <span className="bg-booking-blue text-white px-3 py-1 rounded-full text-sm font-bold">
                        {partner.percentage}%
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      {displayCurrency === 'EGP' 
                        ? `${partner.totalEGP.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
                        : `$${partner.totalUSD.toFixed(2)}`
                      }
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ROI Performance Summary */}
          {roiSummaries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-booking p-6 mb-6"
            >
              <h2 className="text-xl font-bold text-booking-blue mb-4 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                أفضل الشقق أداءً (حسب العائد على الاستثمار)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roiSummaries.map((roi, index) => (
                  <div 
                    key={roi.apartment._id}
                    className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-5 border-2 border-indigo-200 hover-lift"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800 text-lg">{roi.apartment.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        roi.statusColor === 'green' ? 'bg-green-100 text-green-800' :
                        roi.statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {roi.recoveryPercentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="mb-4">
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'المسترد', value: roi.recoveredAmount },
                              { name: 'المتبقي', value: roi.remaining }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={2}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                          >
                            <Cell fill={roi.statusColor === 'green' ? '#10b981' : roi.statusColor === 'yellow' ? '#eab308' : '#ef4444'} />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                          <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">المسترد:</span>
                        <span className="font-bold text-green-600">${roi.recoveredAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">المتبقي:</span>
                        <span className="font-bold text-gray-700">${roi.remaining.toFixed(2)}</span>
                      </div>
                      {roi.isComplete && (
                        <div className="mt-2 p-2 bg-green-100 rounded-lg text-center">
                          <span className="text-green-800 font-bold text-xs">✅ تم تحقيق نقطة التعادل</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Bookings Table */}
          {monthlySummary?.bookings && monthlySummary.bookings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-booking overflow-hidden mb-6"
            >
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-booking-blue flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  سجل الحجوزات ({summary.totalBookings || 0})
                </h2>
                <span className="text-sm text-gray-500">اضغط على أي حجز لعرض التفاصيل</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table-booking">
                  <thead className="bg-booking-blue text-white">
                    <tr>
                      <th className="px-4 py-3 text-right">الضيف</th>
                      <th className="px-4 py-3 text-right">الشقة</th>
                      <th className="px-4 py-3 text-right">من - إلى</th>
                      <th className="px-4 py-3 text-right">المبلغ الكلي</th>
                      <th className="px-4 py-3 text-right">المدفوع</th>
                      <th className="px-4 py-3 text-right">المتبقي</th>
                      <th className="px-4 py-3 text-right">ربحك</th>
                      <th className="px-4 py-3 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.bookings.map((booking) => (
                      <tr 
                        key={booking.id} 
                        className="border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedBooking(booking)
                          fetchBookingDetails(booking.id)
                        }}
                      >
                        <td className="px-4 py-4">
                          <div className="font-medium">{booking.guestName}</div>
                          <div className="text-sm text-gray-500">{booking.guestPhone}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-booking-blue">{booking.apartmentName}</div>
                          {booking.partners?.length > 0 && (
                            <div className="text-xs text-gray-500">
                              {booking.partners.length} شريك
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            {new Date(booking.checkIn).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(booking.checkOut).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-bold text-booking-blue">
                          {formatAmount(booking.totalAmount, booking.totalAmount * exchangeRates.USD)}
                        </td>
                        <td className="px-4 py-4 text-green-600 font-medium">
                          {formatAmount(booking.paidAmount, booking.paidAmountEGP)}
                        </td>
                        <td className="px-4 py-4 text-orange-500 font-medium">
                          {formatAmount(booking.remainingAmount, booking.remainingAmount * exchangeRates.USD)}
                        </td>
                        <td className="px-4 py-4 font-bold text-green-600">
                          {formatAmount(booking.brokerProfit, booking.netAmountEGP)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${getStatusColor(getComputedStatus(booking))}`}>
                            {getStatusLabel(getComputedStatus(booking))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Expenses */}
          {monthlySummary?.expenses && monthlySummary.expenses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-booking overflow-hidden mb-6"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-booking-blue flex items-center gap-2">
                  💸 المصاريف
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="table-booking">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-right">النوع</th>
                      <th className="px-4 py-3 text-right">الشقة</th>
                      <th className="px-4 py-3 text-right">المبلغ</th>
                      <th className="px-4 py-3 text-right">الوصف</th>
                      <th className="px-4 py-3 text-right">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.expenses.map((expense) => (
                      <tr key={expense.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700">
                            {expense.type === 'electricity' && '⚡ كهرباء'}
                            {expense.type === 'water' && '💧 مياه'}
                            {expense.type === 'services' && '🔧 خدمات'}
                            {expense.type === 'maintenance' && '🛠️ صيانة'}
                            {expense.type === 'cleaning' && '🧹 تنظيف'}
                            {expense.type === 'monthly' && '📆 شهري'}
                            {expense.type === 'other' && '📦 أخرى'}
                            {!['electricity', 'water', 'services', 'maintenance', 'cleaning', 'monthly', 'other'].includes(expense.type) && expense.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{expense.apartmentName}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-red-600">
                            {displayCurrency === 'EGP' 
                              ? `${expense.amount.toLocaleString('ar-EG')} ج.م`
                              : `$${expense.amountUSD?.toFixed(2) || (expense.amount / exchangeRates.USD).toFixed(2)}`
                            }
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{expense.description || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(expense.date).toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Link to="/bookings" className="card-booking p-6 hover-lift group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📅
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">إدارة الحجوزات</h3>
                  <p className="text-sm text-gray-500">إضافة وعرض جميع الحجوزات</p>
                </div>
              </div>
            </Link>
            <Link to="/apartments" className="card-booking p-6 hover-lift group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🏢
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">إدارة الشقق</h3>
                  <p className="text-sm text-gray-500">عرض وإدارة الشقق والمصاريف</p>
                </div>
              </div>
            </Link>
            <Link to="/financial" className="card-booking p-6 hover-lift group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  💰
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">التقارير المالية</h3>
                  <p className="text-sm text-gray-500">عرض التقارير وتقفيل الشهر</p>
                </div>
              </div>
            </Link>
          </div>
        </>
      )}

      {/* Booking Details Modal */}
      <AnimatePresence>
        {showBookingModal && selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBookingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-booking-blue text-white p-6 flex justify-between items-center">
                <h3 className="text-xl font-bold">تفاصيل الحجز</h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-white hover:text-booking-yellow transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Guest Info */}
                <div className="bg-gray-50 rounded-2xl p-5">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    👤 بيانات المستأجر
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-500 text-sm">الاسم:</span>
                      <p className="font-medium">{selectedBooking.guestName}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">الهاتف:</span>
                      <p className="font-medium">{selectedBooking.guestPhone || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">تاريخ الدخول:</span>
                      <p className="font-medium">{new Date(selectedBooking.checkIn).toLocaleDateString('ar-EG')}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">تاريخ الخروج:</span>
                      <p className="font-medium">{new Date(selectedBooking.checkOut).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                </div>

                {/* Apartment Info */}
                <div className="bg-blue-50 rounded-2xl p-5">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    🏢 بيانات الشقة
                  </h4>
                  <p className="font-bold text-lg text-booking-blue">{selectedBooking.apartmentName}</p>
                  <p className="text-gray-600 text-sm">المنصة: {getPlatformLabel(selectedBooking.platform)}</p>
                </div>

                {/* Partners */}
                {selectedBooking.partners && selectedBooking.partners.length > 0 && (
                  <div className="bg-purple-50 rounded-2xl p-5">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      🤝 الشركاء ونسبهم
                    </h4>
                    <div className="space-y-2">
                      {selectedBooking.partners.map((partner, index) => {
                        const partnerShare = ((selectedBooking.ownerAmount || 0) * (partner.percentage || 0)) / 100
                        return (
                          <div key={index} className="flex justify-between items-center bg-white p-4 rounded-xl">
                            <div>
                              <span className="font-medium">{partner.name}</span>
                              <span className="text-sm text-purple-600 mr-2">({partner.percentage}%)</span>
                            </div>
                            <span className="font-bold text-purple-600">
                              {displayCurrency === 'EGP' 
                                ? `${(partnerShare * exchangeRates.USD).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
                                : `$${partnerShare.toFixed(2)}`
                              }
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="bg-green-50 rounded-2xl p-5">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    💰 الملخص المالي
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-green-200">
                      <span className="text-gray-600">المبلغ الكلي:</span>
                      <span className="font-bold">{formatAmount(selectedBooking.totalAmount, selectedBooking.totalAmount * exchangeRates.USD)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-green-200">
                      <span className="text-gray-600">المدفوع:</span>
                      <span className="font-bold text-green-600">{formatAmount(selectedBooking.paidAmount, selectedBooking.paidAmountEGP)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-green-200">
                      <span className="text-gray-600">المتبقي:</span>
                      <span className="font-bold text-orange-500">{formatAmount(selectedBooking.remainingAmount, selectedBooking.remainingAmount * exchangeRates.USD)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-green-200">
                      <span className="text-gray-600">عمولة المنصة:</span>
                      <span className="font-bold text-red-500">{formatAmount(selectedBooking.platformCommission, selectedBooking.platformCommission * exchangeRates.USD)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-green-200">
                      <span className="text-gray-600">نصيب الشركاء:</span>
                      <span className="font-bold text-purple-600">{formatAmount(selectedBooking.ownerAmount, selectedBooking.ownerAmount * exchangeRates.USD)}</span>
                    </div>
                    <div className="flex justify-between py-3 bg-gradient-to-r from-booking-blue to-booking-light-blue text-white rounded-xl px-5 mt-3">
                      <span className="font-bold">صافي ربحك:</span>
                      <span className="font-bold text-lg">{formatAmount(selectedBooking.brokerProfit, selectedBooking.netAmountEGP)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-gray-500 text-sm">طريقة الدفع:</span>
                    <p className="font-medium">{getPaymentMethodLabel(selectedBooking.paymentMethod)}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${getStatusColor(getComputedStatus(selectedBooking))}`}>
                    {getStatusLabel(getComputedStatus(selectedBooking))}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard
