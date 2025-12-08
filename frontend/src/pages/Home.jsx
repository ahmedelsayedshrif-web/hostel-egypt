import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const Home = () => {
  const navigate = useNavigate()
  const [searchData, setSearchData] = useState({
    city: '',
    checkIn: '',
    checkOut: '',
    guests: 1,
  })

  const handleSearch = async (e) => {
    e.preventDefault()
    navigate(`/apartments?city=${searchData.city}&checkIn=${searchData.checkIn}&checkOut=${searchData.checkOut}&guests=${searchData.guests}`)
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section with Search */}
      <div className="bg-booking-blue text-white py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              ابحث عن شقتك المثالية
            </h1>
            <p className="text-xl opacity-90">
              اكتشف أفضل الشقق السكنية المتاحة
            </p>
          </motion.div>

          {/* Search Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onSubmit={handleSearch}
            className="bg-white rounded-lg shadow-xl p-6 max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  المدينة
                </label>
                <input
                  type="text"
                  value={searchData.city}
                  onChange={(e) => setSearchData({ ...searchData, city: e.target.value })}
                  placeholder="أين تريد الذهاب؟"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-booking-blue text-gray-800"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  تاريخ الوصول
                </label>
                <input
                  type="date"
                  value={searchData.checkIn}
                  onChange={(e) => setSearchData({ ...searchData, checkIn: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-booking-blue text-gray-800"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  تاريخ المغادرة
                </label>
                <input
                  type="date"
                  value={searchData.checkOut}
                  onChange={(e) => setSearchData({ ...searchData, checkOut: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-booking-blue text-gray-800"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  عدد الضيوف
                </label>
                <input
                  type="number"
                  min="1"
                  value={searchData.guests}
                  onChange={(e) => setSearchData({ ...searchData, guests: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-booking-blue text-gray-800"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full md:w-auto mt-4 bg-booking-yellow text-booking-blue px-8 py-3 rounded-md font-bold hover:bg-yellow-500 transition-colors"
            >
              بحث
            </button>
          </motion.form>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md text-center"
          >
            <div className="text-3xl font-bold text-booking-blue mb-2">0</div>
            <div className="text-gray-600">شقة متاحة</div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md text-center"
          >
            <div className="text-3xl font-bold text-booking-blue mb-2">0</div>
            <div className="text-gray-600">مالك</div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md text-center"
          >
            <div className="text-3xl font-bold text-booking-blue mb-2">0</div>
            <div className="text-gray-600">حجز نشط</div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white p-6 rounded-lg shadow-md text-center"
          >
            <div className="text-3xl font-bold text-booking-blue mb-2">0</div>
            <div className="text-gray-600">إجمالي الإيرادات</div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Home






