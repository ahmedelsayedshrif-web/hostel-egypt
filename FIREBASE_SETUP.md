# Firebase Storage Setup Guide

## 🔥 إعداد Firebase Storage لصور المخزون

### الخطوة 1: إنشاء Firebase Project

1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. انقر على "Add project" أو اختر مشروع موجود
3. اتبع الخطوات لإنشاء المشروع

### الخطوة 2: تفعيل Firebase Storage

1. في Firebase Console، انتقل إلى **Storage** من القائمة الجانبية
2. انقر على **Get Started**
3. اختر **Start in test mode** (للاختبار) أو **Start in production mode** (للإنتاج)
4. اختر موقع (Location) لـ Storage (مثال: `us-central1` أو `europe-west1`)

### الخطوة 3: الحصول على Firebase Config

1. في Firebase Console، انتقل إلى **Project Settings** (⚙️) -> **General**
2. انتقل لأسفل إلى **Your apps** section
3. إذا لم يكن لديك Web app، انقر على **Add app** -> **Web** (</>)
4. سجل اسم للتطبيق (مثال: "Hostel Masr")
5. انسخ قيم Firebase Config:
   ```javascript
   apiKey: "AIza..."
   authDomain: "your-project.firebaseapp.com"
   projectId: "your-project-id"
   storageBucket: "your-project.appspot.com"
   messagingSenderId: "123456789"
   appId: "1:123456789:web:..."
   ```

### الخطوة 4: إضافة Config إلى المشروع

#### Option A: استخدام Environment Variables (موصى به)

1. أنشئ ملف `.env` في مجلد `frontend/`:
   ```bash
   VITE_FIREBASE_API_KEY=your-api-key-here
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=your-app-id-here
   ```

2. أضف `.env` إلى `.gitignore` (لحماية المفاتيح)

#### Option B: تحديث الملف مباشرة (للتطوير فقط)

افتح `frontend/src/services/firebase.js` وحدّث `firebaseConfig` بالقيم الحقيقية:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:..."
}
```

### الخطوة 5: إعداد Firebase Storage Rules

1. في Firebase Console -> **Storage** -> **Rules**
2. قم بتحديث القواعد:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow read/write access to inventory_images folder
    match /inventory_images/{imageId} {
      allow read: if true; // Anyone can read
      allow write: if request.auth != null; // Only authenticated users (or adjust as needed)
      
      // For public access (development/testing):
      // allow read, write: if true;
    }
    
    // Default: deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**ملاحظة:** للاختبار، يمكنك استخدام `allow read, write: if true;` لكن هذا غير آمن للإنتاج.

### الخطوة 6: اختبار التكامل

1. أعد بناء التطبيق:
   ```bash
   npm run build
   ```

2. افتح التطبيق وانتقل إلى **Inventory** page
3. حاول إضافة عنصر مع صورة
4. تحقق من:
   - ✅ يتم رفع الصورة إلى Firebase Storage
   - ✅ يتم حفظ URL في قاعدة البيانات
   - ✅ تظهر الصورة في قائمة المخزون

---

## 🔒 Security Rules للإنتاج

للإنتاج، استخدم قواعد أكثر أماناً:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /inventory_images/{imageId} {
      // Allow read for all authenticated users
      allow read: if request.auth != null;
      
      // Allow write only for authenticated admin users
      allow write: if request.auth != null 
        && request.auth.token.admin == true;
    }
  }
}
```

---

## 🐛 Troubleshooting

### المشكلة: "Firebase: Error (auth/invalid-api-key)"
**الحل:** تأكد من أن `apiKey` في `.env` صحيح

### المشكلة: "Firebase Storage: User does not have permission"
**الحل:** تحديث Storage Rules لتسمح بالقراءة/الكتابة

### المشكلة: الصور لا تظهر بعد الرفع
**الحل:**
1. تحقق من أن `imageURL` محفوظ في قاعدة البيانات
2. تحقق من أن URL يبدأ بـ `https://firebasestorage.googleapis.com/`
3. تحقق من Storage Rules تسمح بالقراءة

---

## 📝 ملاحظات

- **Backward Compatibility:** الصور القديمة (Base64) ستعمل حتى يتم تحديثها
- **File Size Limit:** Firebase Storage لديه حد افتراضي 32MB، لكننا قمنا بتحديد 5MB في الكود
- **Costs:** Firebase Storage لديه [free tier](https://firebase.google.com/pricing) جيد للبداية

