import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ownersAPI } from '../services/api'
import { useToast, ConfirmDialog } from '../components/Toast'

const Owners = () => {
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  const toast = useToast()
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    percentage: 80,
    notes: '',
  })

  useEffect(() => {
    fetchOwners()
  }, [])

  const fetchOwners = async () => {
    try {
      const response = await ownersAPI.getAll().catch(err => {
        console.error('Error fetching owners:', err)
        return { data: [] }
      })
      const data = Array.isArray(response.data) ? response.data : (response.data?.owners || [])
      setOwners(data)
    } catch (error) {
      console.error('Error fetching owners:', error)
      setOwners([])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name || !formData.phone) {
      toast.warning('الاسم والهاتف مطلوبان!')
      return
    }
    
    if (formData.percentage < 0 || formData.percentage > 100) {
      toast.warning('النسبة يجب أن تكون بين 0 و 100')
      return
    }
    
    try {
      await ownersAPI.create(formData)
      toast.success('تم إضافة المالك بنجاح!')
      setShowModal(false)
      setFormData({ name: '', phone: '', email: '', percentage: 80, notes: '' })
      await fetchOwners()
    } catch (error) {
      console.error('Error creating owner:', error)
      if (error.response?.status === 400) {
        toast.error(error.response.data?.error || 'بيانات غير صحيحة')
      } else {
        toast.error('حدث خطأ أثناء إضافة المالك')
      }
    }
  }

  const handleDelete = async (id) => {
    try {
      await ownersAPI.delete(id)
      toast.success('تم حذف المالك بنجاح')
      fetchOwners()
    } catch (error) {
      console.error('Error deleting owner:', error)
      toast.error('حدث خطأ أثناء حذف المالك')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-booking-blue">إدارة الملاك</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-booking-yellow text-booking-blue px-6 py-2 rounded-md font-bold hover:bg-yellow-500"
        >
          + إضافة مالك جديد
        </button>
      </div>

      {owners.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600 text-xl mb-6">لا يوجد ملاك مسجلين</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-booking-yellow text-booking-blue px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors"
          >
            أضف أول مالك
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {owners.map((owner, index) => (
            <motion.div
              key={owner._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <h3 className="text-xl font-bold text-gray-800 mb-2">{owner.name}</h3>
              <p className="text-gray-600 mb-1">📞 {owner.phone}</p>
              {owner.email && <p className="text-gray-600 mb-1">✉️ {owner.email}</p>}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">نسبة المالك من الإيراد:</span>
                  <span className="font-bold text-booking-blue text-lg">{owner.percentage}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">
                  💡 هذه النسبة تُخصم من إجمالي الحجز لصالح المالك. الباقي بعد خصم نسبة المالك وعمولة المنصة والمصاريف = ربحك.
                </p>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-gray-600">إجمالي المستحق للمالك:</span>
                  <span className="font-bold text-purple-600">${owner.totalEarnings?.toFixed(2) || 0}</span>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => setDeleteConfirm({ open: true, id: owner._id })}
                    className="w-full bg-red-500 text-white px-4 py-2 rounded-md font-bold hover:bg-red-600 transition-colors"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Owner Modal */}
      <AnimatePresence mode="wait">
        {showModal && (
          <motion.div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-booking-blue">إضافة مالك جديد</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">الاسم *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-booking-blue"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">الهاتف *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-booking-blue"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-booking-blue"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">نسبة المالك من الإيراد (%) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={formData.percentage}
                    onChange={(e) => setFormData({ ...formData, percentage: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-booking-blue"
                  />
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800">
                      <strong>📊 طريقة الحساب:</strong><br/>
                      • نسبة المالك: {formData.percentage}% من إجمالي الحجز<br/>
                      • عمولة المنصة: تُدخل عند إضافة كل حجز<br/>
                      • ربحك = الإجمالي - نسبة المالك - عمولة المنصة - المصاريف
                    </p>
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2">ملاحظات</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-booking-blue"
                    rows="3"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-booking-yellow text-booking-blue px-4 py-3 rounded-xl font-bold hover:bg-yellow-500 transition-colors"
                  >
                    إضافة
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="حذف المالك"
        message="هل أنت متأكد من حذف هذا المالك؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />
    </div>
  )
}

export default Owners
