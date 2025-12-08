import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { apartmentsAPI, settingsAPI, partnersAPI } from '../services/api'
import { useToast } from '../components/Toast'

const AddApartment = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const fileInputRef = useRef(null)
  const toast = useToast()
  const isEditMode = !!id
  const [loading, setLoading] = useState(isEditMode)
  const [amenities, setAmenities] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [images, setImages] = useState([])
  const [partners, setPartners] = useState([]) // Partners added to this apartment
  const [availablePartners, setAvailablePartners] = useState([]) // All partners from database
  const [monthlyExpenses, setMonthlyExpenses] = useState([])
  const [rooms, setRooms] = useState([]) // Rooms with images
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    selectedAmenities: [],
    description: '',
    isActive: true,
    investmentTarget: 0,
    investmentStartDate: '',
  })

  useEffect(() => {
    fetchData()
    if (isEditMode) {
      fetchApartmentData()
    }
  }, [id])

  const fetchApartmentData = async () => {
    try {
      setLoading(true)
      const response = await apartmentsAPI.getById(id)
      const apartment = response.data
      
      if (apartment) {
        // Set form data
        setFormData({
          name: apartment.name || '',
          address: apartment.location?.address || '',
          city: apartment.location?.city || '',
          selectedAmenities: apartment.amenities || [],
          description: apartment.description || '',
          isActive: apartment.isActive !== undefined ? apartment.isActive : true,
          investmentTarget: apartment.investmentTarget || 0,
          investmentStartDate: apartment.investmentStartDate ? apartment.investmentStartDate.split('T')[0] : '',
        })
        
        // Set partners
        if (apartment.partners && Array.isArray(apartment.partners)) {
          setPartners(apartment.partners.map(p => ({
            name: p.name || '',
            percentage: p.percentage || 0,
            phone: p.phone || '',
            role: p.role || 'شريك'
          })))
        }
        
        // Set monthly expenses
        if (apartment.monthlyExpenses && Array.isArray(apartment.monthlyExpenses)) {
          setMonthlyExpenses(apartment.monthlyExpenses.map(e => ({
            name: e.name || '',
            amount: e.amount || 0,
            type: e.type || 'fixed'
          })))
        }
        
        // Set images
        if (apartment.images && Array.isArray(apartment.images)) {
          const imageObjects = apartment.images.map((imgUrl, idx) => ({
            id: Date.now() + idx,
            preview: imgUrl.startsWith('http') ? imgUrl : `http://127.0.0.1:5000${imgUrl}`,
            file: null, // Existing image, no file object
            isExisting: true,
            url: imgUrl
          }))
          setImages(imageObjects)
        }

        // Set rooms
        if (apartment.rooms && Array.isArray(apartment.rooms)) {
          const roomsWithImages = apartment.rooms.map(room => ({
            roomId: room.roomId || `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            roomNumber: room.roomNumber || '',
            type: room.type || 'Single',
            beds: room.beds || 1,
            bathroomType: room.bathroomType || 'private',
            images: (room.images || []).map((imgUrl, idx) => ({
              id: `existing_${idx}`,
              preview: imgUrl.startsWith('http') ? imgUrl : `http://127.0.0.1:5000${imgUrl}`,
              file: null,
              isExisting: true,
              url: imgUrl
            }))
          }))
          setRooms(roomsWithImages)
        }
      }
    } catch (error) {
      console.error('Error fetching apartment:', error)
      toast.error('حدث خطأ أثناء تحميل بيانات الشقة')
      navigate('/apartments')
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      const [amenitiesRes, partnersRes] = await Promise.all([
        settingsAPI.getAmenities().catch(() => ({ data: [] })),
        partnersAPI.getAll().catch(() => ({ data: [] }))
      ])
      setAmenities(Array.isArray(amenitiesRes.data) ? amenitiesRes.data : [])
      setAvailablePartners(Array.isArray(partnersRes.data) ? partnersRes.data : [])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFiles = (files) => {
    const fileArray = Array.from(files)
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'))
    
    imageFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImages(prev => [...prev, {
          file,
          preview: e.target.result,
          id: Date.now() + Math.random()
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }

  const handleAmenityToggle = (amenity) => {
    setFormData(prev => ({
      ...prev,
      selectedAmenities: prev.selectedAmenities.includes(amenity)
        ? prev.selectedAmenities.filter(a => a !== amenity)
        : [...prev.selectedAmenities, amenity]
    }))
  }

  // Partner management (المسؤولين/الشركاء الإضافيين)
  const [showPartnerSelect, setShowPartnerSelect] = useState(false)
  
  const addPartner = () => {
    setShowPartnerSelect(true)
  }

  const selectPartnerFromList = (partner) => {
    // Check if partner already added
    if (partners.find(p => p.partnerId === partner._id)) {
      toast.warning('هذا الشريك مضاف بالفعل')
      return
    }
    
    setPartners([...partners, { 
      partnerId: partner._id,
      name: partner.name,
      phone: partner.phone || '',
      email: partner.email || '',
      percentage: partner.defaultSharePercentage || 0,
      role: 'شريك'
    }])
    setShowPartnerSelect(false)
  }

  const addNewPartnerManually = () => {
    setPartners([...partners, { name: '', percentage: 0, phone: '', role: 'شريك' }])
    setShowPartnerSelect(false)
  }

  const updatePartner = (index, field, value) => {
    const updated = [...partners]
    updated[index][field] = value
    setPartners(updated)
  }

  const removePartner = (index) => {
    setPartners(partners.filter((_, i) => i !== index))
  }

  // Monthly expenses management
  const addExpense = () => {
    setMonthlyExpenses([...monthlyExpenses, { name: '', amount: 0, type: 'fixed' }])
  }

  const updateExpense = (index, field, value) => {
    const updated = [...monthlyExpenses]
    updated[index][field] = value
    setMonthlyExpenses(updated)
  }

  const removeExpense = (index) => {
    setMonthlyExpenses(monthlyExpenses.filter((_, i) => i !== index))
  }

  // Room management
  const addRoom = () => {
    setRooms([...rooms, {
      roomId: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomNumber: '',
      type: 'Single',
      beds: 1,
      bathroomType: 'private', // 'private' or 'shared'
      images: []
    }])
  }

  const updateRoom = (index, field, value) => {
    const updated = [...rooms]
    updated[index][field] = value
    setRooms(updated)
  }

  const removeRoom = (index) => {
    setRooms(rooms.filter((_, i) => i !== index))
  }

  const handleRoomImageUpload = (roomIndex, files) => {
    const fileArray = Array.from(files)
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'))
    
    imageFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const updatedRooms = [...rooms]
        if (!updatedRooms[roomIndex].images) updatedRooms[roomIndex].images = []
        updatedRooms[roomIndex].images.push({
          file,
          preview: e.target.result,
          id: Date.now() + Math.random()
        })
        setRooms(updatedRooms)
      }
      reader.readAsDataURL(file)
    })
  }

  const removeRoomImage = (roomIndex, imageId) => {
    const updatedRooms = [...rooms]
    updatedRooms[roomIndex].images = updatedRooms[roomIndex].images.filter(img => img.id !== imageId)
    setRooms(updatedRooms)
  }

  const getTotalMonthlyExpenses = () => {
    return monthlyExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name || !formData.city || !formData.address) {
      toast.warning('يرجى ملء جميع الحقول المطلوبة')
      return
    }


    try {
      setUploading(true)
      const submitFormData = new FormData()
      
      submitFormData.append('name', formData.name)
      submitFormData.append('location', JSON.stringify({ city: formData.city, address: formData.address }))
      submitFormData.append('partners', JSON.stringify(partners))
      submitFormData.append('monthlyExpenses', JSON.stringify(monthlyExpenses))
      submitFormData.append('numberOfRooms', rooms.length || 0)
      submitFormData.append('amenities', JSON.stringify(formData.selectedAmenities))
      submitFormData.append('description', formData.description)
      submitFormData.append('isActive', formData.isActive)
      submitFormData.append('investmentTarget', formData.investmentTarget || 0)
      if (formData.investmentStartDate) {
        submitFormData.append('investmentStartDate', new Date(formData.investmentStartDate).toISOString())
      }

      // Handle images: only append new files, not existing ones
      images.forEach((img) => {
        if (img.file) {
          submitFormData.append('images', img.file)
        }
      })
      
      // For edit mode, also send existing image URLs
      if (isEditMode) {
        const existingImages = images.filter(img => img.isExisting).map(img => img.url)
        submitFormData.append('existingImages', JSON.stringify(existingImages))
      }

      // Handle rooms data (without images - images will be sent separately)
      const roomsData = rooms.map(room => ({
        roomId: room.roomId,
        roomNumber: room.roomNumber,
        type: room.type,
        beds: room.beds || 1,
        bathroomType: room.bathroomType || 'private',
        existingImages: room.images?.filter(img => img.isExisting).map(img => img.url) || []
      }))
      submitFormData.append('rooms', JSON.stringify(roomsData))

      // Handle room images - append images for each room
      rooms.forEach((room, roomIndex) => {
        if (room.images && room.images.length > 0) {
          room.images.forEach((img) => {
            if (img.file) {
              submitFormData.append(`room_${roomIndex}_images`, img.file)
            }
          })
        }
      })

      if (isEditMode) {
        await apartmentsAPI.update(id, submitFormData)
        toast.success('تم تحديث الشقة بنجاح!')
      } else {
        await apartmentsAPI.create(submitFormData)
        toast.success('تم إضافة الشقة بنجاح!')
      }
      navigate('/apartments')
    } catch (error) {
      console.error('Error creating apartment:', error)
      toast.error('حدث خطأ أثناء إضافة الشقة')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#003580] mb-4"></div>
          <p className="text-xl text-gray-600">جاري تحميل بيانات الشقة...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/apartments')}
            className="text-[#0071c2] hover:underline mb-4 inline-flex items-center font-medium"
          >
            ← العودة للشقق
          </button>
          <h1 className="text-3xl font-bold text-[#003580]">
            {isEditMode ? '✏️ تعديل الشقة' : '➕ إضافة شقة جديدة'}
          </h1>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-xl font-bold text-[#003580] mb-4 flex items-center gap-2">
              <span>📋</span> المعلومات الأساسية
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-bold mb-2">اسم الشقة *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: شقة فاخرة في وسط المدينة"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0071c2] text-[#1a1a1a]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-bold mb-2">المدينة *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="مثال: القاهرة"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0071c2] text-[#1a1a1a]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-2">العنوان *</label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="مثال: شارع النيل"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0071c2] text-[#1a1a1a]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-2">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف تفصيلي للشقة..."
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0071c2] text-[#1a1a1a]"
                />
              </div>

              {/* Investment Tracking */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-gray-700 font-bold mb-2">
                    <span>📈</span> هدف الاستثمار (EGP) <span className="text-xs text-gray-500">(اختياري)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.investmentTarget || ''}
                    onChange={(e) => setFormData({ ...formData, investmentTarget: parseFloat(e.target.value) || 0 })}
                    placeholder="مثال: 100000"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0071c2] text-[#1a1a1a]"
                  />
                  <p className="text-xs text-gray-500 mt-1">المبلغ الإجمالي المستثمر في تطوير/تجديد هذه الشقة</p>
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-2">
                    <span>📅</span> تاريخ بداية الاستثمار <span className="text-xs text-gray-500">(اختياري)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.investmentStartDate || ''}
                    onChange={(e) => setFormData({ ...formData, investmentStartDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0071c2] text-[#1a1a1a]"
                  />
                  <p className="text-xs text-gray-500 mt-1">سيتم تتبع استرداد الاستثمار من هذا التاريخ</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Partners/Managers Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#003580] flex items-center gap-2">
                <span>👥</span> المسؤولين/الشركاء الإضافيين
              </h2>
              <button
                type="button"
                onClick={addPartner}
                className="bg-[#008009] text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors text-sm"
              >
                + إضافة شريك
              </button>
            </div>

            {partners.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-sm">لا يوجد شركاء إضافيين (اختياري)</p>
              </div>
            ) : (
              <div className="space-y-3">
                {partners.map((partner, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-700">شريك {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removePartner(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕ حذف
                      </button>
                    </div>
                    
                    {partner.partnerId && (
                      <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <span className="text-xs text-blue-700">✓ من قاعدة البيانات</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">الاسم</label>
                        <input
                          type="text"
                          value={partner.name}
                          onChange={(e) => updatePartner(index, 'name', e.target.value)}
                          placeholder="اسم الشريك"
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2]"
                          readOnly={!!partner.partnerId}
                          disabled={!!partner.partnerId}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">الهاتف</label>
                        <input
                          type="text"
                          value={partner.phone}
                          onChange={(e) => updatePartner(index, 'phone', e.target.value)}
                          placeholder="رقم الهاتف"
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2]"
                          readOnly={!!partner.partnerId}
                          disabled={!!partner.partnerId}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">الدور</label>
                        <select
                          value={partner.role}
                          onChange={(e) => updatePartner(index, 'role', e.target.value)}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2] bg-white"
                        >
                          <option value="شريك">شريك</option>
                          <option value="مدير">مدير</option>
                          <option value="مسؤول تنظيف">مسؤول تنظيف</option>
                          <option value="مسؤول صيانة">مسؤول صيانة</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">النسبة %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={partner.percentage}
                          onChange={(e) => updatePartner(index, 'percentage', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Monthly Expenses Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#003580] flex items-center gap-2">
                <span>💸</span> المصروفات الشهرية
              </h2>
              <button
                type="button"
                onClick={addExpense}
                className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-600 transition-colors text-sm"
              >
                + إضافة مصروف
              </button>
            </div>

            {monthlyExpenses.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-sm">لا توجد مصروفات شهرية (اختياري)</p>
              </div>
            ) : (
              <div className="space-y-3">
                {monthlyExpenses.map((expense, index) => (
                  <div key={index} className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-700">مصروف {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeExpense(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕ حذف
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">اسم المصروف</label>
                        <input
                          type="text"
                          value={expense.name}
                          onChange={(e) => updateExpense(index, 'name', e.target.value)}
                          placeholder="مثال: كهرباء، مياه، إنترنت"
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">النوع</label>
                        <select
                          value={expense.type}
                          onChange={(e) => updateExpense(index, 'type', e.target.value)}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2] bg-white"
                        >
                          <option value="fixed">ثابت شهرياً</option>
                          <option value="variable">متغير</option>
                          <option value="yearly">سنوي (مقسم شهرياً)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">المبلغ (ج.م)</label>
                        <input
                          type="number"
                          min="0"
                          value={expense.amount}
                          onChange={(e) => updateExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2]"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="text-center p-3 bg-red-100 rounded-lg">
                  <span className="text-red-700 font-bold">إجمالي المصروفات الشهرية: {getTotalMonthlyExpenses().toLocaleString('ar-EG')} ج.م</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Images */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-xl font-bold text-[#003580] mb-4 flex items-center gap-2">
              <span>📷</span> الصور
            </h2>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-[#0071c2] bg-blue-50' : 'border-gray-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              
              <div className="space-y-2">
                <div className="text-4xl">📷</div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#0071c2] hover:underline font-bold"
                >
                  اضغط للاختيار
                </button>
                <span className="text-gray-600"> أو اسحب الصور هنا</span>
              </div>
            </div>

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 md:grid-cols-5 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.preview}
                      alt="Preview"
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Rooms Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#003580] flex items-center gap-2">
                <span>🚪</span> إدارة الغرف
              </h2>
              <button
                type="button"
                onClick={addRoom}
                className="bg-[#008009] text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                إضافة غرفة
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-4xl mb-2">🚪</div>
                <p className="text-gray-500">لا توجد غرف محددة</p>
                <p className="text-sm text-gray-400 mt-1">يمكنك إضافة غرف مع صور لكل غرفة</p>
              </div>
            ) : (
              <div className="space-y-6">
                {rooms.map((room, roomIndex) => (
                  <div key={room.roomId || roomIndex} className="border-2 border-gray-200 rounded-xl p-5 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-gray-800">غرفة {roomIndex + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeRoom(roomIndex)}
                        className="text-red-500 hover:text-red-700 font-bold text-sm"
                      >
                        ✕ حذف الغرفة
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      {/* رقم الغرفة */}
                      <div className="flex flex-col">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          رقم الغرفة <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={room.roomNumber}
                          onChange={(e) => updateRoom(roomIndex, 'roomNumber', e.target.value)}
                          placeholder="مثال: 101، A1"
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2] bg-white transition-all"
                          required
                        />
                      </div>
                      
                      {/* نوع الغرفة */}
                      <div className="flex flex-col">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          نوع الغرفة <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={room.type}
                          onChange={(e) => updateRoom(roomIndex, 'type', e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2] bg-white transition-all"
                          required
                        >
                          <option value="Single">فردي (Single)</option>
                          <option value="Double">مزدوج (Double)</option>
                          <option value="Triple">ثلاثي (Triple)</option>
                          <option value="Quad">رباعي (Quad)</option>
                        </select>
                      </div>
                      
                      {/* عدد الأسرة */}
                      <div className="flex flex-col">
                        <label className="block text-sm font-bold text-gray-700 mb-2">عدد الأسرة</label>
                        <input
                          type="number"
                          min="1"
                          value={room.beds || 1}
                          onChange={(e) => updateRoom(roomIndex, 'beds', parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2] bg-white transition-all"
                          placeholder="1"
                        />
                      </div>
                      
                      {/* نوع الحمام */}
                      <div className="flex flex-col">
                        <label className="block text-sm font-bold text-gray-700 mb-2">نوع الحمام</label>
                        <select
                          value={room.bathroomType || 'private'}
                          onChange={(e) => updateRoom(roomIndex, 'bathroomType', e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0071c2] bg-white transition-all"
                        >
                          <option value="private">خاص</option>
                          <option value="shared">مشترك</option>
                        </select>
                      </div>
                    </div>

                    {/* Room Images */}
                    <div className="mt-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        صور الغرفة (اختياري)
                      </label>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleRoomImageUpload(roomIndex, e.target.files)}
                        className="hidden"
                        id={`room-images-${roomIndex}`}
                      />
                      <label
                        htmlFor={`room-images-${roomIndex}`}
                        className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#0071c2] hover:bg-blue-50 transition-colors"
                      >
                        <div className="text-2xl mb-2">📷</div>
                        <span className="text-sm text-gray-600">اضغط لاختيار صور لهذه الغرفة</span>
                      </label>

                      {room.images && room.images.length > 0 && (
                        <div className="mt-3 grid grid-cols-4 gap-3">
                          {room.images.map((img) => (
                            <div key={img.id} className="relative group">
                              <img
                                src={img.preview}
                                alt={`Room ${roomIndex + 1}`}
                                className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                              />
                              <button
                                type="button"
                                onClick={() => removeRoomImage(roomIndex, img.id)}
                                className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <h2 className="text-xl font-bold text-[#003580] mb-4 flex items-center gap-2">
                <span>🏠</span> المرافق
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {amenities.map((amenity) => (
                  <label
                    key={amenity}
                    className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.selectedAmenities.includes(amenity)
                        ? 'border-[#0071c2] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.selectedAmenities.includes(amenity)}
                      onChange={() => handleAmenityToggle(amenity)}
                      className="ml-2 w-4 h-4"
                    />
                    <span className="text-sm text-[#1a1a1a]">{amenity}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}

          {/* Partner Select Modal */}
          <AnimatePresence>
            {showPartnerSelect && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
                onClick={() => setShowPartnerSelect(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl border-2 border-gray-100"
                >
                  <div className="bg-gradient-to-r from-[#003580] to-[#0071c2] text-white px-6 py-5 flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      👥 اختر شريك أو أضف شريك جديد
                    </h2>
                    <button
                      onClick={() => setShowPartnerSelect(false)}
                      className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {availablePartners.length > 0 ? (
                      <div className="space-y-3 mb-6">
                        <h3 className="font-bold text-gray-800 mb-3">الشركاء المتاحين:</h3>
                        {availablePartners.map((partner) => {
                          const isAlreadyAdded = partners.find(p => p.partnerId === partner._id)
                          return (
                            <div
                              key={partner._id}
                              onClick={() => !isAlreadyAdded && selectPartnerFromList(partner)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                isAlreadyAdded
                                  ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                                  : 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-bold text-gray-800">{partner.name}</div>
                                  {partner.phone && <div className="text-sm text-gray-600">📞 {partner.phone}</div>}
                                  {partner.defaultSharePercentage > 0 && (
                                    <div className="text-xs text-blue-600 mt-1">
                                      النسبة الافتراضية: {partner.defaultSharePercentage}%
                                    </div>
                                  )}
                                </div>
                                {isAlreadyAdded ? (
                                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">مضاف</span>
                                ) : (
                                  <button className="bg-[#003580] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#00264d] transition-colors text-sm">
                                    اختر
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 mb-6">
                        <div className="text-4xl mb-2">👥</div>
                        <p>لا يوجد شركاء مسجلين في النظام</p>
                        <p className="text-sm mt-1">يمكنك إضافة شريك جديد يدوياً</p>
                      </div>
                    )}
                    
                    <div className="border-t pt-4">
                      <button
                        onClick={addNewPartnerManually}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-bold hover:from-green-600 hover:to-green-700 transition-all duration-200"
                      >
                        ➕ إضافة شريك جديد (يدوي)
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex gap-4"
          >
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 bg-[#0071c2] text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-[#00487a] disabled:opacity-50 transition-all shadow-lg"
            >
              {uploading ? 'جاري الحفظ...' : 'إضافة الشقة'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/apartments')}
              className="px-8 py-4 border-2 border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
          </motion.div>
        </form>
      </div>
    </div>
  )
}

export default AddApartment
