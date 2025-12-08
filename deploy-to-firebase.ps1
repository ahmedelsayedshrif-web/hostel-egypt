# Firebase Hosting Deployment Script
# This script will deploy the Hostel Egypt project to Firebase Hosting

Write-Host "🚀 بدء عملية رفع المشروع على Firebase Hosting..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if Firebase CLI is installed
Write-Host "📋 الخطوة 1: التحقق من Firebase CLI..." -ForegroundColor Yellow
try {
    $firebaseVersion = firebase --version 2>&1
    Write-Host "✅ Firebase CLI موجود - الإصدار: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI غير موجود. يرجى تثبيته أولاً:" -ForegroundColor Red
    Write-Host "   npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Step 2: Check if logged in
Write-Host ""
Write-Host "📋 الخطوة 2: التحقق من تسجيل الدخول..." -ForegroundColor Yellow
try {
    firebase projects:list 2>&1 | Out-Null
    Write-Host "✅ تم تسجيل الدخول بنجاح" -ForegroundColor Green
} catch {
    Write-Host "⚠️  لم يتم تسجيل الدخول بعد" -ForegroundColor Yellow
    Write-Host "   جاري فتح صفحة تسجيل الدخول..." -ForegroundColor Cyan
    Start-Process "https://console.firebase.google.com/"
    Write-Host ""
    Write-Host "⏳ بعد تسجيل الدخول في المتصفح، اضغط Enter للمتابعة..." -ForegroundColor Yellow
    Read-Host
}

# Step 3: Use the correct project
Write-Host ""
Write-Host "📋 الخطوة 3: ربط المشروع بـ Firebase..." -ForegroundColor Yellow
firebase use hostel-masr
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل ربط المشروع. تأكد من:" -ForegroundColor Red
    Write-Host "   1. تسجيل الدخول: firebase login" -ForegroundColor Yellow
    Write-Host "   2. اسم المشروع الصحيح في Firebase Console" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ تم ربط المشروع بنجاح" -ForegroundColor Green

# Step 4: Build the frontend
Write-Host ""
Write-Host "📋 الخطوة 4: بناء المشروع..." -ForegroundColor Yellow
Set-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل بناء المشروع" -ForegroundColor Red
    exit 1
}
Write-Host "✅ تم بناء المشروع بنجاح" -ForegroundColor Green
Set-Location ..

# Step 5: Deploy to Firebase Hosting
Write-Host ""
Write-Host "📋 الخطوة 5: رفع الملفات على Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل رفع الملفات" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ تم رفع المشروع بنجاح! 🎉" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 يمكنك الوصول إلى الموقع من:" -ForegroundColor Cyan
Write-Host "   https://hostel-masr.web.app" -ForegroundColor Yellow
Write-Host "   أو" -ForegroundColor White
Write-Host "   https://hostel-masr.firebaseapp.com" -ForegroundColor Yellow

