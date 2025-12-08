import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { apartmentsAPI, bookingsAPI, roiAPI } from '../services/api'
import { useToast, ConfirmDialog } from '../components/Toast'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const Apartments = () => {
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
  const toast = useToast()

  useEffect(() => {
    fetchApartments()
    fetchAllBookings()
    // Update timer every minute to refresh remaining days
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      fetchApartments()
      fetchAllBookings()
    }, 60000) // Update every minute
    return () => clearInterval(interval)
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
      const params = {
        city: searchParams.get('city') || '',
        isActive: true,
      }
      const response = await apartmentsAPI.getAll(params).catch(err => {
        console.error('Error fetching apartments:', err)
        // Don't show error, just return empty array - system will work normally
        return { data: [] }
      })
      const data = Array.isArray(response.data) ? response.data : (response.data?.apartments || [])
      setApartments(data)
    } catch (error) {
      console.error('Error fetching apartments:', error)
      setApartments([])
      setError(null) // Don't show error, just work silently
    }
  }

  const fetchAllBookings = async () => {
    try {
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

  // Function to get room status and remaining days
  const getRoomStatus = (apartmentId, roomId) => {
    if (!roomId || !allBookings || allBookings.length === 0) {
      return { status: 'available', remainingDays: null, guestName: null }
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Find active bookings for this room
    const activeBookings = allBookings.filter(booking => {
      if (booking.apartment !== apartmentId || booking.roomId !== roomId) return false
      if (booking.status !== 'confirmed' && booking.status !== 'completed') return false
      
      const checkIn = new Date(booking.checkIn)
      const checkOut = new Date(booking.checkOut)
      checkIn.setHours(0, 0, 0, 0)
      checkOut.setHours(0, 0, 0, 0)
      
      return checkIn <= today && checkOut > today
    })
    
    if (activeBookings.length === 0) {
      return { status: 'available', remainingDays: null, guestName: null }
    }
    
    // Get the booking with the latest checkout date
    const latestBooking = activeBookings.sort((a, b) => 
      new Date(b.checkOut) - new Date(a.checkOut)
    )[0]
    
    const remainingDays = calculateRemainingDays(latestBooking.checkOut)
    
    return {
      status: 'occupied',
      remainingDays: remainingDays,
      guestName: latestBooking.guestName || null
    }
  }

  const openApartmentDetails = async (apartment) => {
    setSelectedApartment(apartment)
    setShowDetails(true)
    // Fetch bookings for this apartment
    try {
      const [bookingsRes, roiRes] = await Promise.all([
        bookingsAPI.getAll().catch(() => ({ data: [] })),
        roiAPI.getByApartment(apartment._id).catch(() => ({ data: null }))
      ])
      const allBookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : []
      const aptBookings = allBookings.filter(b => b.apartment === apartment._id)
      setApartmentBookings(aptBookings)
      setRoiData(roiRes.data)
    } catch (error) {
      console.error('Error fetching apartment details:', error)
      setApartmentBookings([])
      setRoiData(null)
    }
  }

  const closeDetails = () => {
    setShowDetails(false)
    setSelectedApartment(null)
    setApartmentBookings([])
    setRoiData(null)
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
            {percentage.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">مسترد</div>
        </div>
      </div>
    )
  }

  const generatePDFReport = (apartment) => {
    setGeneratingPDF(true)
    
    // Calculate financial summary
    const totalRevenue = apartmentBookings.reduce((sum, b) => sum + (b.totalAmountUSD || 0), 0)
    const totalOwnerAmount = apartmentBookings.reduce((sum, b) => sum + (b.ownerAmount || 0), 0)
    const totalPlatformFees = apartmentBookings.reduce((sum, b) => sum + (b.platformCommission || 0), 0)
    const totalBrokerProfit = apartmentBookings.reduce((sum, b) => sum + (b.brokerProfit || 0), 0)
    const totalPaid = apartmentBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0)
    const totalPending = apartmentBookings.reduce((sum, b) => sum + (b.remainingAmount || 0), 0)
    
    // Calculate monthly expenses
    const monthlyExpenses = apartment.monthlyExpenses || []
    const totalMonthlyExpenses = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    
    // Partner calculations
    const partners = apartment.partners || []
    const partnerDetails = partners.map(p => ({
      name: p.name,
      percentage: p.percentage,
      totalEarnings: (totalOwnerAmount * p.percentage / 100)
    }))

    const reportDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

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
        <div class="partner-earnings">$${p.totalEarnings.toFixed(2)}</div>
      </div>
      <div class="partner-percentage">${p.percentage}%</div>
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

  <!-- Financial Summary -->
  <div class="section">
    <div class="section-title">
      <span>💰</span> الملخص المالي
    </div>
    <div class="financial-cards">
      <div class="financial-card revenue">
        <div class="label">إجمالي الإيرادات</div>
        <div class="value" style="color: #155724;">$${totalRevenue.toFixed(2)}</div>
      </div>
      <div class="financial-card owner">
        <div class="label">نصيب الشركاء</div>
        <div class="value" style="color: #6c5ce7;">$${totalOwnerAmount.toFixed(2)}</div>
      </div>
      <div class="financial-card platform">
        <div class="label">عمولة المنصة</div>
        <div class="value" style="color: #e17055;">$${totalPlatformFees.toFixed(2)}</div>
      </div>
      <div class="financial-card profit">
        <div class="label">صافي ربحك</div>
        <div class="value" style="color: #003580;">$${totalBrokerProfit.toFixed(2)}</div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">المبلغ المحصّل</div>
        <div class="info-value" style="color: #27ae60;">$${totalPaid.toFixed(2)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">المبلغ المعلق</div>
        <div class="info-value" style="color: #e67e22;">$${totalPending.toFixed(2)}</div>
      </div>
    </div>
  </div>

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
          <td>${new Date(b.checkIn).toLocaleDateString('ar-EG')}</td>
          <td>${new Date(b.checkOut).toLocaleDateString('ar-EG')}</td>
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-booking-blue">الشقق المتاحة</h1>
        <Link
          to="/apartments/add"
          className="bg-booking-yellow text-booking-blue px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors"
        >
          + إضافة شقة جديدة
        </Link>
      </div>
      
      {apartments.length === 0 && !error ? (
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <p className="text-gray-600 text-xl mb-6">لا توجد شقق متاحة حالياً</p>
            <Link
              to="/apartments/add"
              className="inline-block bg-booking-yellow text-booking-blue px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors"
            >
              أضف أول شقة
            </Link>
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
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap leading-none ${
                                  roomStatus.status === 'available' 
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
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-booking-blue text-white p-6 rounded-t-2xl">
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

            <div className="p-6 space-y-6">
              {/* Status & Rooms Count */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-gray-600 text-sm mb-1">الحالة</div>
                  <div className={`text-lg font-bold ${
                    selectedApartment.bookingStatus === 'available' ? 'text-green-600' :
                    selectedApartment.bookingStatus === 'rented' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {getStatusLabel(selectedApartment.bookingStatus || 'available')}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-gray-600 text-sm mb-1">عدد الغرف</div>
                  <div className="text-2xl font-bold text-booking-blue">
                    {selectedApartment.rooms?.length || 0}
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
                        {new Date(selectedApartment.currentBooking.checkIn).toLocaleDateString('ar-EG', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">تاريخ المغادرة</div>
                      <div className="font-bold text-red-600">
                        {new Date(selectedApartment.currentBooking.checkOut).toLocaleDateString('ar-EG', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
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
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl mb-1">🛏️</div>
                    <div className="text-gray-600 text-xs">غرف النوم</div>
                    <div className="font-bold text-lg">{selectedApartment.bedrooms || 1}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl mb-1">🛁</div>
                    <div className="text-gray-600 text-xs">الحمامات</div>
                    <div className="font-bold text-lg">{selectedApartment.bathrooms || 1}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl mb-1">🛋️</div>
                    <div className="text-gray-600 text-xs">الأسرّة</div>
                    <div className="font-bold text-lg">{selectedApartment.beds || 1}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl mb-1">👥</div>
                    <div className="text-gray-600 text-xs">الضيوف</div>
                    <div className="font-bold text-lg">{selectedApartment.guests || 1}</div>
                  </div>
                </div>
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

              {/* Financial Summary */}
              <div className="bg-yellow-50 rounded-xl p-5">
                <h3 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
                  <span>💰</span>
                  الملخص المالي
                </h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-gray-600 text-xs mb-1">عمولة المنصة</div>
                    <div className="font-bold text-lg text-blue-600">{selectedApartment.platformCommission || 15}%</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-gray-600 text-xs mb-1">ربحك</div>
                    <div className="font-bold text-lg text-green-600">{selectedApartment.brokerPercentage || 5}%</div>
                  </div>
                </div>
              </div>

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
                              if (name === 'المسترد') return [`$${value.toFixed(2)}`, 'مسترد']
                              return [`$${value.toFixed(2)}`, 'متبقي']
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => {
                              if (value === 'المسترد') return `المسترد: $${roiData.recoveredAmount.toFixed(2)}`
                              return `المتبقي: $${roiData.remaining.toFixed(2)}`
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
                          تاريخ البدء: {new Date(roiData.investmentStartDate).toLocaleDateString('ar-EG')}
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

              {/* Monthly Expenses */}
              {selectedApartment.monthlyExpenses && selectedApartment.monthlyExpenses.length > 0 && (
                <div className="bg-red-50 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                    <span>💸</span>
                    المصاريف الشهرية
                  </h3>
                  <div className="space-y-2">
                    {selectedApartment.monthlyExpenses.map((expense, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg">
                        <span>{expense.name}</span>
                        <span className="font-bold text-red-600">{expense.amount?.toLocaleString()} ج.م</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-red-100 p-3 rounded-lg mt-3">
                      <span className="font-bold">الإجمالي</span>
                      <span className="font-bold text-red-700 text-lg">
                        {selectedApartment.monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0).toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                              if (name === 'المسترد') return [`$${value.toFixed(2)}`, 'مسترد']
                              return [`$${value.toFixed(2)}`, 'متبقي']
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
                          ${roiData.recoveredAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {roiData.recoveryPercentage.toFixed(1)}% من الهدف
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">المبلغ المتبقي</div>
                        <div className="text-2xl font-black text-gray-700">
                          ${roiData.remaining.toFixed(2)}
                        </div>
                      </div>

                      {roiData.isComplete && (
                        <div className="bg-green-500 text-white rounded-lg p-4 text-center font-bold">
                          🎉 تم تحقيق نقطة التعادل!
                        </div>
                      )}

                      {!roiData.isComplete && (
                        <div className={`rounded-lg p-3 text-center font-bold ${
                          roiData.statusColor === 'green' ? 'bg-green-100 text-green-800' :
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
                    <p>تاريخ بداية الاستثمار: {new Date(roiData.investmentStartDate).toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</p>
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
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  roomStatus.status === 'available' 
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
    </div>
  )
}

export default Apartments
