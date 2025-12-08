import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apartmentsAPI, bookingsAPI, ownersAPI, partnersAPI } from '../services/api'
import { useToast } from '../components/Toast'

const Partners = () => {
  const [partners, setPartners] = useState([])
  const [apartments, setApartments] = useState([])
  const [bookings, setBookings] = useState([])
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPartner, setNewPartner] = useState({
    name: '',
    phone: '',
    email: '',
    defaultSharePercentage: 0,
    type: 'investor', // 'investor' or 'company_owner'
    notes: ''
  })
  const toast = useToast()

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [apartmentsRes, bookingsRes, ownersRes, partnersRes] = await Promise.all([
        apartmentsAPI.getAll().catch(() => ({ data: [] })),
        bookingsAPI.getAll().catch(() => ({ data: [] })),
        ownersAPI.getAll().catch(() => ({ data: [] })),
        partnersAPI.getAll().catch(() => ({ data: [] }))
      ])

      const apartmentsData = Array.isArray(apartmentsRes.data) ? apartmentsRes.data : []
      const bookingsData = Array.isArray(bookingsRes.data) ? bookingsRes.data : []
      const ownersData = Array.isArray(ownersRes.data) ? ownersRes.data : []
      const partnersData = Array.isArray(partnersRes.data) ? partnersRes.data : []

      setApartments(apartmentsData)
      setBookings(bookingsData)
      setOwners(ownersData)

      // Start with partners from database
      const allPartners = partnersData.map(partner => ({
        _id: partner._id,
        ownerId: partner._id,
        name: partner.name,
        phone: partner.phone || '',
        email: partner.email || '',
        defaultSharePercentage: partner.defaultSharePercentage || 0,
        notes: partner.notes || '',
        apartments: [],
        totalEarnings: 0,
        totalEarningsEGP: 0,
        bookingsCount: 0,
        isFromDatabase: true
      }))
      
      // Add partners from apartments (NOT main owners)
      apartmentsData.forEach(apt => {
        if (apt.partners && apt.partners.length > 0) {
          apt.partners.forEach(partner => {
            const partnerName = partner.name || (partner.ownerData?.name) || 'شريك'
            const partnerId = partner.owner || partner._id || `partner-${apt._id}-${partnerName}`
            
            // Skip if this partner is the main owner
            if (partnerId === apt.mainOwner) return
            
            let existingPartner = allPartners.find(p => p.ownerId === partnerId || p.name === partnerName)
            if (existingPartner) {
              // Add apartment to existing partner
              if (!existingPartner.apartments.find(a => a.id === apt._id)) {
                existingPartner.apartments.push({
                  id: apt._id,
                  name: apt.name,
                  percentage: partner.percentage || 0,
                  mainOwnerName: apt.mainOwnerData?.name || 'غير محدد'
                })
              }
            } else {
              // Create new partner from apartment
              allPartners.push({
                ownerId: partnerId,
                name: partnerName,
                phone: partner.phone || partner.ownerData?.phone || '',
                email: partner.email || partner.ownerData?.email || '',
                apartments: [{
                  id: apt._id,
                  name: apt.name,
                  percentage: partner.percentage || 0,
                  mainOwnerName: apt.mainOwnerData?.name || 'غير محدد'
                }],
                totalEarnings: 0,
                totalEarningsEGP: 0,
                bookingsCount: 0,
                isFromDatabase: false
              })
            }
          })
        }
      })

      // Calculate earnings for each partner
      allPartners.forEach(partner => {
        let totalEarnings = 0
        let totalEarningsEGP = 0
        let bookingsCount = 0

        partner.apartments.forEach(apt => {
          const aptBookings = bookingsData.filter(b => b.apartment === apt.id)
          aptBookings.forEach(booking => {
            const brokerProfit = booking.brokerProfit || 0
            // Partner gets their percentage from the broker profit
            const partnerShare = brokerProfit * (apt.percentage / 100)
            totalEarnings += partnerShare
            totalEarningsEGP += partnerShare * (booking.exchangeRate || 50)
            bookingsCount++
          })
        })

        partner.totalEarnings = totalEarnings
        partner.totalEarningsEGP = totalEarningsEGP
        partner.bookingsCount = bookingsCount
      })

      setPartners(allPartners)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const getPartnerBookings = (partner) => {
    const partnerBookings = []
    
    partner.apartments.forEach(apt => {
      const aptBookings = bookings.filter(b => b.apartment === apt.id)
      aptBookings.forEach(booking => {
        const brokerProfit = booking.brokerProfit || 0
        const partnerShare = brokerProfit * (apt.percentage / 100)
        
        partnerBookings.push({
          ...booking,
          apartmentName: apt.name,
          partnerPercentage: apt.percentage,
          partnerShare,
          partnerShareEGP: partnerShare * (booking.exchangeRate || 50)
        })
      })
    })

    return partnerBookings.sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-booking-blue"></div>
      </div>
    )
  }

  const handleAddPartner = async (e) => {
    e.preventDefault()
    
    if (!newPartner.name || !newPartner.phone) {
      toast.warning('الاسم والهاتف مطلوبان!')
      return
    }
    
    try {
      await partnersAPI.create(newPartner)
      toast.success('تم إضافة الشريك بنجاح!')
      setShowAddModal(false)
      setNewPartner({ name: '', phone: '', email: '', defaultSharePercentage: 0, type: 'investor', notes: '' })
      fetchAllData()
    } catch (error) {
      console.error('Error creating partner:', error)
      toast.error('حدث خطأ أثناء إضافة الشريك')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-booking-blue flex items-center gap-3">
            <span>🤝</span> إدارة الشركاء
          </h1>
          <p className="text-gray-600 mt-2">
            عرض جميع الشركاء وأرباحهم من الحجوزات
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-[#003580] to-[#0071c2] text-white px-6 py-3 rounded-xl font-bold hover:from-[#00264d] hover:to-[#005a9e] shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          إضافة شريك جديد
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
          <div className="text-6xl mb-4">🤝</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">لا يوجد شركاء</h3>
          <p className="text-gray-600 text-lg">
            أضف شركاء عند إنشاء الشقق لتظهر هنا
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner, index) => (
            <motion.div
              key={partner.ownerId || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Partner Header */}
              <div className="bg-gradient-to-r from-[#003580] to-[#0071c2] text-white p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                    👤
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{partner.name}</h3>
                    {partner.phone && (
                      <p className="text-sm opacity-80">📞 {partner.phone}</p>
                    )}
                    {partner.type && (
                      <p className="text-xs mt-1 bg-white/20 px-2 py-0.5 rounded-full inline-block">
                        {partner.type === 'company_owner' ? '👑 مالك الشركة' : '💰 مستثمر'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Partner Stats */}
              <div className="p-4">
                {/* Apartments */}
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-gray-600 mb-2">الشقق المشارك فيها:</h4>
                  <div className="space-y-2">
                    {partner.apartments.map((apt, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🏢</span>
                          <span className="text-sm font-medium">{apt.name}</span>
                          {apt.isMainOwner && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                              مالك رئيسي
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-[#003580]">{apt.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Earnings */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 p-3 rounded-xl text-center">
                      <div className="text-xs text-gray-600 mb-1">إجمالي الأرباح</div>
                      <div className="text-xl font-black text-green-600">
                        ${partner.totalEarnings.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {partner.totalEarningsEGP.toFixed(0)} ج.م
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl text-center">
                      <div className="text-xs text-gray-600 mb-1">عدد الحجوزات</div>
                      <div className="text-xl font-black text-blue-600">
                        {partner.bookingsCount}
                      </div>
                      <div className="text-xs text-gray-500">حجز</div>
                    </div>
                  </div>
                </div>

                {/* View Details Button */}
                <button
                  onClick={() => setSelectedPartner(partner)}
                  className="w-full mt-4 bg-[#003580] text-white py-2 rounded-xl font-bold hover:bg-[#00264d] transition-colors"
                >
                  عرض التفاصيل
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Partner Details Modal */}
      {selectedPartner && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPartner(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#003580] to-[#0071c2] text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                    👤
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedPartner.name}</h2>
                    {selectedPartner.phone && <p className="opacity-80">📞 {selectedPartner.phone}</p>}
                    {selectedPartner.email && <p className="opacity-80">✉️ {selectedPartner.email}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="text-white/80 hover:text-white text-3xl"
                >
                  ×
                </button>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-sm opacity-80">إجمالي الأرباح</div>
                  <div className="text-2xl font-black">${selectedPartner.totalEarnings.toFixed(2)}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-sm opacity-80">بالجنيه المصري</div>
                  <div className="text-2xl font-black">{selectedPartner.totalEarningsEGP.toFixed(0)} ج.م</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-sm opacity-80">عدد الحجوزات</div>
                  <div className="text-2xl font-black">{selectedPartner.bookingsCount}</div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📋 تفاصيل الحجوزات والأرباح</h3>
              
              {getPartnerBookings(selectedPartner).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p>لا توجد حجوزات حتى الآن</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">الشقة</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">الضيف</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">التاريخ</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">ربح الحجز</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">نسبتك</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">حصتك</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPartnerBookings(selectedPartner).map((booking, i) => (
                        <tr key={booking._id || i} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{booking.apartmentName}</td>
                          <td className="px-4 py-3 text-sm">{booking.guestName || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            {booking.checkIn ? new Date(booking.checkIn).toLocaleDateString('ar-EG') : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-700">
                            ${(booking.brokerProfit || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">
                              {booking.partnerPercentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-green-600">${booking.partnerShare.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">{booking.partnerShareEGP.toFixed(0)} ج.م</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Partner Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border-2 border-gray-100"
            >
              <div className="bg-gradient-to-r from-[#003580] to-[#0071c2] text-white px-6 py-5 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  ➕ إضافة شريك جديد
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddPartner} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      الاسم <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newPartner.name}
                      onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                      placeholder="اسم الشريك"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0071c2]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      رقم الهاتف <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newPartner.phone}
                      onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                      placeholder="رقم الهاتف"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0071c2]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      البريد الإلكتروني (اختياري)
                    </label>
                    <input
                      type="email"
                      value={newPartner.email}
                      onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                      placeholder="example@email.com"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0071c2]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      نوع الشريك <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newPartner.type}
                      onChange={(e) => setNewPartner({ ...newPartner, type: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0071c2] bg-white"
                      required
                    >
                      <option value="investor">مستثمر (Investor)</option>
                      <option value="company_owner">مالك الشركة (Company Owner)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      المستثمر: يحصل على نسبة من ربح الشقة | مالك الشركة: يحصل على نسبة من ربح الشركة
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      النسبة الافتراضية (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newPartner.defaultSharePercentage}
                      onChange={(e) => setNewPartner({ ...newPartner, defaultSharePercentage: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0071c2]"
                    />
                    <p className="text-xs text-gray-500 mt-1">النسبة الافتراضية للشريك (يمكن تغييرها عند إضافة الشقة)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      ملاحظات (اختياري)
                    </label>
                    <textarea
                      value={newPartner.notes}
                      onChange={(e) => setNewPartner({ ...newPartner, notes: e.target.value })}
                      placeholder="ملاحظات إضافية عن الشريك..."
                      rows="3"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#0071c2] resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-bold hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/30 transition-all duration-200"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-all duration-200"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Partners

