import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { inventoryAPI, fundAPI, apartmentsAPI } from '../services/api'
import { useToast, ConfirmDialog } from '../components/Toast'
import { uploadImageToFirebase, deleteImageFromFirebase } from '../services/firebase'

const Inventory = () => {
  const [items, setItems] = useState([])
  const [apartments, setApartments] = useState([])
  const [fundBalance, setFundBalance] = useState({ balance: 0, balanceEGP: 0 })
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    location: ''
  })
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'Furniture',
    quantity: 1,
    valuePerUnit: 0,
    condition: 'New',
    currentLocation: 'warehouse',
    description: '',
    imageFile: null,
    imagePreview: null,
    imageURL: null, // Firebase URL
    payViaFund: false
  })
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchData()
  }, [filters])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [itemsRes, apartmentsRes, balanceRes] = await Promise.all([
        inventoryAPI.getAll(filters).catch(() => ({ data: [] })),
        apartmentsAPI.getAll().catch(() => ({ data: [] })),
        fundAPI.getBalance().catch(() => ({ data: { balance: 0, balanceEGP: 0 } }))
      ])
      
      setItems(Array.isArray(itemsRes.data) ? itemsRes.data : [])
      setApartments(Array.isArray(apartmentsRes.data) ? apartmentsRes.data : [])
      setFundBalance(balanceRes.data || { balance: 0, balanceEGP: 0 })
    } catch (error) {
      console.error('Error fetching data:', error)
      // Don't show toast on initial load errors
    } finally {
      setLoading(false)
    }
  }

  const toast = useToast()

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate image size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('حجم الصورة يجب أن يكون أقل من 5 ميجابايت')
        return
      }
      
      // Validate image type
      if (!file.type.startsWith('image/')) {
        toast.warning('الملف يجب أن يكون صورة')
        return
      }

      // Show preview immediately
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          imageFile: file,
          imagePreview: reader.result
        }))
      }
      reader.readAsDataURL(file)

      // Upload to Firebase Storage
      try {
        setUploading(true)
        setUploadProgress(0)
        
        const downloadURL = await uploadImageToFirebase(
          file,
          'inventory_images',
          (progress) => setUploadProgress(progress)
        )
        
        setFormData(prev => ({
          ...prev,
          imageURL: downloadURL
        }))
        
        toast.success('تم رفع الصورة بنجاح')
      } catch (error) {
        console.error('Error uploading image:', error)
        toast.error('فشل رفع الصورة. يرجى المحاولة مرة أخرى.')
        // Keep preview but clear file so user can retry
        setFormData(prev => ({
          ...prev,
          imageFile: null,
          imagePreview: null,
          imageURL: null
        }))
      } finally {
        setUploading(false)
        setUploadProgress(0)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name || !formData.category || !formData.quantity || formData.quantity <= 0) {
      toast.warning('يرجى إكمال جميع الحقول المطلوبة')
      return
    }

    // Validate: Cannot assign damaged items
    if (formData.condition === 'Damaged' && formData.currentLocation !== 'warehouse') {
      toast.error('لا يمكن تعيين عنصر تالف إلى شقة أو غرفة')
      return
    }

    // Calculate total cost
    const totalCost = formData.valuePerUnit * formData.quantity
    const exchangeRate = 50 // Default, should get from currency rates
    const totalCostEGP = totalCost * exchangeRate

    // Check fund balance if paying via fund
    if (formData.payViaFund && totalCost > 0) {
      if (fundBalance.balance < totalCost) {
        const willBeNegative = true
        const confirmed = window.confirm(
          `⚠️ الرصيد الحالي في صندوق التطوير: $${fundBalance.balance.toFixed(2)}\n` +
          `المبلغ المطلوب: $${totalCost.toFixed(2)}\n` +
          `سيؤدي هذا إلى رصيد سالب (مديونية). هل تريد المتابعة؟`
        )
        if (!confirmed) return
      }
    }

    try {
      // Use Firebase URL if available, otherwise use preview (for backward compatibility)
      let imageURL = formData.imageURL || formData.imagePreview || null
      
      // Create form data
      const submitData = {
        name: formData.name,
        category: formData.category,
        quantity: parseInt(formData.quantity),
        valuePerUnit: parseFloat(formData.valuePerUnit),
        condition: formData.condition,
        currentLocation: formData.currentLocation,
        description: formData.description || '',
        imageURL: imageURL, // Firebase Storage URL or null
        payViaFund: formData.payViaFund,
        fundAmount: formData.payViaFund ? totalCost : 0
      }

      if (selectedItem && showEditModal) {
        // Update existing item
        await inventoryAPI.update(selectedItem._id, submitData)
        toast.success('تم تحديث العنصر بنجاح')
        setShowEditModal(false)
      } else {
        // Create new item
        await inventoryAPI.create(submitData)
        toast.success('تم إضافة العنصر بنجاح')
        setShowAddModal(false)
      }

      // Reset form
      setFormData({
        name: '',
        category: 'Furniture',
        quantity: 1,
        valuePerUnit: 0,
        condition: 'New',
        currentLocation: 'warehouse',
        description: '',
        imageFile: null,
        imagePreview: null,
        imageURL: null,
        payViaFund: false
      })
      setSelectedItem(null)
      fetchData()
    } catch (error) {
      console.error('Error saving item:', error)
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء حفظ العنصر')
    }
  }

  const handleEdit = (item) => {
    setSelectedItem(item)
    setFormData({
      name: item.name || '',
      category: item.category || 'Furniture',
      quantity: item.quantity || 1,
      valuePerUnit: item.valuePerUnit || 0,
      condition: item.condition || 'New',
      currentLocation: item.currentLocation || 'warehouse',
      description: item.description || '',
      imageFile: null,
      imagePreview: item.imageURL || null,
      imageURL: item.imageURL || null, // Firebase URL
      payViaFund: false // Don't allow paying again when editing
    })
    setShowEditModal(true)
  }

  const handleDelete = async (id) => {
    try {
      // Get item first to check for image
      const item = items.find(i => i._id === id)
      if (item && item.imageURL && item.imageURL.includes('firebasestorage.googleapis.com')) {
        // Delete image from Firebase Storage
        try {
          await deleteImageFromFirebase(item.imageURL)
        } catch (error) {
          console.error('Error deleting image from Firebase:', error)
          // Continue with item deletion even if image deletion fails
        }
      }
      
      await inventoryAPI.delete(id)
      toast.success('تم حذف العنصر بنجاح')
      fetchData()
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('حدث خطأ أثناء حذف العنصر')
    }
  }

  const getConditionColor = (condition) => {
    switch (condition) {
      case 'New': return 'bg-green-100 text-green-800 border-green-300'
      case 'Used': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'Damaged': return 'bg-red-100 text-red-800 border-red-300'
      case 'Needs Repair': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getConditionLabel = (condition) => {
    switch (condition) {
      case 'New': return 'جديد'
      case 'Used': return 'مستعمل'
      case 'Damaged': return 'تالف'
      case 'Needs Repair': return 'يحتاج إصلاح'
      default: return condition
    }
  }

  const getCategoryLabel = (category) => {
    const labels = {
      'Furniture': 'أثاث',
      'Electronics': 'إلكترونيات',
      'Spare Parts': 'قطع غيار',
      'Appliances': 'أجهزة',
      'Other': 'أخرى'
    }
    return labels[category] || category
  }

  const totalValue = items.reduce((sum, item) => sum + (item.totalValue || 0), 0)
  const warehouseItems = items.filter(i => i.currentLocation === 'warehouse').length
  const assignedItems = items.filter(i => i.currentLocation !== 'warehouse').length

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#003580]">📦 المخزون</h1>
          <p className="text-gray-600 mt-1">إدارة العناصر والمعدات</p>
        </div>
        <button
          onClick={() => {
            setFormData({
              name: '',
              category: 'Furniture',
              quantity: 1,
              valuePerUnit: 0,
              condition: 'New',
              currentLocation: 'warehouse',
              description: '',
              imageFile: null,
              imagePreview: null,
              imageURL: null,
              payViaFund: false
            })
            setSelectedItem(null)
            setShowAddModal(true)
          }}
          className="bg-[#febb02] text-[#003580] px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          إضافة عنصر جديد
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-4 shadow-lg border-2 border-gray-200"
        >
          <div className="text-gray-600 text-sm mb-1">إجمالي العناصر</div>
          <div className="text-2xl font-bold text-gray-800">{items.length}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-4 shadow-lg border-2 border-gray-200"
        >
          <div className="text-gray-600 text-sm mb-1">القيمة الإجمالية</div>
          <div className="text-2xl font-bold text-green-600">{totalValue.toFixed(2)} ج.م</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-4 shadow-lg border-2 border-gray-200"
        >
          <div className="text-gray-600 text-sm mb-1">في المستودع</div>
          <div className="text-2xl font-bold text-blue-600">{warehouseItems}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-4 shadow-lg border-2 border-gray-200"
        >
          <div className="text-gray-600 text-sm mb-1">مخصصة</div>
          <div className="text-2xl font-bold text-purple-600">{assignedItems}</div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-lg mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-gray-700 font-bold mb-2">الفئة</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
            >
              <option value="">جميع الفئات</option>
              <option value="Furniture">أثاث</option>
              <option value="Electronics">إلكترونيات</option>
              <option value="Spare Parts">قطع غيار</option>
              <option value="Appliances">أجهزة</option>
              <option value="Other">أخرى</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-gray-700 font-bold mb-2">الحالة</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
            >
              <option value="">جميع الحالات</option>
              <option value="New">جديد</option>
              <option value="Used">مستعمل</option>
              <option value="Damaged">تالف</option>
              <option value="Needs Repair">يحتاج إصلاح</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-gray-700 font-bold mb-2">الموقع</label>
            <select
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
            >
              <option value="">جميع المواقع</option>
              <option value="warehouse">المستودع</option>
              {apartments.map(apt => (
                <option key={apt._id} value={apt._id}>{apt.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-[#0071c2] text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📊 Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                viewMode === 'list' 
                  ? 'bg-[#0071c2] text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📋 List
            </button>
          </div>
        </div>
      </div>

      {/* Items Display */}
      {loading ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">لا توجد عناصر</h3>
          <p className="text-gray-600 mb-6">ابدأ بإضافة أول عنصر للمخزون</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-200 hover:border-[#0071c2] transition-all cursor-pointer"
            >
              {/* Image */}
              <div className="relative h-48 bg-gray-200">
                {item.imageURL ? (
                  <img
                    src={item.imageURL}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/400x300?text=No+Image'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                    📦
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getConditionColor(item.condition)}`}>
                    {getConditionLabel(item.condition)}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">{item.name}</h3>
                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  <div className="flex justify-between">
                    <span>الفئة:</span>
                    <span className="font-bold">{getCategoryLabel(item.category)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الكمية:</span>
                    <span className="font-bold">{item.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>القيمة:</span>
                    <span className="font-bold text-green-600">{(item.totalValue || 0).toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الموقع:</span>
                    <span className="font-bold text-blue-600">
                      {item.currentLocation === 'warehouse' 
                        ? 'المستودع' 
                        : apartments.find(a => a._id === item.currentLocation)?.name || 'غير محدد'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(item)
                    }}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm({ open: true, id: item._id })
                    }}
                    className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">الصورة</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">الاسم</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">الفئة</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">الكمية</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">الموقع</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">القيمة</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => (
                <motion.tr
                  key={item._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    {item.imageURL ? (
                      <img
                        src={item.imageURL}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/64x64?text=No+Image'
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-2xl">
                        📦
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 mt-1">{item.description.substring(0, 50)}...</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getCategoryLabel(item.category)}</td>
                  <td className="px-6 py-4 text-sm font-bold">{item.quantity}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getConditionColor(item.condition)}`}>
                      {getConditionLabel(item.condition)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {item.currentLocation === 'warehouse' 
                      ? 'المستودع' 
                      : apartments.find(a => a._id === item.currentLocation)?.name || 'غير محدد'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-green-600">
                    {(item.totalValue || 0).toFixed(2)} ج.م
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ open: true, id: item._id })}
                        className="px-3 py-1 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowAddModal(false)
              setShowEditModal(false)
              setSelectedItem(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {showEditModal ? 'تعديل عنصر' : 'إضافة عنصر جديد'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      setShowEditModal(false)
                      setSelectedItem(null)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="md:col-span-2">
                      <label className="block text-gray-700 font-bold mb-2">اسم العنصر *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                        placeholder="مثال: سرير مفرد"
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">الفئة *</label>
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                      >
                        <option value="Furniture">أثاث</option>
                        <option value="Electronics">إلكترونيات</option>
                        <option value="Spare Parts">قطع غيار</option>
                        <option value="Appliances">أجهزة</option>
                        <option value="Other">أخرى</option>
                      </select>
                    </div>

                    {/* Condition */}
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">الحالة *</label>
                      <select
                        required
                        value={formData.condition}
                        onChange={(e) => {
                          const newCondition = e.target.value
                          setFormData({
                            ...formData,
                            condition: newCondition,
                            // Reset location to warehouse if damaged
                            currentLocation: newCondition === 'Damaged' ? 'warehouse' : formData.currentLocation
                          })
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                      >
                        <option value="New">جديد</option>
                        <option value="Used">مستعمل</option>
                        <option value="Damaged">تالف</option>
                        <option value="Needs Repair">يحتاج إصلاح</option>
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">الكمية *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      />
                    </div>

                    {/* Value Per Unit */}
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">سعر الوحدة (EGP) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={formData.valuePerUnit}
                        onChange={(e) => setFormData({ ...formData, valuePerUnit: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                      />
                    </div>

                    {/* Current Location */}
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">الموقع الحالي</label>
                      <select
                        value={formData.currentLocation}
                        onChange={(e) => setFormData({ ...formData, currentLocation: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] bg-white"
                        disabled={formData.condition === 'Damaged'}
                      >
                        <option value="warehouse">المستودع</option>
                        {apartments.map(apt => (
                          <option key={apt._id} value={apt._id}>{apt.name}</option>
                        ))}
                      </select>
                      {formData.condition === 'Damaged' && (
                        <p className="text-xs text-red-600 mt-1">لا يمكن تعيين عنصر تالف إلى شقة</p>
                      )}
                    </div>

                    {/* Image Upload */}
                    <div className="md:col-span-2">
                      <label className="block text-gray-700 font-bold mb-2">صورة العنصر</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={uploading}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2] disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      {uploading && (
                        <div className="mt-2">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${uploadProgress}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-blue-600 font-bold">{Math.round(uploadProgress)}%</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">جاري رفع الصورة إلى Firebase Storage...</p>
                          </div>
                        </div>
                      )}
                      {formData.imagePreview && !uploading && (
                        <div className="mt-2">
                          <img
                            src={formData.imagePreview}
                            alt="Preview"
                            className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                          />
                          {formData.imageURL && (
                            <p className="text-xs text-green-600 mt-1">✓ تم رفع الصورة بنجاح</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-gray-700 font-bold mb-2">الوصف</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#0071c2]"
                        rows="3"
                        placeholder="وصف العنصر..."
                      />
                    </div>

                    {/* Pay via Development Fund - Only for new items */}
                    {!showEditModal && (
                      <div className="md:col-span-2 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.payViaFund}
                            onChange={(e) => setFormData({ ...formData, payViaFund: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <div>
                            <span className="font-bold text-gray-800">💎 الدفع من صندوق التطوير</span>
                            <p className="text-sm text-gray-600 mt-1">
                              سيتم خصم قيمة الشراء ({formData.quantity * formData.valuePerUnit} ج.م ≈ ${((formData.quantity * formData.valuePerUnit) / 50).toFixed(2)}) من صندوق التطوير
                            </p>
                            {formData.payViaFund && formData.valuePerUnit > 0 && (
                              <p className={`text-sm font-bold mt-2 ${
                                fundBalance.balance < ((formData.quantity * formData.valuePerUnit) / 50)
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }`}>
                                الرصيد الحالي: ${fundBalance.balance.toFixed(2)} | 
                                المبلغ المطلوب: ${((formData.quantity * formData.valuePerUnit) / 50).toFixed(2)}
                                {fundBalance.balance < ((formData.quantity * formData.valuePerUnit) / 50) && ' ⚠️ (رصيد غير كافي)'}
                              </p>
                            )}
                          </div>
                        </label>
                      </div>
                    )}

                    {/* Total Cost Display */}
                    {formData.quantity > 0 && formData.valuePerUnit > 0 && (
                      <div className="md:col-span-2 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800">التكلفة الإجمالية:</span>
                          <span className="text-2xl font-black text-green-600">
                            {(formData.quantity * formData.valuePerUnit).toFixed(2)} ج.م
                            <span className="text-sm text-gray-600 mr-2">
                              (≈ ${((formData.quantity * formData.valuePerUnit) / 50).toFixed(2)})
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false)
                        setShowEditModal(false)
                        setSelectedItem(null)
                      }}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-[#febb02] text-[#003580] rounded-lg font-bold hover:bg-yellow-500"
                    >
                      {showEditModal ? 'تحديث' : 'إضافة'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={() => {
          handleDelete(deleteConfirm.id)
          setDeleteConfirm({ open: false, id: null })
        }}
        title="حذف العنصر"
        message="هل أنت متأكد من حذف هذا العنصر؟"
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />
    </div>
  )
}

export default Inventory
