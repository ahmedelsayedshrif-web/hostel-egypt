// Final test script after fixes
const API_URL = 'http://127.0.0.1:5000/api';

async function fetchAPI(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { data, status: response.status, ok: response.ok };
  } catch (error) {
    throw error;
  }
}

async function runTests() {
  try {
    console.log('🧪 بدء الاختبارات النهائية...\n');
    
    // Wait for server
    console.log('⏳ انتظار الخادم...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // 1. Delete all data
    console.log('1️⃣ حذف جميع البيانات...');
    try {
      await fetchAPI(`${API_URL}/data/all`, { method: 'DELETE' });
      console.log('✅ تم حذف جميع البيانات\n');
    } catch (error) {
      console.log('⚠️ خطأ:', error.message);
    }
    
    // 2. Seed test data
    console.log('2️⃣ إضافة بيانات الاختبار...');
    try {
      const response = await fetchAPI(`${API_URL}/data/seed`, { method: 'POST' });
      if (response.ok) {
        console.log('✅ تم إضافة بيانات الاختبار');
        console.log(`   - شركاء: ${response.data.data.partners}`);
        console.log(`   - شقق: ${response.data.data.apartments}`);
        console.log(`   - حجوزات: ${response.data.data.bookings}`);
        console.log(`   - مصاريف: ${response.data.data.expenses}\n`);
      }
    } catch (error) {
      console.log('❌ خطأ:', error.message);
    }
    
    // 3. Test November 2025
    console.log('3️⃣ اختبار نوفمبر 2025:');
    try {
      const response = await fetchAPI(`${API_URL}/monthly/summary?year=2025&month=11`);
      if (response.ok) {
        const summary = response.data.summary;
        console.log(`   ✅ عدد الحجوزات: ${summary.totalBookings || 0}`);
        console.log(`   ✅ إجمالي الإيرادات: $${summary.totalRevenue?.toFixed(2) || 0}`);
        console.log(`   ✅ صافي الربح: $${summary.netProfit?.toFixed(2) || 0}`);
        console.log(`   ✅ نصيب الشركاء: $${summary.totalCompanyOwnerPayouts?.toFixed(2) || 0}\n`);
      }
    } catch (error) {
      console.log('   ❌ خطأ:', error.message);
    }
    
    // 4. Test December 2025
    console.log('4️⃣ اختبار ديسمبر 2025:');
    try {
      const response = await fetchAPI(`${API_URL}/monthly/summary?year=2025&month=12`);
      if (response.ok) {
        const summary = response.data.summary;
        console.log(`   ✅ عدد الحجوزات: ${summary.totalBookings || 0}`);
        console.log(`   ✅ إجمالي الإيرادات: $${summary.totalRevenue?.toFixed(2) || 0}`);
        console.log(`   ✅ صافي الربح: $${summary.netProfit?.toFixed(2) || 0}`);
        console.log(`   ✅ نصيب الشركاء: $${summary.totalCompanyOwnerPayouts?.toFixed(2) || 0}\n`);
      }
    } catch (error) {
      console.log('   ❌ خطأ:', error.message);
    }
    
    // 5. Test January 2026
    console.log('5️⃣ اختبار يناير 2026:');
    try {
      const response = await fetchAPI(`${API_URL}/monthly/summary?year=2026&month=1`);
      if (response.ok) {
        const summary = response.data.summary;
        console.log(`   ✅ عدد الحجوزات: ${summary.totalBookings || 0}`);
        console.log(`   ✅ إجمالي الإيرادات: $${summary.totalRevenue?.toFixed(2) || 0}`);
        console.log(`   ✅ صافي الربح: $${summary.netProfit?.toFixed(2) || 0}`);
        console.log(`   ✅ نصيب الشركاء: $${summary.totalCompanyOwnerPayouts?.toFixed(2) || 0}\n`);
      }
    } catch (error) {
      console.log('   ❌ خطأ:', error.message);
    }
    
    console.log('✅ اكتملت جميع الاختبارات!');
  } catch (error) {
    console.error('❌ خطأ عام:', error.message);
  }
}

runTests();

