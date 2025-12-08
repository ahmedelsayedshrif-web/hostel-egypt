import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { apartmentsAPI } from '../services/api'

const ApartmentDetails = () => {
  const { id } = useParams()
  const [apartment, setApartment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    fetchApartment()
  }, [id])

  const fetchApartment = async () => {
    // Load data in background without blocking UI
    try {
      const response = await apartmentsAPI.getById(id).catch(err => {
        console.error('Error fetching apartment:', err)
        return { data: null }
      })
      setApartment(response.data)
    } catch (error) {
      console.error('Error fetching apartment:', error)
      setApartment(null)
    }
  }

  if (!apartment) {
    // Show page structure immediately, data loads in background
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/apartments"
          className="text-booking-blue hover:underline mb-4 inline-block"
        >
          ← العودة للشقق
        </Link>
        <div className="text-center py-12">
          <p className="text-xl text-gray-600">جاري تحميل بيانات الشقة...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        to="/apartments"
        className="text-booking-blue hover:underline mb-4 inline-block"
      >
        ← العودة للشقق
      </Link>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-lg shadow-lg overflow-hidden"
      >
        {/* Image Gallery */}
        {apartment.images && apartment.images.length > 0 && (
          <div className="relative h-96 bg-gray-200">
            <img
              src={apartment.images[currentImageIndex].startsWith('http') 
                ? apartment.images[currentImageIndex]
                : `http://localhost:5000${apartment.images[currentImageIndex]}`
              }
              alt={apartment.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/800x600?text=No+Image'
              }}
            />
            {apartment.images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? apartment.images.length - 1 : prev - 1))}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full hover:bg-opacity-100"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentImageIndex((prev) => (prev === apartment.images.length - 1 ? 0 : prev + 1))}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full hover:bg-opacity-100"
                >
                  →
                </button>
              </>
            )}
          </div>
        )}

        <div className="p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{apartment.name}</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h2 className="text-xl font-bold mb-2 text-booking-blue">الموقع</h2>
              <p className="text-gray-600">{apartment.location?.address}</p>
              <p className="text-gray-600">{apartment.location?.city}</p>
            </div>
            
            <div>
              <h2 className="text-xl font-bold mb-2 text-booking-blue">السعر</h2>
              <p className="text-3xl font-bold text-booking-blue">
                ${apartment.pricePerNight}
                <span className="text-lg font-normal text-gray-600">/ليلة</span>
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold mb-2 text-booking-blue">المرافق</h2>
            <div className="flex flex-wrap gap-2">
              {apartment.amenities && apartment.amenities.length > 0 ? (
                apartment.amenities.map((amenity, index) => (
                  <span
                    key={index}
                    className="bg-gray-100 px-3 py-1 rounded-full text-sm"
                  >
                    {amenity}
                  </span>
                ))
              ) : (
                <p className="text-gray-600">لا توجد مرافق محددة</p>
              )}
            </div>
          </div>

          {apartment.description && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2 text-booking-blue">الوصف</h2>
              <p className="text-gray-600">{apartment.description}</p>
            </div>
          )}

          <div className="bg-booking-yellow p-4 rounded-lg text-center">
            <p className="text-booking-blue font-bold text-lg">
              للاستفسار والحجز، يرجى التواصل معنا
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default ApartmentDetails







