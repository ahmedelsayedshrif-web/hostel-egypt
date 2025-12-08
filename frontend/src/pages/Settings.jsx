import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { settingsAPI, currencyAPI } from '../services/api'
import { useToast, ConfirmDialog as ConfirmDialogComponent } from '../components/Toast'
import axios from 'axios'

const API_URL = window.location.origin + '/api'

const Settings = () => {
  const [amenities, setAmenities] = useState([])
  const [newAmenity, setNewAmenity] = useState('')
  const [currencyRates, setCurrencyRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showAddCurrency, setShowAddCurrency] = useState(false)
  const [newCurrency, setNewCurrency] = useState({ currency: '', rateToEGP: '', symbol: '' })
  const [currencyDeleteConfirm, setCurrencyDeleteConfirm] = useState({ open: false, currency: null })
  const toast = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [amenitiesRes, ratesRes] = await Promise.all([
        settingsAPI.getAmenities().catch(() => ({ data: [] })),
        currencyAPI.getRates().catch(() => ({ data: [] }))
      ])
      setAmenities(amenitiesRes.data || [])
      setCurrencyRates(ratesRes.data || [])
      
      // Get last updated time from rates
      if (ratesRes.data && ratesRes.data.length > 0) {
        const lastUpdate = ratesRes.data.find(r => r.lastUpdated)?.lastUpdated
        if (lastUpdate) setLastUpdated(new Date(lastUpdate))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshFromInternet = async () => {
    setRefreshing(true)
    try {
      const response = await currencyAPI.refreshFromInternet()
      if (response.data?.success) {
        toast.success('تم تحديث أسعار الصرف من الإنترنت بنجاح! 🌐')
        setLastUpdated(new Date())
        fetchData() // Reload the rates
      } else {
        toast.error(response.data?.error || 'فشل في تحديث الأسعار')
      }
    } catch (error) {
      console.error('Error refreshing rates:', error)
      const errorMsg = error.response?.data?.error || 'فشل في الاتصال بالإنترنت. تأكد من اتصالك بالشبكة.'
      toast.error(errorMsg)
    } finally {
      setRefreshing(false)
    }
  }

  const handleAddAmenity = async (e) => {
    e.preventDefault()
    if (!newAmenity.trim()) return

    try {
      await settingsAPI.addAmenity(newAmenity.trim())
      setNewAmenity('')
      toast.success('تم إضافة المرفق بنجاح')
      fetchData()
    } catch (error) {
      console.error('Error adding amenity:', error)
      toast.error('حدث خطأ أثناء إضافة المرفق')
    }
  }

  const handleDeleteAmenity = async (name) => {
    try {
      await settingsAPI.deleteAmenity(name)
      toast.success('تم حذف المرفق')
      fetchData()
    } catch (error) {
      console.error('Error deleting amenity:', error)
      toast.error('حدث خطأ أثناء حذف المرفق')
    }
  }

  const handleUpdateRate = async (currency, newRate) => {
    try {
      await currencyAPI.updateRate(currency, { rateToEGP: parseFloat(newRate) })
      toast.success(`تم تحديث سعر ${currency}`)
      fetchData()
    } catch (error) {
      console.error('Error updating rate:', error)
      toast.error('حدث خطأ أثناء تحديث السعر')
    }
  }

  const handleAddCurrency = async (e) => {
    e.preventDefault()
    if (!newCurrency.currency.trim() || !newCurrency.rateToEGP) {
      toast.error('يرجى إدخال اسم العملة والسعر')
      return
    }

    try {
      await currencyAPI.createRate({
        currency: newCurrency.currency.trim().toUpperCase(),
        rateToEGP: parseFloat(newCurrency.rateToEGP),
        symbol: newCurrency.symbol.trim() || newCurrency.currency.trim().toUpperCase()
      })
      toast.success(`تم إضافة عملة ${newCurrency.currency.toUpperCase()} بنجاح`)
      setShowAddCurrency(false)
      setNewCurrency({ currency: '', rateToEGP: '', symbol: '' })
      fetchData()
    } catch (error) {
      console.error('Error adding currency:', error)
      const errorMsg = error.response?.data?.error || 'حدث خطأ أثناء إضافة العملة'
      toast.error(errorMsg)
    }
  }

  const handleDeleteCurrency = (currency) => {
    setCurrencyDeleteConfirm({ open: true, currency })
  }

  const confirmDeleteCurrency = async () => {
    const { currency } = currencyDeleteConfirm
    if (!currency) return

    try {
      await currencyAPI.deleteRate(currency)
      toast.success(`تم حذف عملة ${currency} بنجاح`)
      setCurrencyDeleteConfirm({ open: false, currency: null })
      fetchData()
    } catch (error) {
      console.error('Error deleting currency:', error)
      const errorMsg = error.response?.data?.error || 'حدث خطأ أثناء حذف العملة'
      toast.error(errorMsg)
    }
  }

  const isStandardCurrency = (currency) => {
    const standard = ['USD', 'EUR', 'GBP', 'SAR', 'AED']
    return standard.includes(currency)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-booking-blue">الإعدادات</h1>

      {/* Currency Rates Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-6 mb-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-booking-blue flex items-center gap-2">
              💱 أسعار الصرف
            </h2>
            <p className="text-gray-600 mt-1">
              عدّل أسعار الصرف الحالية مقابل الجنيه المصري
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col items-end gap-2">
            <button
              onClick={handleRefreshFromInternet}
              disabled={refreshing}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                refreshing 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  جاري التحديث...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  تحديث من الإنترنت
                </>
              )}
            </button>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                آخر تحديث: {lastUpdated.toLocaleDateString('ar-EG', { 
                  day: 'numeric', 
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {currencyRates.map((rate, index) => (
            <motion.div
              key={`${rate.currency}-${rate.rateToEGP}-${rate.lastUpdated || index}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
              className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200 relative group"
            >
              {rate.source && (
                <span className="absolute top-2 left-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                  🌐 مباشر
                </span>
              )}
              
              {/* Delete button for manually added currencies */}
              {!isStandardCurrency(rate.currency) && (
                <button
                  onClick={() => handleDeleteCurrency(rate.currency)}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="حذف العملة"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-blue-800">{rate.currency}</span>
                <span className="text-lg font-semibold">{rate.symbol || rate.currency}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">1 {rate.currency} =</span>
                <input
                  type="number"
                  step="0.01"
                  key={`input-${rate.currency}-${rate.rateToEGP}`}
                  defaultValue={rate.rateToEGP}
                  onBlur={(e) => {
                    if (e.target.value !== rate.rateToEGP.toString()) {
                      handleUpdateRate(rate.currency, e.target.value)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.target.blur()
                    }
                  }}
                  className="w-24 px-3 py-2 border-2 border-blue-300 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">ج.م</span>
              </div>
              {!rate.source && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  إضافة يدوية
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
        {/* Add New Currency Button */}
        <div className="mt-4">
          {!showAddCurrency ? (
            <button
              onClick={() => setShowAddCurrency(true)}
              className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              إضافة عملة جديدة
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border-2 border-indigo-200"
            >
              <h3 className="text-lg font-bold text-indigo-800 mb-4">إضافة عملة جديدة</h3>
              <form onSubmit={handleAddCurrency} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">رمز العملة *</label>
                    <input
                      type="text"
                      value={newCurrency.currency}
                      onChange={(e) => setNewCurrency({ ...newCurrency, currency: e.target.value.toUpperCase() })}
                      placeholder="مثال: KWD, OMR, QAR"
                      className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                      required
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">السعر (جنيه مصري) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newCurrency.rateToEGP}
                      onChange={(e) => setNewCurrency({ ...newCurrency, rateToEGP: e.target.value })}
                      placeholder="مثال: 13.6"
                      className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">الرمز</label>
                    <input
                      type="text"
                      value={newCurrency.symbol}
                      onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                      placeholder="مثال: د.إ, ر.ق"
                      className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all"
                  >
                    ✓ إضافة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCurrency(false)
                      setNewCurrency({ currency: '', rateToEGP: '', symbol: '' })
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </div>
        
        {/* Currency Delete Confirmation */}
        <ConfirmDialogComponent
          isOpen={currencyDeleteConfirm.open}
          onClose={() => setCurrencyDeleteConfirm({ open: false, currency: null })}
          onConfirm={confirmDeleteCurrency}
          title="حذف العملة"
          message={`هل أنت متأكد من حذف عملة ${currencyDeleteConfirm.currency}؟ لا يمكن التراجع عن هذا الإجراء.`}
          confirmText="حذف"
          cancelText="إلغاء"
          type="danger"
        />
        
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800 flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>
              <strong>ملاحظة مهمة:</strong> تحديث أسعار الصرف يؤثر فقط على الحجوزات الجديدة. 
              الحجوزات المسجلة سابقاً تحتفظ بسعر الصرف الذي كان وقت إنشائها ولن تتأثر بالتحديث.
            </span>
          </p>
        </div>
      </motion.div>

      {/* Amenities Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-lg p-6 mb-6"
      >
        <h2 className="text-2xl font-bold mb-4 text-booking-blue flex items-center gap-2">
          🏠 المرافق
        </h2>
        <p className="text-gray-600 mb-4">
          أضف مرافق جديدة لتظهر تلقائياً في صفحة إضافة الشقة
        </p>

        {/* Add Amenity Form */}
        <form onSubmit={handleAddAmenity} className="mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={newAmenity}
              onChange={(e) => setNewAmenity(e.target.value)}
              placeholder="أدخل اسم المرفق (مثل: واي فاي، جاكوزي، فيو بحر)"
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-booking-blue focus:border-transparent"
            />
            <button
              type="submit"
              className="bg-booking-yellow text-booking-blue px-8 py-3 rounded-xl font-bold hover:bg-yellow-500 transition-colors"
            >
              إضافة
            </button>
          </div>
        </form>

        {/* Amenities List */}
        {loading ? (
          <div className="text-center py-4">جاري التحميل...</div>
        ) : amenities.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <p>لا توجد مرافق مضافة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {amenities.map((amenity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200 group hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-800">{amenity}</span>
                <button
                  onClick={() => handleDeleteAmenity(amenity)}
                  className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="حذف"
                >
                  ×
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 mb-6"
      >
        <h3 className="text-xl font-bold mb-3 text-booking-blue">💡 معلومات مهمة</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>أسعار الصرف تُستخدم تلقائياً في حساب المبالغ بالجنيه المصري</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>المرافق المضافة تظهر في صفحة إضافة/تعديل الشقة</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>اضغط Enter أو انقر خارج حقل السعر لحفظ التغيير</span>
          </li>
        </ul>
      </motion.div>

      {/* Danger Zone - Delete All Data */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold mb-3 text-red-600 flex items-center gap-2">
          ⚠️ منطقة الخطر
        </h3>
        <p className="text-gray-700 mb-4">
          احذر! هذا الإجراء سيحذف جميع البيانات المدخلة في النظام بشكل نهائي ولا يمكن التراجع عنه.
        </p>
        <div className="bg-white rounded-xl p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-red-700">🗑️ حذف جميع البيانات</h4>
              <p className="text-sm text-gray-600">حذف الشركاء، الشقق، والحجوزات</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              🗑️ حذف الكل
            </button>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold text-red-600 mb-2">تأكيد الحذف النهائي</h3>
                <p className="text-gray-600">
                  سيتم حذف جميع البيانات التالية بشكل نهائي:
                </p>
              </div>
              
              <div className="bg-red-50 rounded-xl p-4 mb-6">
                <ul className="space-y-2 text-red-700">
                  <li className="flex items-center gap-2">
                    <span>❌</span> جميع الشركاء
                  </li>
                  <li className="flex items-center gap-2">
                    <span>❌</span> جميع الشقق
                  </li>
                  <li className="flex items-center gap-2">
                    <span>❌</span> جميع الحجوزات
                  </li>
                  <li className="flex items-center gap-2">
                    <span>❌</span> جميع المصاريف
                  </li>
                </ul>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  للتأكيد، اكتب <strong className="text-red-600">حذف الكل</strong> في الحقل أدناه:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="اكتب: حذف الكل"
                  className="w-full px-4 py-3 border-2 border-red-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-center font-bold"
                  disabled={deleting}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (deleteConfirmText !== 'حذف الكل') {
                      toast.error('يرجى كتابة "حذف الكل" للتأكيد')
                      return
                    }
                    setDeleting(true)
                    try {
                      await axios.delete(`${API_URL}/data/all`)
                      toast.success('تم حذف جميع البيانات بنجاح')
                      setShowDeleteConfirm(false)
                      setDeleteConfirmText('')
                      // Reload the page to reflect changes
                      setTimeout(() => window.location.reload(), 1500)
                    } catch (error) {
                      console.error('Error deleting data:', error)
                      toast.error('حدث خطأ أثناء حذف البيانات')
                    } finally {
                      setDeleting(false)
                    }
                  }}
                  disabled={deleteConfirmText !== 'حذف الكل' || deleting}
                  className={`flex-1 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                    deleteConfirmText === 'حذف الكل' && !deleting
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      جاري الحذف...
                    </>
                  ) : (
                    <>🗑️ حذف نهائي</>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText('')
                  }}
                  disabled={deleting}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Settings
