import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { bookingsAPI, apartmentsAPI, partnersAPI, currencyAPI } from '../services/api'
import { useToast } from '../components/Toast'

const Financial = () => {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [apartments, setApartments] = useState([])
  const [partners, setPartners] = useState([])
  const [currencyRates, setCurrencyRates] = useState({})
  
  // Filters
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
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
  const [currency, setCurrency] = useState('USD')
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
  
  const years = [2025, 2024, 2023, 2022, 2021]
  
  useEffect(() => {
    fetchAllData()
  }, [])
  
  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [bookingsRes, apartmentsRes, ownersRes, ratesRes] = await Promise.all([
        bookingsAPI.getAll().catch(() => ({ data: [] })),
        apartmentsAPI.getAll().catch(() => ({ data: [] })),
        partnersAPI.getAll().catch(() => ({ data: [] })),
        currencyAPI.getRates().catch(() => ({ data: [] }))
      ])
      
      setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : [])
      setApartments(Array.isArray(apartmentsRes.data) ? apartmentsRes.data : [])
      setPartners(Array.isArray(ownersRes.data) ? ownersRes.data : [])
      
      const rates = {}
      const ratesData = Array.isArray(ratesRes.data) ? ratesRes.data : []
      ratesData.forEach(r => { rates[r.currency] = r.rateToEGP })
      setCurrencyRates(rates)
    } catch (error) {
      console.error('Error:', error)
    }
    setLoading(false)
  }
  
  // Filter bookings based on all filters
  const getFilteredBookings = () => {
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.checkIn)
      const bookingMonth = bookingDate.getMonth() + 1
      const bookingYear = bookingDate.getFullYear()
      
      // Month/Year filter
      if (!filters.showAllMonths) {
        if (bookingMonth !== filters.month || bookingYear !== filters.year) return false
      }
      
      // Date range filter
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
  
  // Calculate summary from filtered bookings
  const calculateSummary = () => {
    const filtered = getFilteredBookings()
    
    const totalRevenue = filtered.reduce((sum, b) => sum + (b.totalAmountUSD || 0), 0)
    const paidAmount = filtered.reduce((sum, b) => sum + (b.paidAmount || 0), 0)
    const pendingAmount = filtered.reduce((sum, b) => sum + (b.remainingAmount || 0), 0)
    const ownerAmount = filtered.reduce((sum, b) => sum + (b.ownerAmount || 0), 0)
    const platformCommission = filtered.reduce((sum, b) => sum + (b.platformCommission || 0), 0)
    const cleaningFees = filtered.reduce((sum, b) => sum + (b.cleaningFee || 0), 0)
    const brokerProfit = filtered.reduce((sum, b) => sum + (b.brokerProfit || 0), 0)
    const totalNights = filtered.reduce((sum, b) => sum + (b.numberOfNights || 0), 0)
    
    // Calculate partner earnings
    const partnerEarnings = {}
    let totalPartnerAmount = 0 // إجمالي نصيب الشركاء
    filtered.forEach(b => {
      if (b.partners && b.partners.length > 0) {
        b.partners.forEach(p => {
          if (!partnerEarnings[p.name]) {
            partnerEarnings[p.name] = { amount: 0, bookings: 0, percentage: p.percentage }
          }
          const partnerAmount = p.amount || 0
          partnerEarnings[p.name].amount += partnerAmount
          partnerEarnings[p.name].bookings += 1
          totalPartnerAmount += partnerAmount
        })
      } else {
        // إذا لم تكن هناك شركاء، استخدم ownerAmount كحل بديل (لأنه في الواقع هو نصيب الشركاء)
        totalPartnerAmount += b.ownerAmount || 0
      }
    })
    
    
    // Payment method breakdown
    const paymentMethods = {}
    filtered.forEach(b => {
      const method = b.paymentMethod || 'unknown'
      if (!paymentMethods[method]) paymentMethods[method] = 0
      paymentMethods[method] += b.paidAmount || 0
    })
    
    // Platform breakdown
    const platforms = {}
    filtered.forEach(b => {
      const platform = b.platform || 'direct'
      if (!platforms[platform]) platforms[platform] = { revenue: 0, commission: 0, count: 0 }
      platforms[platform].revenue += b.totalAmountUSD || 0
      platforms[platform].commission += b.platformCommission || 0
      platforms[platform].count += 1
    })
    
    // Apartment breakdown
    const apartmentStats = {}
    filtered.forEach(b => {
      const aptName = b.apartmentName || 'غير محدد'
      if (!apartmentStats[aptName]) apartmentStats[aptName] = { revenue: 0, profit: 0, bookings: 0, nights: 0 }
      apartmentStats[aptName].revenue += b.totalAmountUSD || 0
      apartmentStats[aptName].profit += b.brokerProfit || 0
      apartmentStats[aptName].bookings += 1
      apartmentStats[aptName].nights += b.numberOfNights || 0
    })
    
    return {
      totalBookings: filtered.length,
      totalRevenue,
      paidAmount,
      pendingAmount,
      ownerAmount,
      totalPartnerAmount, // إجمالي نصيب الشركاء
      platformCommission,
      cleaningFees,
      brokerProfit,
      totalNights,
      partnerEarnings,
      paymentMethods,
      platforms,
      apartmentStats,
      bookings: filtered
    }
  }
  
  const summary = calculateSummary()
  
  const formatMoney = (amount) => {
    if (currency === 'EGP') {
      return `${(amount * (currencyRates.USD || 50)).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
    }
    return `$${amount.toFixed(2)}`
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
      <div className="container mx-auto px-4 py-8">
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
        <h1 className="text-3xl font-bold text-booking-blue flex items-center gap-3">
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

          {/* Partner */}
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
          { id: 'partners', label: '🤝 الشركاء' },
          { id: 'platforms', label: '🌐 المنصات' },
          { id: 'payments', label: '💳 المدفوعات' },
          { id: 'bookings', label: '📅 الحجوزات' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
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
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span>🤝 نصيب الشركاء</span>
                  <span className="font-bold text-purple-600">-{formatMoney(summary.totalPartnerAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span>🌐 عمولة المنصات</span>
                  <span className="font-bold text-red-600">-{formatMoney(summary.platformCommission)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span>🧹 رسوم التنظيف</span>
                  <span className="font-bold text-orange-600">-{formatMoney(summary.cleaningFees)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg border-2 border-green-400">
                  <span className="font-bold">💰 صافي ربحك</span>
                  <span className="font-black text-green-600 text-xl">{formatMoney(summary.brokerProfit)}</span>
                </div>
              </div>
            </div>

            {/* Partner Earnings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🤝 أرباح الشركاء</h3>
              {Object.keys(summary.partnerEarnings).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(summary.partnerEarnings).map(([name, data]) => (
                    <div key={name} className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <div>
                        <span className="font-medium">{name}</span>
                        <span className="text-sm text-purple-600 mr-2">({data.percentage}%)</span>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-purple-600">{formatMoney(data.amount)}</div>
                        <div className="text-xs text-gray-500">{data.bookings} حجز</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">لا يوجد شركاء في هذه الفترة</div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Apartments Tab */}
      {activeTab === 'apartments' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🏠 إحصائيات الشقق</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-right">الشقة</th>
                  <th className="px-4 py-3 text-right">الحجوزات</th>
                  <th className="px-4 py-3 text-right">الليالي</th>
                  <th className="px-4 py-3 text-right">الإيرادات</th>
                  <th className="px-4 py-3 text-right">ربحك</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.apartmentStats).map(([name, stats]) => (
                  <tr key={name} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="px-4 py-3">{stats.bookings}</td>
                    <td className="px-4 py-3">{stats.nights} ليلة</td>
                    <td className="px-4 py-3 font-bold text-blue-600">{formatMoney(stats.revenue)}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{formatMoney(stats.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <div className="font-black text-xl text-green-600">{formatMoney(amount)}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Partners Tab */}
      {activeTab === 'partners' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🤝 أرباح الشركاء</h3>
          {Object.keys(summary.partnerEarnings).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(summary.partnerEarnings).map(([name, data]) => (
                <div key={name} className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                  <div>
                    <span className="font-bold text-lg">{name}</span>
                    <span className="text-sm text-purple-600 mr-2">({data.percentage}%)</span>
                    <div className="text-xs text-gray-500 mt-1">{data.bookings} حجز</div>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-purple-600 text-xl">{formatMoney(data.amount)}</div>
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
                      {new Date(booking.checkIn).toLocaleDateString('ar-EG')} →
                      {new Date(booking.checkOut).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-3 py-2">{booking.numberOfNights}</td>
                    <td className="px-3 py-2 font-bold">{formatMoney(booking.totalAmountUSD || 0)}</td>
                    <td className="px-3 py-2 text-green-600">{formatMoney(booking.paidAmount || 0)}</td>
                    <td className="px-3 py-2 text-orange-500">{formatMoney(booking.remainingAmount || 0)}</td>
                    <td className="px-3 py-2">{getPaymentMethodLabel(booking.paymentMethod)}</td>
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
                <p className="text-sm text-gray-400">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
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

              {/* Payment Methods Summary */}
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3">💳 طرق الدفع</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(summary.paymentMethods).map(([method, amount]) => (
                    <div key={method} className="bg-green-50 p-3 rounded-lg text-center">
                      <div className="font-medium">{getPaymentMethodLabel(method)}</div>
                      <div className="font-bold text-green-600">{formatMoney(amount)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Partners Summary */}
              {Object.keys(summary.partnerEarnings).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3">🤝 أرباح الشركاء</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(summary.partnerEarnings).map(([name, data]) => (
                      <div key={name} className="bg-purple-50 p-3 rounded-lg">
                        <div className="font-medium">{name} ({data.percentage}%)</div>
                        <div className="font-bold text-purple-600">{formatMoney(data.amount)}</div>
                        <div className="text-xs text-gray-500">{data.bookings} حجز</div>
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
                          {new Date(booking.checkIn).toLocaleDateString('ar-EG')} - {new Date(booking.checkOut).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-2 py-1">{booking.numberOfNights}</td>
                        <td className="px-2 py-1">{formatMoney(booking.totalAmountUSD || 0)}</td>
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
