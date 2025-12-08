# منطق عمولة النقل الداخلي (Internal Transfer Commission Logic)

## 📋 الوصف
عند نقل عميل من شقة/غرفة إلى شقة/غرفة أخرى (Internal Transfer)، يجب التعامل بذكاء مع عمولة المنصة.

## ✅ القواعد المطبقة

### 1. الحجز الأصلي من منصة (Booking.com, Airbnb, etc.)
- ✅ **العمولة موجودة** → تُنقل كـ مصروف (Transfer Commission Expense)
- ✅ تُخصم من إيرادات الشقة الجديدة (A2)
- ✅ تُسجل كـ مصروف تلقائي في Expenses

### 2. الحجز الأصلي مباشر (Direct) أو External
- ✅ **لا عمولة** → لا تُنقل أي عمولة
- ✅ `transferCommissionAmount = 0`
- ✅ لا يتم إنشاء مصروف

## 🔍 الكود المطبق

### Backend Logic (`electron/main.js`)

```javascript
if (originalBooking) {
  transferFromBookingId_final = originalBooking._id;
  
  // Smart Transfer Commission Logic:
  // Only transfer commission if original booking was from a platform (not Direct/External)
  const originalSource = originalBooking.source || 'Direct';
  const isFromPlatform = originalSource !== 'Direct' && originalSource !== 'External';
  const hasPlatformCommission = originalBooking.platformCommission && originalBooking.platformCommission > 0;
  
  // Transfer commission ONLY if:
  // 1. Original booking was from a platform (Booking.com, Airbnb, etc.)
  // 2. Original booking has platform commission > 0
  if (isFromPlatform && hasPlatformCommission) {
    transferCommissionAmount = originalBooking.platformCommission;
  }
  // If original booking was Direct/External (no commission), transferCommissionAmount stays 0
}
```

## 📊 أمثلة

### المثال 1: نقل من منصة
- **الحجز الأصلي**: من Booking.com، عمولة: $100
- **النقل الداخلي**: نقل العميل إلى شقة أخرى
- **النتيجة**: 
  - `transferCommissionAmount = $100`
  - يتم خصم $100 من إيرادات الشقة الجديدة
  - يتم إنشاء مصروف تلقائي بقيمة $100

### المثال 2: نقل من حجز مباشر
- **الحجز الأصلي**: مباشر (Direct)، عمولة: $0
- **النقل الداخلي**: نقل العميل إلى شقة أخرى
- **النتيجة**: 
  - `transferCommissionAmount = $0`
  - لا يتم خصم أي عمولة
  - لا يتم إنشاء مصروف

## ✅ الفوائد

1. **ذكاء في الحسابات**: النظام يتعامل بذكاء مع الحالات المختلفة
2. **دقة في المالية**: لا يتم خصم عمولة غير موجودة
3. **شفافية**: واضح متى يتم نقل العمولة ومتى لا يتم
4. **تتبع كامل**: جميع العمولات المنقولة مسجلة في Expenses

## 🔧 الموقع في الكود

- **Backend**: `electron/main.js` - السطر ~836-844
- **Frontend**: `frontend/src/pages/Bookings.jsx` - معالجة النقل الداخلي

## ✅ تم التحقق

- ✅ الحجوزات المباشرة لا تنقل عمولة
- ✅ الحجوزات من المنصات تنقل العمولة
- ✅ العمولة تُسجل كـ مصروف تلقائي
- ✅ العمولة تُخصم من إيرادات الشقة الجديدة

