# Hostel Egypt - Property Management ERP System

A comprehensive Enterprise Resource Planning (ERP) system designed for managing hostel and property bookings, financial operations, inventory, and investment tracking.

## 🎯 Project Overview

**Hostel Egypt** is a full-featured property management system built with modern web technologies. It provides end-to-end management for property owners, including booking management, financial tracking, development fund management, inventory control, and ROI (Return on Investment) analytics.

## ✨ Key Features

### 📅 Booking Management
- Complete booking lifecycle management
- Transfer booking functionality
- Automatic conflict detection
- Multi-currency support (USD, EUR, GBP, EGP)
- Real-time availability checking
- Booking extensions and early terminations

### 💰 Financial Management
- Automatic profit distribution calculations
- Platform commission tracking (Booking.com, Airbnb, etc.)
- Development Fund integration
- Partner profit sharing
- Monthly financial summaries
- Currency exchange rate management

### 🏦 Development Fund (صندوق التطوير)
- Automatic deductions from bookings
- Manual deposits and withdrawals
- Transaction history tracking
- Debt tracking (negative balance support)
- Integration with inventory purchases

### 📦 Inventory Management (المخزون)
- Item tracking with photos (Firebase Storage)
- Category-based organization
- Condition tracking (New, Used, Damaged, Needs Repair)
- Location management (Warehouse/Apartment assignment)
- Purchase via Development Fund integration

### 📊 ROI Tracking
- Investment recovery visualization
- Per-apartment ROI calculation
- Visual donut charts
- Break-even point tracking
- Performance analytics dashboard

### 🏢 Multi-Apartment Management
- Room-based property structure
- Amenity management
- Image galleries
- Partner assignment per apartment
- Monthly expense tracking

## 🛠️ Tech Stack

### Frontend
- **React 18+** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Recharts** - Data visualization (charts)
- **Axios** - HTTP client
- **React Router** - Client-side routing

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **JSON Database** - File-based data storage (lowdb-style)
- **Multer** - File upload handling
- **Electron** - Desktop application wrapper

### Services
- **Firebase Storage** - Cloud image storage
- **Exchange Rate API** - Real-time currency rates

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Mira System"
```

### 2. Install Dependencies

**Root directory:**
```bash
npm install
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

### 3. Environment Configuration

Create a `.env` file in the `frontend` directory based on `.env.example`:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

**Important:** 
- Never commit your `.env` file. It contains sensitive credentials.
- Copy `.env.example` to `.env` and fill in your Firebase configuration values.

### 4. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Storage** in Firebase Console
3. Configure Storage Rules:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /inventory_images/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null; // Or adjust based on your auth needs
       }
     }
   }
   ```
4. Copy your Firebase configuration values to `.env`

### 5. Run the Application

**Development Mode (Frontend only):**
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173`

**Production Build:**
```bash
cd frontend
npm run build
```

**Desktop Application:**
```bash
# Build Electron app
npm run build:exe
```

The executable will be in `build-output/win-unpacked/`

## 📁 Project Structure

```
Mira System/
├── electron/                 # Electron main process
│   ├── main.js              # Main Electron entry point & API server
│   └── docs/                # Documentation files
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   │   ├── Header.jsx   # Navigation header
│   │   │   └── Toast.jsx    # Notification system
│   │   ├── pages/           # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Bookings.jsx
│   │   │   ├── Apartments.jsx
│   │   │   ├── Partners.jsx
│   │   │   ├── Financial.jsx
│   │   │   ├── DevelopmentFund.jsx
│   │   │   ├── Inventory.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/        # API and service integrations
│   │   │   ├── api.js       # API client
│   │   │   └── firebase.js  # Firebase Storage utilities
│   │   └── App.jsx          # Main application component
│   ├── public/              # Static assets
│   └── package.json
├── MiraData/                # Local data storage (created at runtime)
│   ├── database.json        # JSON database file
│   └── uploads/             # Local file uploads
├── .gitignore              # Git ignore rules
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 🔑 API Endpoints

### Partners
- `GET /api/partners` - Get all partners
- `POST /api/partners` - Create new partner
- `GET /api/partners/:id` - Get partner by ID
- `PUT /api/partners/:id` - Update partner
- `DELETE /api/partners/:id` - Delete partner

### Apartments
- `GET /api/apartments` - Get all apartments
- `POST /api/apartments` - Create apartment (with images)
- `GET /api/apartments/:id` - Get apartment by ID
- `PUT /api/apartments/:id` - Update apartment
- `DELETE /api/apartments/:id` - Delete apartment

### Bookings
- `GET /api/bookings` - Get all bookings
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking
- `POST /api/bookings/:id/extend` - Extend booking

### Development Fund
- `GET /api/fund/balance` - Get fund balance
- `GET /api/fund/transactions` - Get transaction history
- `POST /api/fund/deposit` - Manual deposit
- `POST /api/fund/withdraw` - Withdraw from fund

### Inventory
- `GET /api/inventory` - Get all inventory items
- `POST /api/inventory` - Add new item
- `PUT /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item

### ROI
- `GET /api/roi/:apartmentId` - Get ROI data for apartment

## 🎨 Design System

### Colors
- **Primary Blue**: `#003580` - Headers and primary actions
- **Accent Yellow**: `#febb02` - CTAs and highlights
- **Dark Blue**: `#001a40` - Navigation background
- **Success Green**: `#10b981` - Success states
- **Warning Orange**: `#f59e0b` - Warnings
- **Error Red**: `#ef4444` - Errors

### Typography
- **Primary Font**: Cairo (Arabic), Poppins (English)
- **RTL Support**: Full right-to-left layout support

## 🔒 Security Notes

- Environment variables (`.env`) are **never** committed to the repository
- Firebase API keys are stored in environment variables
- All API requests are made to local Express server (Electron)
- No sensitive data is exposed to the frontend
- **Firebase Security Rules**: The project includes `firestore.rules` and `storage.rules` configured for authenticated access only
- **Important**: Update Firebase Security Rules in Firebase Console to match the included rules files

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 📞 Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Built with ❤️ for Hostel Egypt**
