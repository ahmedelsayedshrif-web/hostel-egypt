# ✅ التحقق من منطق عمولة النقل الداخلي

## ✅ النظام يتعامل بذكاء مع النقل الداخلي

### المنطق المطبق حالياً:

```javascript
const originalSource = originalBooking.source || 'Direct';
const hasPlatformCommission = originalBooking.platformCommission && originalBooking.platformCommission > 0;
const isFromPlatform = originalSource !== 'Direct' && originalSource !== 'External';

if (hasPlatformCommission && isFromPlatform) {
  transferCommissionAmount = originalBooking.platformCommission;
}
```

## 📋 السيناريوهات المختلفة

### السيناريو 1: نقل من حجز مباشر (Direct)
- **الحجز الأصلي**: `source = "Direct"`, `platformCommission = 0`
- **النتيجة**: 
  - ✅ `isFromPlatform = false` (لأن Direct)
  - ✅ `hasPlatformCommission = false` (لأن 0)
  - ✅ `transferCommissionAmount = 0` (لا يتم نقل أي عمولة)
  - ✅ **لا يتم إنشاء مصروف**

### السيناريو 2: نقل من حجز منصة (Booking.com/Airbnb)
- **الحجز الأصلي**: `source = "Booking.com"`, `platformCommission = 100`
- **النتيجة**: 
  - ✅ `isFromPlatform = true` (لأن Booking.com)
  - ✅ `hasPlatformCommission = true` (لأن 100 > 0)
  - ✅ `transferCommissionAmount = 100` (يتم نقل العمولة)
  - ✅ **يتم إنشاء مصروف بقيمة 100**

### السيناريو 3: نقل من حجز External
- **الحجز الأصلي**: `source = "External"`, `platformCommission = 0`
- **النتيجة**: 
  - ✅ `isFromPlatform = false` (لأن External)
  - ✅ `transferCommissionAmount = 0` (لا يتم نقل أي عمولة)
  - ✅ **لا يتم إنشاء مصروف**

## ✅ التأكيدات

1. ✅ **الحجوزات المباشرة**: لا يتم نقل عمولة (لأن `isFromPlatform = false`)
2. ✅ **الحجوزات من المنصات**: يتم نقل العمولة (إذا كانت > 0)
3. ✅ **الحجوزات External**: لا يتم نقل عمولة (لأن `isFromPlatform = false`)
4. ✅ **التحقق المزدوج**: يتم التحقق من `source` و `platformCommission` معاً

## 🔍 الموقع في الكود

- **الملف**: `electron/main.js`
- **السطر**: ~843-849

## ✅ الخلاصة

**النظام يتعامل بذكاء مع جميع الحالات!**
- ✅ الحجوزات المباشرة → لا عمولة → لا نقل
- ✅ الحجوزات من المنصات → عمولة موجودة → نقل العمولة
- ✅ التحقق من `source` و `platformCommission` معاً

