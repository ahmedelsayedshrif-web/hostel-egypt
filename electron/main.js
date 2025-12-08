const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

let mainWindow;
let backendProcess;
let currentPort = 5000;

// Simple JSON Database Class
class JsonDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { partners: [], apartments: [], bookings: [], expenses: [], currencyRates: [], settings: [], fundTransactions: [], inventory: [] };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        const loaded = JSON.parse(content);
        // Merge with defaults to ensure all collections exist
        this.data = { ...this.data, ...loaded };
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading database:', err);
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  find(collection, query = {}) {
    let items = this.data[collection] || [];
    if (Object.keys(query).length > 0) {
      items = items.filter(item => {
        return Object.keys(query).every(key => item[key] === query[key]);
      });
    }
    return items;
  }

  findById(collection, id) {
    return (this.data[collection] || []).find(item => item._id === id);
  }

  insert(collection, doc) {
    if (!this.data[collection]) this.data[collection] = [];
    const newDoc = {
      ...doc,
      _id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data[collection].push(newDoc);
    this.save();
    return newDoc;
  }

  update(collection, id, updates) {
    const index = (this.data[collection] || []).findIndex(item => item._id === id);
    if (index !== -1) {
      this.data[collection][index] = {
        ...this.data[collection][index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this.data[collection][index];
    }
    return null;
  }

  delete(collection, id) {
    const index = (this.data[collection] || []).findIndex(item => item._id === id);
    if (index !== -1) {
      const deleted = this.data[collection].splice(index, 1)[0];
      this.save();
      return deleted;
    }
    return null;
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

function getUserDataPath() {
  if (app.isPackaged) {
    // Store data OUTSIDE the build folder to preserve it during updates
    const exePath = path.dirname(process.execPath);
    
    // For portable distribution: Look for MiraData in parent folders first
    // This supports both development builds and when user moves MiraData with the app
    const possiblePaths = [
      path.join(exePath, '..', '..', '..', 'MiraData'), // Project root: E:\Mira System\MiraData
      path.join(exePath, '..', '..', 'MiraData'),       // build-output level
      path.join(exePath, '..', 'MiraData'),             // win-unpacked parent
      path.join(exePath, 'MiraData'),                   // Next to EXE (default for distribution)
    ];
    
    // Check each path in order and use the first existing one
    for (const checkPath of possiblePaths) {
      const resolvedPath = path.resolve(checkPath);
      if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
    }
    
    // No existing folder found - create one next to the EXE for portability
    const defaultPath = path.join(exePath, 'MiraData');
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true });
    }
    return defaultPath;
  } else {
    // Development mode - use project data folder
    const devPath = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(devPath)) {
      fs.mkdirSync(devPath, { recursive: true });
    }
    return devPath;
  }
}

async function startBackend() {
  try {
    currentPort = await findAvailablePort(5000);
    
    const express = require('express');
    const cors = require('cors');
    const multer = require('multer');
    
    const serverApp = express();
    const userDataPath = getUserDataPath();
    
    const dbPath = path.join(userDataPath, 'database.json');
    const db = new JsonDatabase(dbPath);
    
    const uploadsPath = path.join(userDataPath, 'uploads');
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
    
    const apartmentStorage = multer.diskStorage({
      destination: (req, file, cb) => {
        const apartmentUploads = path.join(uploadsPath, 'apartments');
        if (!fs.existsSync(apartmentUploads)) {
          fs.mkdirSync(apartmentUploads, { recursive: true });
        }
        cb(null, apartmentUploads);
      },
      filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
      }
    });
    
    const roomStorage = multer.diskStorage({
      destination: (req, file, cb) => {
        const roomUploads = path.join(uploadsPath, 'apartments', 'rooms');
        if (!fs.existsSync(roomUploads)) {
          fs.mkdirSync(roomUploads, { recursive: true });
        }
        cb(null, roomUploads);
      },
      filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
      }
    });
    
    const upload = multer({ storage: apartmentStorage });
    const uploadRoom = multer({ storage: roomStorage });
    
    serverApp.use(cors({ origin: '*', credentials: true }));
    serverApp.use(express.json({ limit: '50mb' }));
    serverApp.use(express.urlencoded({ extended: true, limit: '50mb' }));
    serverApp.use('/uploads', express.static(uploadsPath));
    
    const frontendPath = app.isPackaged
      ? path.join(process.resourcesPath, 'frontend-dist')
      : path.join(__dirname, '..', 'frontend', 'dist');
    
    if (fs.existsSync(frontendPath)) {
      serverApp.use(express.static(frontendPath));
    }
    
    // ============ API ROUTES ============
    
    // Health check
    serverApp.get('/api/health', (req, res) => {
      res.json({ status: 'OK', database: 'connected', type: 'JSON File Database' });
    });
    
    // -------- PARTNERS (الشركاء) --------
    serverApp.get('/api/partners', (req, res) => {
      try {
        const partners = db.find('partners');
        partners.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(partners);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.get('/api/partners/:id', (req, res) => {
      try {
        const partner = db.findById('partners', req.params.id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });
        res.json(partner);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/partners', (req, res) => {
      try {
        const { name, phone, email, defaultSharePercentage, type, notes, contactInfo } = req.body;
        if (!name || !phone) {
          return res.status(400).json({ error: 'الاسم والهاتف مطلوبان' });
        }
        const partner = db.insert('partners', {
          name: name.trim(),
          phone: phone.trim(),
          email: (email || '').trim().toLowerCase(),
          defaultSharePercentage: defaultSharePercentage || 0,
          type: type || 'investor', // 'investor' or 'company_owner'
          contactInfo: contactInfo || {},
          totalEarnings: 0,
          notes: notes || ''
        });
        res.status(201).json(partner);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.put('/api/partners/:id', (req, res) => {
      try {
        const { name, phone, email, defaultSharePercentage, type, notes, contactInfo } = req.body;
        const updates = {};
        if (name) updates.name = name.trim();
        if (phone) updates.phone = phone.trim();
        if (email !== undefined) updates.email = email.trim().toLowerCase();
        if (defaultSharePercentage !== undefined) updates.defaultSharePercentage = defaultSharePercentage;
        if (type !== undefined) updates.type = type; // 'investor' or 'company_owner'
        if (contactInfo !== undefined) updates.contactInfo = contactInfo;
        if (notes !== undefined) updates.notes = notes;
        
        const partner = db.update('partners', req.params.id, updates);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });
        res.json(partner);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.delete('/api/partners/:id', (req, res) => {
      try {
        const partner = db.delete('partners', req.params.id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });
        res.json({ message: 'تم حذف الشريك بنجاح' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- BACKWARD COMPATIBILITY: Keep /api/owners endpoints for migration --------
    serverApp.get('/api/owners', (req, res) => {
      try {
        // Return partners as owners for backward compatibility
        const partners = db.find('partners');
        partners.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(partners);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- APARTMENTS (with main owner and partners) --------
    serverApp.get('/api/apartments', (req, res) => {
      try {
        let apartments = db.find('apartments');
        apartments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Populate partners info
        apartments = apartments.map(apt => {
          
          // Populate partners info
          if (apt.partners && apt.partners.length > 0) {
            apt.partners = apt.partners.map(p => {
              if (typeof p.owner === 'string') {
                const ownerData = db.findById('owners', p.owner);
                return { ...p, ownerData };
              }
              return p;
            });
          }
          
          // Calculate total monthly expenses
          apt.totalMonthlyExpenses = (apt.monthlyExpenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
          
          // Calculate broker percentage
          apt.brokerPercentage = Math.max(0, 100 - (apt.ownerPercentage || 80) - (apt.platformCommission || 15));
          
          // Check for active booking
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const bookings = db.find('bookings');
          const activeBooking = bookings.find(b => {
            if (b.apartment !== apt._id) return false;
            if (b.status === 'cancelled' || b.status === 'ended-early') return false;
            const checkIn = new Date(b.checkIn);
            const checkOut = new Date(b.checkOut);
            checkIn.setHours(0, 0, 0, 0);
            checkOut.setHours(23, 59, 59, 999);
            return checkIn <= today && checkOut >= today;
          });
          
          if (activeBooking) {
            apt.bookingStatus = 'rented';
            apt.currentBooking = {
              _id: activeBooking._id,
              checkIn: activeBooking.checkIn,
              checkOut: activeBooking.checkOut,
              guestName: activeBooking.guestName,
            };
            apt.currentGuest = { name: activeBooking.guestName };
            // Calculate remaining days
            const checkOut = new Date(activeBooking.checkOut);
            const diffTime = checkOut - today;
            apt.remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          } else {
            apt.bookingStatus = 'available';
            apt.currentBooking = null;
            apt.currentGuest = null;
            apt.remainingDays = null;
          }
          
          return apt;
        });
        res.json(apartments);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.get('/api/apartments/:id', (req, res) => {
      try {
        const apartment = db.findById('apartments', req.params.id);
        if (!apartment) return res.status(404).json({ error: 'الشقة غير موجودة' });
        
        
        // Populate partners info
        if (apartment.partners && apartment.partners.length > 0) {
          apartment.partners = apartment.partners.map(p => {
            if (typeof p.owner === 'string') {
              const ownerData = db.findById('owners', p.owner);
              return { ...p, ownerData };
            }
            return p;
          });
        }
        
        // Calculate totals
        apartment.totalMonthlyExpenses = (apartment.monthlyExpenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        apartment.brokerPercentage = Math.max(0, 100 - (apartment.ownerPercentage || 80) - (apartment.platformCommission || 15));
        
        res.json(apartment);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/apartments', upload.any(), (req, res) => {
      try {
        const { 
          name, location, platformCommission,
          partners, monthlyExpenses, pricePerNight, currency, description, 
          amenities, status, guests, numberOfRooms, bedrooms, beds, bathrooms,
          rooms
        } = req.body;
        
        // Separate apartment images from room images
        const apartmentImages = [];
        const roomImagesMap = {}; // roomIndex -> array of image paths
        
        if (req.files) {
          req.files.forEach(file => {
            if (file.fieldname === 'images') {
              apartmentImages.push(`/uploads/apartments/${file.filename}`);
            } else if (file.fieldname.startsWith('room_') && file.fieldname.includes('_images')) {
              const match = file.fieldname.match(/room_(\d+)_images/);
              if (match) {
                const roomIndex = parseInt(match[1]);
                if (!roomImagesMap[roomIndex]) roomImagesMap[roomIndex] = [];
                // Save room image to rooms folder
                const roomUploads = path.join(uploadsPath, 'apartments', 'rooms');
                if (!fs.existsSync(roomUploads)) {
                  fs.mkdirSync(roomUploads, { recursive: true });
                }
                const newPath = path.join(roomUploads, file.filename);
                fs.copyFileSync(file.path, newPath);
                roomImagesMap[roomIndex].push(`/uploads/apartments/rooms/${file.filename}`);
              }
            }
          });
        }
        
        if (!name) {
          return res.status(400).json({ error: 'اسم الشقة مطلوب' });
        }
        
        // Parse JSON fields
        let parsedPartners = [];
        if (partners) {
          parsedPartners = typeof partners === 'string' ? JSON.parse(partners) : partners;
        }
        
        let parsedMonthlyExpenses = [];
        if (monthlyExpenses) {
          parsedMonthlyExpenses = typeof monthlyExpenses === 'string' ? JSON.parse(monthlyExpenses) : monthlyExpenses;
        }
        
        let parsedLocation = location;
        if (typeof location === 'string') {
          try {
            parsedLocation = JSON.parse(location);
          } catch (e) {
            parsedLocation = { address: location, city: '' };
          }
        }
        
        // Parse and process rooms data
        let parsedRooms = [];
        if (rooms) {
          parsedRooms = typeof rooms === 'string' ? JSON.parse(rooms) : rooms;
          parsedRooms = parsedRooms.map((room, index) => {
            const roomImages = roomImagesMap[index] || [];
            const existingImages = room.existingImages || [];
            return {
              roomId: room.roomId || `room_${Date.now()}_${index}`,
              roomNumber: room.roomNumber || '',
              type: room.type || 'Single',
              beds: room.beds || 1,
              bathroomType: room.bathroomType || 'private',
              status: room.status || 'available',
              images: [...existingImages, ...roomImages],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          });
        }
        
        const apartment = db.insert('apartments', {
          name: name.trim(),
          location: parsedLocation,
          platformCommission: parseFloat(platformCommission) || 15,
          partners: parsedPartners,
          monthlyExpenses: parsedMonthlyExpenses,
          pricePerNight: parseFloat(pricePerNight) || 0,
          currency: currency || 'USD',
          description: description || '',
          amenities: amenities ? (typeof amenities === 'string' ? JSON.parse(amenities) : amenities) : [],
          images: apartmentImages,
          status: status || 'available',
          guests: parseInt(guests) || 1,
          numberOfRooms: parseInt(numberOfRooms) || parsedRooms.length || 1,
          bedrooms: parseInt(bedrooms) || 1,
          beds: parseInt(beds) || 1,
          bathrooms: parseInt(bathrooms) || 1,
          rooms: parsedRooms
        });
        res.status(201).json(apartment);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.put('/api/apartments/:id', upload.any(), (req, res) => {
      try {
        const existing = db.findById('apartments', req.params.id);
        if (!existing) return res.status(404).json({ error: 'الشقة غير موجودة' });
        
        const { 
          name, location, platformCommission,
          partners, monthlyExpenses, pricePerNight, currency, description, 
          amenities, status, existingImages, guests, numberOfRooms, bedrooms, beds, bathrooms,
          rooms
        } = req.body;
        const updates = {};
        
        if (name) updates.name = name.trim();
        if (location) {
          updates.location = typeof location === 'string' ? JSON.parse(location) : location;
        }
        if (platformCommission !== undefined) updates.platformCommission = parseFloat(platformCommission);
        if (partners) {
          updates.partners = typeof partners === 'string' ? JSON.parse(partners) : partners;
        }
        if (monthlyExpenses) {
          updates.monthlyExpenses = typeof monthlyExpenses === 'string' ? JSON.parse(monthlyExpenses) : monthlyExpenses;
        }
        if (pricePerNight !== undefined) updates.pricePerNight = parseFloat(pricePerNight);
        if (currency) updates.currency = currency;
        if (description !== undefined) updates.description = description;
        if (amenities) updates.amenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
        if (status) updates.status = status;
        if (guests !== undefined) updates.guests = parseInt(guests);
        if (numberOfRooms !== undefined) updates.numberOfRooms = parseInt(numberOfRooms);
        if (bedrooms !== undefined) updates.bedrooms = parseInt(bedrooms);
        if (beds !== undefined) updates.beds = parseInt(beds);
        if (bathrooms !== undefined) updates.bathrooms = parseInt(bathrooms);
        
        // Separate apartment images from room images
        const apartmentImages = existingImages ? (typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages) : existing.images || [];
        const roomImagesMap = {};
        
        if (req.files && req.files.length > 0) {
          req.files.forEach(file => {
            if (file.fieldname === 'images') {
              apartmentImages.push(`/uploads/apartments/${file.filename}`);
            } else if (file.fieldname.startsWith('room_') && file.fieldname.includes('_images')) {
              const match = file.fieldname.match(/room_(\d+)_images/);
              if (match) {
                const roomIndex = parseInt(match[1]);
                if (!roomImagesMap[roomIndex]) roomImagesMap[roomIndex] = [];
                const roomUploads = path.join(uploadsPath, 'apartments', 'rooms');
                if (!fs.existsSync(roomUploads)) {
                  fs.mkdirSync(roomUploads, { recursive: true });
                }
                const newPath = path.join(roomUploads, file.filename);
                fs.copyFileSync(file.path, newPath);
                roomImagesMap[roomIndex].push(`/uploads/apartments/rooms/${file.filename}`);
              }
            }
          });
        }
        updates.images = apartmentImages;
        
        // Handle rooms update
        if (rooms) {
          const parsedRooms = typeof rooms === 'string' ? JSON.parse(rooms) : rooms;
          const updatedRooms = parsedRooms.map((room, index) => {
            const roomImages = roomImagesMap[index] || [];
            const existingRoomImages = room.existingImages || [];
            return {
              roomId: room.roomId || existing.rooms?.[index]?.roomId || `room_${Date.now()}_${index}`,
              roomNumber: room.roomNumber || '',
              type: room.type || 'Single',
              beds: room.beds !== undefined ? room.beds : (existing.rooms?.[index]?.beds || 1),
              bathroomType: room.bathroomType || existing.rooms?.[index]?.bathroomType || 'private',
              status: room.status || existing.rooms?.[index]?.status || 'available',
              images: [...existingRoomImages, ...roomImages],
              createdAt: existing.rooms?.[index]?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          });
          updates.rooms = updatedRooms;
        }
        
        const apartment = db.update('apartments', req.params.id, updates);
        res.json(apartment);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.delete('/api/apartments/:id', (req, res) => {
      try {
        const apartment = db.delete('apartments', req.params.id);
        if (!apartment) return res.status(404).json({ error: 'الشقة غير موجودة' });
        res.json({ message: 'تم حذف الشقة بنجاح' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- ROOMS (Sub-collection of Apartments) --------
    serverApp.get('/api/apartments/:apartmentId/rooms', (req, res) => {
      try {
        const apartment = db.findById('apartments', req.params.apartmentId);
        if (!apartment) return res.status(404).json({ error: 'الشقة غير موجودة' });
        
        const rooms = apartment.rooms || [];
        res.json(rooms);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.get('/api/apartments/:apartmentId/rooms/:roomId', (req, res) => {
      try {
        const apartment = db.findById('apartments', req.params.apartmentId);
        if (!apartment) return res.status(404).json({ error: 'الشقة غير موجودة' });
        
        const rooms = apartment.rooms || [];
        const room = rooms.find(r => r.roomId === req.params.roomId);
        if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
        
        res.json(room);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/apartments/:apartmentId/rooms', (req, res) => {
      try {
        const apartment = db.findById('apartments', req.params.apartmentId);
        if (!apartment) return res.status(404).json({ error: 'الشقة غير موجودة' });
        
        const { roomNumber, type, status } = req.body;
        if (!roomNumber || !type) {
          return res.status(400).json({ error: 'رقم الغرفة ونوعها مطلوبان' });
        }
        
        if (!apartment.rooms) apartment.rooms = [];
        
        // Check if room number already exists
        if (apartment.rooms.some(r => r.roomNumber === roomNumber)) {
          return res.status(400).json({ error: 'رقم الغرفة موجود بالفعل' });
        }
        
        const room = {
          roomId: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          roomNumber: roomNumber.trim(),
          type: type, // 'Single' or 'Double'
          status: status || 'available', // 'available', 'occupied', 'maintenance'
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        apartment.rooms.push(room);
        db.update('apartments', req.params.apartmentId, { rooms: apartment.rooms });
        
        res.status(201).json(room);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.put('/api/apartments/:apartmentId/rooms/:roomId', (req, res) => {
      try {
        const apartment = db.findById('apartments', req.params.apartmentId);
        if (!apartment) return res.status(404).json({ error: 'الشقة غير موجودة' });
        
        if (!apartment.rooms) apartment.rooms = [];
        const roomIndex = apartment.rooms.findIndex(r => r.roomId === req.params.roomId);
        if (roomIndex === -1) return res.status(404).json({ error: 'الغرفة غير موجودة' });
        
        const { roomNumber, type, status } = req.body;
        const updates = {};
        if (roomNumber !== undefined) updates.roomNumber = roomNumber.trim();
        if (type !== undefined) updates.type = type;
        if (status !== undefined) updates.status = status;
        updates.updatedAt = new Date().toISOString();
        
        apartment.rooms[roomIndex] = { ...apartment.rooms[roomIndex], ...updates };
        db.update('apartments', req.params.apartmentId, { rooms: apartment.rooms });
        
        res.json(apartment.rooms[roomIndex]);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.delete('/api/apartments/:apartmentId/rooms/:roomId', (req, res) => {
      try {
        const apartment = db.findById('apartments', req.params.apartmentId);
        if (!apartment) return res.status(404).json({ error: 'الشقة غير موجودة' });
        
        if (!apartment.rooms) apartment.rooms = [];
        const roomIndex = apartment.rooms.findIndex(r => r.roomId === req.params.roomId);
        if (roomIndex === -1) return res.status(404).json({ error: 'الغرفة غير موجودة' });
        
        // Check if room has active bookings
        const bookings = db.find('bookings', { roomId: req.params.roomId });
        const activeBookings = bookings.filter(b => {
          if (b.status === 'cancelled' || b.status === 'ended-early') return false;
          const checkOut = new Date(b.checkOut);
          return checkOut >= new Date();
        });
        
        if (activeBookings.length > 0) {
          return res.status(400).json({ error: 'لا يمكن حذف الغرفة لأنها تحتوي على حجوزات نشطة' });
        }
        
        apartment.rooms.splice(roomIndex, 1);
        db.update('apartments', req.params.apartmentId, { rooms: apartment.rooms });
        
        res.json({ message: 'تم حذف الغرفة بنجاح' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- BOOKINGS --------
    serverApp.get('/api/bookings', (req, res) => {
      try {
        let bookings = db.find('bookings');
        bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Populate apartment info and calculate profits
        bookings = bookings.map(booking => {
          if (booking.apartment) {
            const apartment = db.findById('apartments', booking.apartment);
            if (apartment) {
              booking.apartmentData = apartment;
            }
          }
          return booking;
        });
        res.json(bookings);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.get('/api/bookings/:id', (req, res) => {
      try {
        const booking = db.findById('bookings', req.params.id);
        if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
        if (booking.apartment) {
          const apartment = db.findById('apartments', booking.apartment);
          if (apartment) booking.apartmentData = apartment;
        }
        res.json(booking);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // Helper function to check room availability
    const checkRoomAvailability = (roomId, apartmentId, checkIn, checkOut, excludeBookingId = null) => {
      const bookings = db.find('bookings');
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      const conflictingBooking = bookings.find(b => {
        // Skip cancelled and ended-early bookings
        if (b.status === 'cancelled' || b.status === 'ended-early') return false;
        // Skip the booking being updated
        if (excludeBookingId && b._id === excludeBookingId) return false;
        // Check if booking is for the same room
        if (b.roomId !== roomId) return false;
        
        const bCheckIn = new Date(b.checkIn);
        const bCheckOut = new Date(b.checkOut);
        
        // Check for date overlap
        return (checkInDate < bCheckOut && checkOutDate > bCheckIn);
      });
      
      return conflictingBooking ? { available: false, conflictingBooking } : { available: true };
    };
    
    serverApp.post('/api/bookings', (req, res) => {
      try {
        const { 
          apartment, roomId, bookingId, customReference, bookingType,
          guestName, guestNationality, guestPhone, guestEmail, guestOrigin, guestDestination,
          originType, originApartmentId, originRoomId, transferFromBookingId,
          checkIn, checkOut, numberOfNights,
          totalBookingPrice, paidAmount, remainingAmount,
          payments, // Array of payments: [{ amount, currency, method }]
          hostelShare, platformCommission, paymentMethod, source,
          currency, exchangeRate, notes, status,
          // Development Fund fields
          devDeductionType, // 'none', 'fixed', 'percent'
          devDeductionValue // Number
        } = req.body;
        
        if (!apartment || !roomId || !guestName || !checkIn || !checkOut) {
          return res.status(400).json({ error: 'بيانات الحجز غير مكتملة (الشقة، الغرفة، اسم الضيف، التواريخ مطلوبة)' });
        }
        
        // Check room availability
        const availability = checkRoomAvailability(roomId, apartment, checkIn, checkOut);
        if (!availability.available) {
          return res.status(409).json({ 
            error: 'تعارض في الحجز! الغرفة محجوزة في هذه التواريخ',
            conflictingBooking: availability.conflictingBooking
          });
        }
        
        // If source is External, set platform commission to 0
        let finalPlatformCommission = (source === 'External') ? 0 : (parseFloat(platformCommission) || 0);
        
        // Handle Internal Transfer Commission Logic
        let transferCommissionAmount = 0;
        let transferFromBookingId_final = null;
        
        // Handle transfer booking: Find original booking using transferFromBookingId first, then fallback to search
        if (originType === 'internal_transfer' && (transferFromBookingId || (originApartmentId && originRoomId))) {
          const allBookings = db.find('bookings');
          let originalBooking = null;
          
          // Priority 1: Use transferFromBookingId if provided
          if (transferFromBookingId) {
            originalBooking = allBookings.find(b => b._id === transferFromBookingId);
          }
          
          // Priority 2: Fallback to search by guestName + apartment + roomId
          if (!originalBooking && originApartmentId && originRoomId) {
            originalBooking = allBookings.find(b => 
              b.apartment === originApartmentId && 
              b.roomId === originRoomId &&
              b.guestName === guestName.trim() && // Match by guest name
              (b.status === 'confirmed' || b.status === 'completed') &&
              new Date(b.checkOut) >= new Date() // Booking hasn't ended yet
            );
          }
          
          if (originalBooking) {
            transferFromBookingId_final = originalBooking._id;
            // Smart Transfer Commission Logic:
            // Only transfer commission if:
            // 1. Original booking had platform commission (> 0)
            // 2. Original booking was from a platform (not External)
            // This ensures we don't transfer commission from external bookings (which have 0 commission)
            const originalSource = originalBooking.source || 'External';
            const hasPlatformCommission = originalBooking.platformCommission && originalBooking.platformCommission > 0;
            const isFromPlatform = originalSource !== 'External';
            
            if (hasPlatformCommission && isFromPlatform) {
              transferCommissionAmount = originalBooking.platformCommission;
            }
            // If original booking was External (no commission), transferCommissionAmount stays 0
          }
        }
        
        // Calculate remaining amount if not provided
        const total = parseFloat(totalBookingPrice) || 0;
        const paid = parseFloat(paidAmount) || 0;
        const remaining = remainingAmount !== undefined ? parseFloat(remainingAmount) : (total - paid);
        
        // Calculate Development Deduction (Module 1: Development Fund)
        let developmentDeduction = 0;
        const deductionType = devDeductionType || 'none';
        const deductionValue = parseFloat(devDeductionValue) || 0;
        
        if (deductionType === 'percent' && deductionValue > 0) {
          developmentDeduction = (total * deductionValue) / 100;
        } else if (deductionType === 'fixed' && deductionValue > 0) {
          // Convert fixed amount to USD if needed (assuming EGP input, convert using exchange rate)
          const exchangeRateForDeduction = parseFloat(exchangeRate) || 50;
          developmentDeduction = deductionValue / exchangeRateForDeduction;
        }
        
        // Calculate final distributable amount (after platform commission and development deduction)
        const finalDistributableAmount = total - finalPlatformCommission - developmentDeduction;
        
        // Get apartment to calculate partner shares and ownerAmount
        const apt = db.findById('apartments', apartment);
        let ownerAmount = 0;
        let brokerProfit = 0;
        
        if (apt && apt.partners && apt.partners.length > 0) {
          // Calculate total partner percentage
          const totalPartnerPercentage = apt.partners.reduce((sum, p) => sum + (p.percentage || 0), 0);
          // OwnerAmount is the partner share from distributable amount
          ownerAmount = (finalDistributableAmount * totalPartnerPercentage) / 100;
        }
        
        // Calculate brokerProfit = Distributable Amount - Owner Share
        brokerProfit = Math.max(0, finalDistributableAmount - ownerAmount);
        
        const finalBookingId = bookingId || `BK${Date.now()}`;
        
        const booking = db.insert('bookings', {
          bookingId: finalBookingId,
          customReference: customReference || '',
          apartment,
          roomId,
          bookingType: bookingType || 'individual',
          guestName: guestName.trim(),
          guestNationality: guestNationality || '',
          guestPhone: guestPhone || '',
          guestEmail: guestEmail || '',
          guestOrigin: guestOrigin || '',
          guestDestination: guestDestination || '',
          originType: originType || 'external', // 'external' or 'internal_transfer'
          originApartmentId: originApartmentId || null,
          originRoomId: originRoomId || null,
          transferFromBookingId: transferFromBookingId_final || transferFromBookingId || null,
          transferCommissionAmount: transferCommissionAmount || 0, // Expense - deducted from net revenue
          transferCommissionExpense: transferCommissionAmount || 0, // Alias for clarity
          checkIn: new Date(checkIn).toISOString(),
          checkOut: new Date(checkOut).toISOString(),
          numberOfNights: numberOfNights || 1,
          totalBookingPrice: total,
          paidAmount: paid,
          remainingAmount: remaining,
          hostelShare: parseFloat(hostelShare) || 0,
          platformCommission: finalPlatformCommission,
          originalPlatformCommission: finalPlatformCommission, // Store original for extend booking
          // Development Fund fields
          devDeductionType: deductionType,
          devDeductionValue: deductionValue,
          developmentDeduction: developmentDeduction,
          finalDistributableAmount: finalDistributableAmount,
          ownerAmount: ownerAmount,
          brokerProfit: brokerProfit,
          commissionStatus: new Date(checkOut) > new Date() ? 'pending' : 'applied', // Module 2: Temporal commission
          commissionAppliedDate: new Date(checkOut) > new Date() ? null : new Date().toISOString(),
          paymentMethod: paymentMethod || 'cash',
          payments: payments || (paidAmount && paymentMethod ? [{
            amount: paidAmount,
            currency: currency || 'USD',
            method: paymentMethod || 'cash'
          }] : []), // Store payments array, or create from legacy fields
          source: source || 'External',
          currency: currency || 'USD',
          exchangeRate: parseFloat(exchangeRate) || 1,
          status: status || 'confirmed',
          notes: notes || '',
          isPaid: paid >= total
        });
        
        // Create Development Fund Transaction if deduction exists
        if (developmentDeduction > 0) {
          const exchangeRateForFund = parseFloat(exchangeRate) || 50;
          const developmentDeductionEGP = developmentDeduction * exchangeRateForFund;
          
          db.insert('fundTransactions', {
            type: 'deposit', // Inflow to Development Fund
            amount: developmentDeduction, // Store in USD
            amountEGP: developmentDeductionEGP,
            currency: 'USD',
            description: `Development Fund Contribution from Booking ${finalBookingId}`,
            bookingId: booking._id,
            apartment: apartment || null,
            transactionDate: new Date().toISOString(),
            isSystemGenerated: true
          });
        }
        
        // Module 1 Enhancement: Create system-generated expense record for transfer commission
        if (transferCommissionAmount > 0 && transferFromBookingId_final) {
          const originalApartment = db.findById('apartments', originApartmentId);
          const currentApartment = db.findById('apartments', apartment);
          const originalRoom = originalApartment?.rooms?.find(r => r.roomId === originRoomId);
          const currentRoom = currentApartment?.rooms?.find(r => r.roomId === roomId);
          
          // Convert commission to EGP for expense record (using booking's exchange rate)
          const exchangeRateForExpense = parseFloat(exchangeRate) || 50;
          const transferCommissionEGP = transferCommissionAmount * exchangeRateForExpense;
          
          // Create expense record with strict tagging
          db.insert('expenses', {
            apartment: apartment, // A2 (the apartment receiving the transfer)
            category: 'transfer_commission',
            amount: transferCommissionEGP, // Store in EGP
            currency: 'EGP',
            description: `Transfer Commission: Guest ${guestName.trim()} transferred from ${originalApartment?.name || 'Apt'} Room ${originalRoom?.roomNumber || originRoomId} to ${currentApartment?.name || 'Apt'} Room ${currentRoom?.roomNumber || roomId}`,
            date: new Date(checkIn).toISOString(), // Use check-in date
            isSystemGenerated: true,
            transferFromBookingId: transferFromBookingId_final,
            transferToBookingId: booking._id,
            bookingId: booking.bookingId || bookingId
          });
        }
        
        res.status(201).json(booking);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/bookings/:id/extend', (req, res) => {
      try {
        const booking = db.findById('bookings', req.params.id);
        if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
        
        const { extensionDays, extensionAmount } = req.body;
        if (!extensionDays || extensionDays <= 0) {
          return res.status(400).json({ error: 'عدد الأيام الإضافية مطلوب ويجب أن يكون أكبر من صفر' });
        }
        
        if (!extensionAmount || extensionAmount <= 0) {
          return res.status(400).json({ error: 'مبلغ التمديد مطلوب ويجب أن يكون أكبر من صفر' });
        }
        
        // Calculate new check-out date
        const currentCheckOut = new Date(booking.checkOut);
        const newCheckOut = new Date(currentCheckOut);
        newCheckOut.setDate(newCheckOut.getDate() + parseInt(extensionDays));
        
        // Check room availability for extension period
        const availability = checkRoomAvailability(
          booking.roomId, 
          booking.apartment, 
          booking.checkOut, 
          newCheckOut.toISOString(),
          booking._id
        );
        
        if (!availability.available) {
          return res.status(409).json({ 
            error: 'تعارض في الحجز! الغرفة محجوزة في فترة التمديد',
            conflictingBooking: availability.conflictingBooking
          });
        }
        
        // Update booking: add extension amount to total, but keep original platform commission
        const newTotal = parseFloat(booking.totalBookingPrice) + parseFloat(extensionAmount);
        const newNights = parseInt(booking.numberOfNights) + parseInt(extensionDays);
        const newRemaining = parseFloat(booking.remainingAmount) + parseFloat(extensionAmount);
        
        const updated = db.update('bookings', req.params.id, {
          checkOut: newCheckOut.toISOString(),
          numberOfNights: newNights,
          totalBookingPrice: newTotal,
          remainingAmount: newRemaining,
          // Platform commission remains the same (originalPlatformCommission)
          platformCommission: booking.originalPlatformCommission || booking.platformCommission,
          updatedAt: new Date().toISOString()
        });
        
        res.json(updated);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.put('/api/bookings/:id', (req, res) => {
      try {
        const existing = db.findById('bookings', req.params.id);
        if (!existing) return res.status(404).json({ error: 'الحجز غير موجود' });
        
        const updates = { ...req.body };
        if (updates.checkIn) updates.checkIn = new Date(updates.checkIn).toISOString();
        if (updates.checkOut) updates.checkOut = new Date(updates.checkOut).toISOString();
        
        // Recalculate Development Deduction if needed
        const total = parseFloat(updates.totalBookingPrice || existing.totalBookingPrice) || 0;
        const deductionType = updates.devDeductionType || existing.devDeductionType || 'none';
        const deductionValue = parseFloat(updates.devDeductionValue || existing.devDeductionValue) || 0;
        
        let developmentDeduction = 0;
        if (deductionType === 'percent' && deductionValue > 0) {
          developmentDeduction = (total * deductionValue) / 100;
        } else if (deductionType === 'fixed' && deductionValue > 0) {
          const exchangeRate = parseFloat(updates.exchangeRate || existing.exchangeRate) || 50;
          developmentDeduction = deductionValue / exchangeRate;
        }
        
        const platformFee = parseFloat(updates.platformCommission || existing.platformCommission) || 0;
        const finalDistributableAmount = total - platformFee - developmentDeduction;
        
        // Get apartment to recalculate ownerAmount
        const aptId = updates.apartment || existing.apartment;
        const apt = aptId ? db.findById('apartments', aptId) : null;
        let ownerAmount = 0;
        
        if (apt && apt.partners && apt.partners.length > 0) {
          const totalPartnerPercentage = apt.partners.reduce((sum, p) => sum + (p.percentage || 0), 0);
          ownerAmount = (finalDistributableAmount * totalPartnerPercentage) / 100;
        }
        
        updates.developmentDeduction = developmentDeduction;
        updates.finalDistributableAmount = finalDistributableAmount;
        updates.ownerAmount = ownerAmount;
        updates.brokerProfit = Math.max(0, finalDistributableAmount - ownerAmount);
        
        if (updates.exchangeRate) {
          updates.totalAmountEGP = total * parseFloat(updates.exchangeRate);
        }
        
        // Handle Development Fund Transaction Update
        const oldDeduction = existing.developmentDeduction || 0;
        const newDeduction = developmentDeduction;
        const deductionDifference = newDeduction - oldDeduction;
        
        // Find existing fund transaction for this booking
        const existingTransaction = db.find('fundTransactions', { bookingId: req.params.id })
          .find(t => t.type === 'deposit' && t.isSystemGenerated);
        
        if (Math.abs(deductionDifference) > 0.01) { // Only if there's a meaningful difference
          const exchangeRateForFund = parseFloat(updates.exchangeRate || existing.exchangeRate) || 50;
          
          if (existingTransaction) {
            // Update existing transaction
            const newAmount = newDeduction;
            const newAmountEGP = newAmount * exchangeRateForFund;
            
            db.update('fundTransactions', existingTransaction._id, {
              amount: newAmount,
              amountEGP: newAmountEGP,
              description: `Development Fund Contribution from Booking ${existing.bookingId || 'N/A'} (Updated)`
            });
          } else if (newDeduction > 0) {
            // Create new transaction if didn't exist before
            db.insert('fundTransactions', {
              type: 'deposit',
              amount: newDeduction,
              amountEGP: newDeduction * exchangeRateForFund,
              currency: 'USD',
              description: `Development Fund Contribution from Booking ${existing.bookingId || 'N/A'}`,
              bookingId: req.params.id,
              apartment: existing.apartment || null,
              transactionDate: new Date().toISOString(),
              isSystemGenerated: true
            });
          } else if (oldDeduction > 0 && newDeduction === 0) {
            // If deduction was removed, reverse the deposit by converting to withdrawal
            if (existingTransaction) {
              db.update('fundTransactions', existingTransaction._id, {
                type: 'withdrawal',
                description: `Reversal: Development Deduction removed from Booking ${existing.bookingId || 'N/A'}`
              });
            }
          }
        }
        
        const booking = db.update('bookings', req.params.id, updates);
        res.json(booking);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.delete('/api/bookings/:id', (req, res) => {
      try {
        const booking = db.delete('bookings', req.params.id);
        if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
        res.json({ message: 'تم حذف الحجز بنجاح' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- EXPENSES --------
    serverApp.get('/api/expenses', (req, res) => {
      try {
        let expenses = db.find('expenses');
        expenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        expenses = expenses.map(expense => {
          if (expense.apartment) {
            const apartment = db.findById('apartments', expense.apartment);
            return { ...expense, apartmentData: apartment };
          }
          return expense;
        });
        res.json(expenses);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/expenses', (req, res) => {
      try {
        const { apartment, category, amount, currency, description, date } = req.body;
        if (!amount || !category) {
          return res.status(400).json({ error: 'المبلغ والفئة مطلوبان' });
        }
        
        const expense = db.insert('expenses', {
          apartment: apartment || null,
          category,
          amount: parseFloat(amount),
          currency: currency || 'EGP',
          description: description || '',
          date: date ? new Date(date).toISOString() : new Date().toISOString()
        });
        res.status(201).json(expense);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.put('/api/expenses/:id', (req, res) => {
      try {
        const existing = db.findById('expenses', req.params.id);
        if (!existing) return res.status(404).json({ error: 'المصروف غير موجود' });
        
        const updates = { ...req.body };
        if (updates.amount) updates.amount = parseFloat(updates.amount);
        if (updates.date) updates.date = new Date(updates.date).toISOString();
        
        const expense = db.update('expenses', req.params.id, updates);
        res.json(expense);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.delete('/api/expenses/:id', (req, res) => {
      try {
        const expense = db.delete('expenses', req.params.id);
        if (!expense) return res.status(404).json({ error: 'المصروف غير موجود' });
        res.json({ message: 'تم حذف المصروف بنجاح' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- DEVELOPMENT FUND --------
    serverApp.get('/api/fund/balance', (req, res) => {
      try {
        const transactions = db.find('fundTransactions');
        const balance = transactions.reduce((sum, t) => {
          if (t.type === 'deposit') return sum + (t.amount || 0);
          if (t.type === 'withdrawal') return sum - (t.amount || 0);
          return sum;
        }, 0);
        
        const balanceEGP = transactions.reduce((sum, t) => {
          if (t.type === 'deposit') return sum + (t.amountEGP || 0);
          if (t.type === 'withdrawal') return sum - (t.amountEGP || 0);
          return sum;
        }, 0);
        
        res.json({ balance, balanceEGP, transactionCount: transactions.length });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.get('/api/fund/transactions', (req, res) => {
      try {
        let transactions = db.find('fundTransactions');
        transactions.sort((a, b) => new Date(b.transactionDate || b.createdAt) - new Date(a.transactionDate || a.createdAt));
        res.json(transactions);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/fund/withdraw', (req, res) => {
      try {
        const { amount, amountEGP, currency, description, apartment, inventoryItemId } = req.body;
        
        // Check if this is a deposit (negative amount) or withdrawal (positive amount)
        const isDeposit = parseFloat(amount) < 0;
        const absoluteAmount = Math.abs(parseFloat(amount));
        
        if (!amount || absoluteAmount <= 0) {
          return res.status(400).json({ error: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' });
        }
        
        const transactions = db.find('fundTransactions');
        const currentBalance = transactions.reduce((sum, t) => {
          if (t.type === 'deposit') return sum + (t.amount || 0);
          if (t.type === 'withdrawal') return sum - (t.amount || 0);
          return sum;
        }, 0);
        
        // For withdrawals, check if balance will be negative
        const willBeNegative = !isDeposit && (currentBalance - absoluteAmount) < 0;
        
        const transaction = db.insert('fundTransactions', {
          type: isDeposit ? 'deposit' : 'withdrawal',
          amount: isDeposit ? absoluteAmount : absoluteAmount,
          amountEGP: parseFloat(amountEGP) || (absoluteAmount * 50), // Default rate 50
          currency: currency || 'USD',
          description: description || (isDeposit ? 'إيداع يدوي لصندوق التطوير' : 'سحب من صندوق التطوير'),
          apartment: apartment || null,
          inventoryItemId: inventoryItemId || null,
          transactionDate: new Date().toISOString(),
          isSystemGenerated: false,
          willCreateNegativeBalance: willBeNegative
        });
        
        res.status(201).json({ 
          transaction, 
          warning: willBeNegative ? 'الرصيد سيكون سالباً (مديونية)' : null 
        });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/fund/deposit', (req, res) => {
      try {
        const { amount, amountEGP, currency, description, apartment, source, date } = req.body;
        if (!amount || parseFloat(amount) <= 0) {
          return res.status(400).json({ error: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' });
        }
        
        // Use provided date or current date
        const transactionDate = date ? new Date(date).toISOString() : new Date().toISOString();
        
        const transaction = db.insert('fundTransactions', {
          type: 'deposit',
          amount: parseFloat(amount),
          amountEGP: parseFloat(amountEGP) || (parseFloat(amount) * 50), // Default rate 50
          currency: currency || 'USD',
          description: description || (source ? `إيداع خارجي من ${source}` : 'إيداع يدوي لصندوق التطوير'),
          source: source || null,
          apartment: apartment || null,
          transactionDate: transactionDate,
          isSystemGenerated: false
        });
        
        res.status(201).json({ transaction });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    // -------- INVENTORY --------
    serverApp.get('/api/inventory', (req, res) => {
      try {
        let items = db.find('inventory');
        const { apartment, status, category } = req.query;
        
        if (apartment) {
          items = items.filter(i => i.currentLocation === apartment || i.currentLocation === 'warehouse');
        }
        if (status) {
          items = items.filter(i => i.condition === status);
        }
        if (category) {
          items = items.filter(i => i.category === category);
        }
        
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Populate apartment data if assigned
        items = items.map(item => {
          if (item.currentLocation && item.currentLocation !== 'warehouse') {
            const apt = db.findById('apartments', item.currentLocation);
            if (apt) item.apartmentData = apt;
          }
          return item;
        });
        
        res.json(items);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.get('/api/inventory/:id', (req, res) => {
      try {
        const item = db.findById('inventory', req.params.id);
        if (!item) return res.status(404).json({ error: 'العنصر غير موجود' });
        
        if (item.currentLocation && item.currentLocation !== 'warehouse') {
          const apt = db.findById('apartments', item.currentLocation);
          if (apt) item.apartmentData = apt;
        }
        
        res.json(item);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/inventory', (req, res) => {
      try {
        const { name, category, quantity, valuePerUnit, condition, currentLocation, imageURL, description, payViaFund, fundAmount } = req.body;
        
        if (!name || !category || !quantity || quantity <= 0) {
          return res.status(400).json({ error: 'الاسم والفئة والكمية مطلوبة' });
        }
        
        // Validate condition
        const validConditions = ['New', 'Used', 'Damaged', 'Needs Repair'];
        if (condition && !validConditions.includes(condition)) {
          return res.status(400).json({ error: 'حالة العنصر غير صحيحة' });
        }
        
        // Check if item is damaged and trying to assign to location
        if (condition === 'Damaged' && currentLocation && currentLocation !== 'warehouse') {
          return res.status(400).json({ error: 'لا يمكن تعيين عنصر تالف إلى شقة أو غرفة' });
        }
        
        // If paying via Development Fund, create withdrawal transaction
        if (payViaFund && fundAmount && fundAmount > 0) {
          const totalCostEGP = parseFloat(valuePerUnit || 0) * parseInt(quantity);
          // Get exchange rate (default 50 EGP = 1 USD)
          const currencyRates = db.find('currencyRates');
          const usdRate = currencyRates.find(r => r.currency === 'USD')?.rateToEGP || 50;
          // Convert EGP to USD for fund transaction
          const fundAmountUSD = totalCostEGP / usdRate;
          
          db.insert('fundTransactions', {
            type: 'withdrawal',
            amount: fundAmountUSD, // Store in USD
            amountEGP: totalCostEGP, // Store in EGP
            currency: 'USD',
            description: `شراء مخزون: ${name} (${quantity} قطعة)`,
            transactionDate: new Date().toISOString(),
            isSystemGenerated: true,
            inventoryPurchase: true,
            inventoryItemId: null // Will be set after item creation
          });
        }
        
        const item = db.insert('inventory', {
          name,
          category,
          quantity: parseInt(quantity),
          valuePerUnit: parseFloat(valuePerUnit) || 0,
          totalValue: parseFloat(valuePerUnit || 0) * parseInt(quantity),
          condition: condition || 'New',
          currentLocation: currentLocation || 'warehouse',
          imageURL: imageURL || null,
          description: description || '',
          purchaseDate: new Date().toISOString(),
          paidViaFund: payViaFund || false
        });
        
        // Update inventory transaction with item ID if it was created
        if (payViaFund && fundAmount && fundAmount > 0) {
          const transactions = db.find('fundTransactions');
          const lastTransaction = transactions[transactions.length - 1];
          if (lastTransaction && lastTransaction.inventoryPurchase && !lastTransaction.inventoryItemId) {
            db.update('fundTransactions', lastTransaction._id, {
              inventoryItemId: item._id
            });
          }
        }
        
        res.status(201).json(item);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.put('/api/inventory/:id', (req, res) => {
      try {
        const existing = db.findById('inventory', req.params.id);
        if (!existing) return res.status(404).json({ error: 'العنصر غير موجود' });
        
        const updates = { ...req.body };
        
        // Validate condition if updating
        if (updates.condition) {
          const validConditions = ['New', 'Used', 'Damaged', 'Needs Repair'];
          if (!validConditions.includes(updates.condition)) {
            return res.status(400).json({ error: 'حالة العنصر غير صحيحة' });
          }
          
          // Cannot assign damaged item
          if (updates.condition === 'Damaged' && updates.currentLocation && updates.currentLocation !== 'warehouse') {
            return res.status(400).json({ error: 'لا يمكن تعيين عنصر تالف إلى شقة أو غرفة' });
          }
        }
        
        // Recalculate total value if quantity or valuePerUnit changed
        if (updates.quantity || updates.valuePerUnit) {
          const qty = parseInt(updates.quantity || existing.quantity);
          const val = parseFloat(updates.valuePerUnit || existing.valuePerUnit);
          updates.totalValue = qty * val;
        }
        
        const item = db.update('inventory', req.params.id, updates);
        res.json(item);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.delete('/api/inventory/:id', (req, res) => {
      try {
        const item = db.delete('inventory', req.params.id);
        if (!item) return res.status(404).json({ error: 'العنصر غير موجود' });
        res.json({ message: 'تم حذف العنصر بنجاح' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- ROI TRACKING --------
    serverApp.get('/api/roi/:apartmentId', (req, res) => {
      try {
        const apartment = db.findById('apartments', req.params.apartmentId);
        if (!apartment) return res.status(404).json({ error: 'الشقة غير موجودة' });
        
        const investmentTarget = apartment.investmentTarget || 0;
        const investmentStartDate = apartment.investmentStartDate ? new Date(apartment.investmentStartDate) : null;
        
        if (!investmentTarget || investmentTarget <= 0 || !investmentStartDate) {
          return res.json({
            hasInvestment: false,
            message: 'لا يوجد استثمار مسجل لهذه الشقة'
          });
        }
        
        // Get all bookings for this apartment since investment start date
        const allBookings = db.find('bookings', { apartment: req.params.apartmentId });
        const relevantBookings = allBookings.filter(b => {
          if (b.status === 'cancelled') return false;
          const bookingDate = new Date(b.checkIn);
          return bookingDate >= investmentStartDate;
        });
        
        // Calculate recovered amount (sum of brokerProfit from bookings)
        const recoveredAmount = relevantBookings.reduce((sum, b) => {
          // Use finalDistributableAmount if available, otherwise calculate
          const bookingAmount = b.finalDistributableAmount || (b.totalBookingPrice - (b.platformCommission || 0) - (b.developmentDeduction || 0));
          // Get company share (brokerProfit) from booking
          const companyShare = b.brokerProfit || 0;
          return sum + companyShare;
        }, 0);
        
        const remaining = Math.max(0, investmentTarget - recoveredAmount);
        const recoveryPercentage = investmentTarget > 0 ? (recoveredAmount / investmentTarget) * 100 : 0;
        
        // Determine status color
        let statusColor = 'red';
        if (recoveryPercentage >= 80) statusColor = 'green';
        else if (recoveryPercentage >= 30) statusColor = 'yellow';
        
        const isComplete = recoveryPercentage >= 100;
        
        res.json({
          hasInvestment: true,
          investmentTarget,
          investmentStartDate: investmentStartDate.toISOString(),
          recoveredAmount,
          remaining,
          recoveryPercentage: Math.min(100, recoveryPercentage),
          statusColor,
          isComplete,
          bookingCount: relevantBookings.length
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- SETTINGS --------
    serverApp.get('/api/settings', (req, res) => {
      try {
        let settings = db.find('settings');
        if (settings.length === 0) {
          const defaultSettings = db.insert('settings', {
            amenities: ['واي فاي', 'تكييف', 'غسالة', 'ثلاجة', 'تلفزيون', 'مطبخ', 'موقف سيارات', 'مسبح'],
            companyName: 'نظام ميرا',
            defaultCurrency: 'USD'
          });
          res.json(defaultSettings);
        } else {
          res.json(settings[0]);
        }
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.put('/api/settings', (req, res) => {
      try {
        let settings = db.find('settings');
        if (settings.length === 0) {
          const newSettings = db.insert('settings', req.body);
          res.json(newSettings);
        } else {
          const updated = db.update('settings', settings[0]._id, req.body);
          res.json(updated);
        }
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.get('/api/settings/amenities/list', (req, res) => {
      try {
        let settings = db.find('settings');
        if (settings.length === 0) {
          const defaultAmenities = ['واي فاي', 'تكييف', 'غسالة', 'ثلاجة', 'تلفزيون', 'مطبخ', 'موقف سيارات', 'مسبح'];
          db.insert('settings', { amenities: defaultAmenities });
          res.json(defaultAmenities);
        } else {
          res.json(settings[0].amenities || []);
        }
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/settings/amenities/add', (req, res) => {
      try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'اسم المرفق مطلوب' });
        
        let settings = db.find('settings');
        if (settings.length === 0) {
          db.insert('settings', { amenities: [name] });
        } else {
          const current = settings[0];
          const amenities = current.amenities || [];
          if (!amenities.includes(name)) {
            amenities.push(name);
            db.update('settings', current._id, { amenities });
          }
        }
        res.json({ message: 'تمت إضافة المرفق' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.delete('/api/settings/amenities/:name', (req, res) => {
      try {
        const name = decodeURIComponent(req.params.name);
        let settings = db.find('settings');
        if (settings.length > 0) {
          const current = settings[0];
          const amenities = (current.amenities || []).filter(a => a !== name);
          db.update('settings', current._id, { amenities });
        }
        res.json({ message: 'تم حذف المرفق' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- CURRENCY RATES --------
    serverApp.get('/api/currency/rates', (req, res) => {
      try {
        let rates = db.find('currencyRates');
        
        // Ensure default currencies exist
        const defaultCurrencies = [
          { currency: 'USD', rateToEGP: 50, symbol: '$' },
          { currency: 'EUR', rateToEGP: 54, symbol: '€' },
          { currency: 'GBP', rateToEGP: 63, symbol: '£' },
          { currency: 'SAR', rateToEGP: 13.3, symbol: 'ر.س' },
          { currency: 'AED', rateToEGP: 13.6, symbol: 'د.إ' }
        ];
        
        if (rates.length === 0) {
          // No currencies at all - add all defaults
          defaultCurrencies.forEach(r => db.insert('currencyRates', r));
          rates = db.find('currencyRates');
        } else {
          // Check if AED exists, if not add it
          const hasAED = rates.find(r => r.currency === 'AED');
          if (!hasAED) {
            const aedRate = defaultCurrencies.find(c => c.currency === 'AED');
            db.insert('currencyRates', {
              ...aedRate,
              source: 'manual'
            });
            rates = db.find('currencyRates');
          }
        }
        
        res.json(rates);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    serverApp.post('/api/currency/rates', (req, res) => {
      try {
        const { currency, rateToEGP, symbol } = req.body;
        if (!currency || !rateToEGP) {
          return res.status(400).json({ error: 'العملة والسعر مطلوبان' });
        }
        
        const existing = db.find('currencyRates').find(r => r.currency === currency);
        if (existing) {
          const updated = db.update('currencyRates', existing._id, { 
            rateToEGP: parseFloat(rateToEGP), 
            symbol: symbol || existing.symbol,
            updatedAt: new Date().toISOString() 
          });
          res.json(updated);
        } else {
          const rate = db.insert('currencyRates', { 
            currency, 
            rateToEGP: parseFloat(rateToEGP),
            symbol: symbol || currency
          });
          res.status(201).json(rate);
        }
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.put('/api/currency/rates/:currency', (req, res) => {
      try {
        const { rateToEGP, symbol } = req.body;
        const currency = req.params.currency;
        
        const existing = db.find('currencyRates').find(r => r.currency === currency);
        if (existing) {
          const updates = {};
          if (rateToEGP) updates.rateToEGP = parseFloat(rateToEGP);
          if (symbol) updates.symbol = symbol;
          const updated = db.update('currencyRates', existing._id, updates);
          res.json(updated);
        } else {
          res.status(404).json({ error: 'العملة غير موجودة' });
        }
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    serverApp.delete('/api/currency/rates/:currency', (req, res) => {
      try {
        const currency = req.params.currency;
        const existing = db.find('currencyRates').find(r => r.currency === currency);
        if (existing) {
          db.delete('currencyRates', existing._id);
          res.json({ success: true, message: 'تم حذف العملة بنجاح' });
        } else {
          res.status(404).json({ error: 'العملة غير موجودة' });
        }
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
    
    // Fetch live exchange rates from internet
    serverApp.get('/api/currency/refresh', async (req, res) => {
      try {
        const https = require('https');
        
        // Fetch from exchangerate-api (free tier)
        const fetchRate = (base) => {
          return new Promise((resolve, reject) => {
            const url = `https://api.exchangerate-api.com/v4/latest/${base}`;
            
            const request = https.get(url, (response) => {
              let data = '';
              response.on('data', chunk => data += chunk);
              response.on('end', () => {
                try {
                  const parsed = JSON.parse(data);
                  resolve(parsed);
                } catch (e) {
                  console.error('JSON Parse error:', e);
                  reject(e);
                }
              });
            });
            
            request.on('error', (err) => {
              console.error('HTTPS request error:', err);
              reject(err);
            });
            
            request.setTimeout(10000, () => {
              request.destroy();
              reject(new Error('Request timeout'));
            });
          });
        };
        
        // Fetch USD to EGP rate
        const usdData = await fetchRate('USD');
        const egpRate = usdData.rates?.EGP;
        
        if (!egpRate) {
          console.error('No EGP rate found in response');
          return res.status(500).json({ error: 'لم نتمكن من جلب أسعار الصرف' });
        }
        
        // Calculate rates for different currencies
        // usdData.rates contains: how many X currency = 1 USD
        // So: 1 EUR = (1 / usdData.rates.EUR) USD = (1 / 0.92) * egpRate EGP
        const rates = {
          USD: egpRate,
          EUR: egpRate / (usdData.rates?.EUR || 0.92),
          GBP: egpRate / (usdData.rates?.GBP || 0.79),
          SAR: egpRate / (usdData.rates?.SAR || 3.75),
          AED: egpRate / (usdData.rates?.AED || 3.67)
        };
        
        // Update database with new rates - get all existing currencies to preserve manual additions
        const existingCurrencies = db.find('currencyRates');
        const updatedRates = [];
        const symbols = { USD: '$', EUR: '€', GBP: '£', SAR: 'ر.س', AED: 'د.إ' };
        
        // First, update standard currencies from internet
        
        for (const [currency, rateToEGP] of Object.entries(rates)) {
          const roundedRate = parseFloat(rateToEGP.toFixed(2));
          const existing = db.find('currencyRates').find(r => r.currency === currency);
          
          if (existing) {
            // Only update if it's an auto-updated currency (has source) or manually added
            const updated = db.update('currencyRates', existing._id, { 
              rateToEGP: roundedRate,
              lastUpdated: new Date().toISOString(),
              source: existing.source || 'exchangerate-api.com'
            });
            updatedRates.push(updated);
          } else {
            const created = db.insert('currencyRates', {
              currency,
              rateToEGP: roundedRate,
              symbol: symbols[currency] || currency,
              lastUpdated: new Date().toISOString(),
              source: 'exchangerate-api.com'
            });
            updatedRates.push(created);
          }
        }
        
        // Preserve manually added currencies that aren't in the standard list
        const standardCurrencies = Object.keys(rates);
        const manuallyAdded = existingCurrencies.filter(r => !standardCurrencies.includes(r.currency) && !r.source);
        manuallyAdded.forEach(currency => {
          if (!updatedRates.find(r => r.currency === currency.currency)) {
            updatedRates.push(currency);
          }
        });
        
        res.json({ 
          success: true, 
          message: 'تم تحديث أسعار الصرف بنجاح من الإنترنت',
          rates: updatedRates,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('❌ Error fetching exchange rates:', err);
        res.status(500).json({ 
          error: 'فشل في جلب أسعار الصرف. تأكد من اتصالك بالإنترنت.',
          details: err.message 
        });
      }
    });
    
    // -------- DASHBOARD SUMMARY --------
    serverApp.get('/api/dashboard/summary', (req, res) => {
      try {
        const { year, month, apartment } = req.query;
        const bookings = db.find('bookings');
        const expenses = db.find('expenses');
        const apartments = db.find('apartments');
        const owners = db.find('owners');
        
        let filteredBookings = bookings;
        let filteredExpenses = expenses;
        
        // Filter by date if provided - Module 2: Use checkout date for commission, split revenue by nights
        if (year && month) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59);
          
          // For revenue: Include bookings that have nights in this month (based on check-in/check-out dates)
          filteredBookings = bookings.filter(b => {
            const checkIn = new Date(b.checkIn);
            const checkOut = new Date(b.checkOut);
            // Booking overlaps with this month if check-in is before end of month and check-out is after start of month
            return checkIn <= endDate && checkOut >= startDate;
          });
          
          filteredExpenses = expenses.filter(e => {
            const date = new Date(e.date);
            return date >= startDate && date <= endDate;
          });
        }
        
        // Filter by apartment if provided
        if (apartment && apartment !== 'all') {
          filteredBookings = filteredBookings.filter(b => b.apartment === apartment);
          filteredExpenses = filteredExpenses.filter(e => e.apartment === apartment);
        }
        
        // Module 2: Calculate revenue split by nights per month, and commission only in checkout month
        let totalRevenue = 0;
        let totalPlatformFees = 0;
        
        if (year && month) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59);
          
          filteredBookings.forEach(b => {
            const checkIn = new Date(b.checkIn);
            const checkOut = new Date(b.checkOut);
            const totalNights = b.numberOfNights || Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            const totalAmount = b.totalBookingPrice || b.totalAmountUSD || 0;
            const pricePerNight = totalNights > 0 ? totalAmount / totalNights : 0;
            
            // Calculate nights in this month
            const monthStart = Math.max(checkIn.getTime(), startDate.getTime());
            const monthEnd = Math.min(checkOut.getTime(), endDate.getTime());
            const nightsInMonth = Math.max(0, Math.ceil((monthEnd - monthStart) / (1000 * 60 * 60 * 24)));
            
            // Revenue = price per night * nights in this month
            totalRevenue += pricePerNight * nightsInMonth;
            
            // Commission: Only deduct if checkout date is in this month or earlier
            if (checkOut <= endDate) {
              // Commission is only applied once, in the checkout month
              const commissionStatus = b.commissionStatus || (checkOut > new Date() ? 'pending' : 'applied');
              if (commissionStatus === 'applied' || checkOut <= new Date()) {
                totalPlatformFees += (b.platformCommission || 0) + (b.transferCommissionAmount || 0);
              }
            }
          });
        } else {
          // No month filter - use all bookings
          totalRevenue = filteredBookings.reduce((sum, b) => sum + (b.totalBookingPrice || b.totalAmountUSD || 0), 0);
          totalPlatformFees = filteredBookings.reduce((sum, b) => {
            const commission = (b.platformCommission || 0) + (b.transferCommissionAmount || 0);
            // Only include applied commissions
            if (!b.commissionStatus || b.commissionStatus === 'applied') {
              return sum + commission;
            }
            return sum;
          }, 0);
        }
        const totalOwnerPayments = filteredBookings.reduce((sum, b) => sum + (b.ownerAmount || 0), 0);
        const totalCleaningFees = filteredBookings.reduce((sum, b) => sum + (b.cleaningFee || 0), 0);
        const totalOtherExpenses = filteredBookings.reduce((sum, b) => sum + (b.otherExpenses || 0), 0);
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        // Broker profit = Revenue - Owner payments - Platform fees - All expenses
        const brokerProfit = totalRevenue - totalOwnerPayments - totalPlatformFees - totalCleaningFees - totalOtherExpenses - totalExpenses;
        
        // Revenue in EGP
        const totalRevenueEGP = filteredBookings.reduce((sum, b) => sum + (b.totalAmountEGP || b.totalAmountUSD * (b.exchangeRate || 50)), 0);
        
        res.json({
          totalRevenue,
          totalRevenueEGP,
          totalPlatformFees,
          totalOwnerPayments,
          totalCleaningFees,
          totalOtherExpenses,
          totalExpenses,
          brokerProfit,
          bookingsCount: filteredBookings.length,
          apartmentsCount: apartments.length,
          ownersCount: owners.length
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // Monthly summary with full details - MODULE 2 & 3 IMPLEMENTATION
    serverApp.get('/api/monthly/summary', (req, res) => {
      try {
        const { year, month, apartmentId } = req.query;
        const allBookings = db.find('bookings');
        const allExpenses = db.find('expenses');
        const allApartments = db.find('apartments');
        const allPartners = db.find('partners');
        const currencyRates = db.find('currencyRates');
        
        // Get USD rate
        const usdRate = currencyRates.find(r => r.currency === 'USD')?.rateToEGP || 50;
        
        // Parse year and month as integers (they come as strings from query params)
        const parsedYear = year ? parseInt(year, 10) : null;
        const parsedMonth = month ? parseInt(month, 10) : null;
        
        // Module 2: Date filtering - bookings that overlap with the month
        let bookingsInMonth = allBookings;
        let filteredExpenses = allExpenses;
        
        if (parsedYear && parsedMonth) {
          const startDate = new Date(parsedYear, parsedMonth - 1, 1);
          const endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);
          
          // Bookings that start (checkIn) in this month only - no cross-month confusion
          bookingsInMonth = allBookings.filter(b => {
            const checkIn = new Date(b.checkIn);
            const checkInMonth = checkIn.getMonth() + 1;
            const checkInYear = checkIn.getFullYear();
            return checkInMonth === parsedMonth && checkInYear === parsedYear;
          });
          
          filteredExpenses = allExpenses.filter(e => {
            const date = new Date(e.date);
            return date >= startDate && date <= endDate;
          });
        }
        
        // Filter by apartment if provided
        if (apartmentId && apartmentId !== 'all') {
          bookingsInMonth = bookingsInMonth.filter(b => b.apartment === apartmentId);
          filteredExpenses = filteredExpenses.filter(e => e.apartment === apartmentId);
        }
        
        // Module 2: Calculate revenue split by nights, commission only in checkout month
        const startDate = parsedYear && parsedMonth ? new Date(parsedYear, parsedMonth - 1, 1) : null;
        const endDate = parsedYear && parsedMonth ? new Date(parsedYear, parsedMonth, 0, 23, 59, 59) : null;
        
        let totalRevenue = 0;
        let totalPlatformCommission = 0;
        let totalTransferCommissionExpense = 0; // Module 1: Transfer commission as expense
        
        bookingsInMonth.forEach(booking => {
          const checkIn = new Date(booking.checkIn);
          const checkOut = new Date(booking.checkOut);
          const totalNights = booking.numberOfNights || Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
          const totalAmount = booking.totalBookingPrice || booking.totalAmountUSD || 0;
          const pricePerNight = totalNights > 0 ? totalAmount / totalNights : 0;
          
          // Use full booking amount (no cross-month splitting) - booking is counted in checkIn month only
          if (startDate && endDate) {
            // Full revenue for this booking (it's in the checkIn month)
            totalRevenue += totalAmount;
            
            // Commission: Apply if checkout is in this month or earlier
            const commissionStatus = booking.commissionStatus || (checkOut > new Date() ? 'pending' : 'applied');
            if (commissionStatus === 'applied' || checkOut <= endDate) {
              totalPlatformCommission += booking.platformCommission || 0;
              totalTransferCommissionExpense += booking.transferCommissionAmount || booking.transferCommissionExpense || 0;
            }
          } else {
            // No month filter - include all
            totalRevenue += totalAmount;
            const commissionStatus = booking.commissionStatus || (checkOut > new Date() ? 'pending' : 'applied');
            if (commissionStatus === 'applied') {
              totalPlatformCommission += booking.platformCommission || 0;
              totalTransferCommissionExpense += booking.transferCommissionAmount || booking.transferCommissionExpense || 0;
            }
          }
        });
        
        // Calculate other expenses
        const generalExpensesEGP = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        // Monthly expenses from apartments (in EGP)
        const apartmentsWithBookings = [...new Set(bookingsInMonth.map(b => b.apartment))];
        let apartmentMonthlyExpensesEGP = 0;
        apartmentsWithBookings.forEach(aptId => {
          const apt = allApartments.find(a => a._id === aptId);
          if (apt && apt.monthlyExpenses && apt.monthlyExpenses.length > 0) {
            apt.monthlyExpenses.forEach(expense => {
              apartmentMonthlyExpensesEGP += expense.amount || 0;
            });
          }
        });
        
        // Total operating expenses (Maintenance + Electricity + etc.)
        const totalOperatingExpensesEGP = generalExpensesEGP + apartmentMonthlyExpensesEGP;
        const totalOperatingExpenses = totalOperatingExpensesEGP / usdRate;
        
        // Module 3: WATERFALL PROFIT DISTRIBUTION
        // Calculate per apartment first
        const apartmentFinancials = {};
        
        bookingsInMonth.forEach(booking => {
          const aptId = booking.apartment;
          if (!apartmentFinancials[aptId]) {
            apartmentFinancials[aptId] = {
              apartmentId: aptId,
              revenue: 0,
              platformCommission: 0,
              transferCommissionExpense: 0,
              operatingExpenses: 0,
              operatingProfit: 0,
              investorPayouts: {},
              companyProfit: 0,
              companyOwnerPayouts: {}
            };
          }
          
          const apt = allApartments.find(a => a._id === aptId);
          const checkIn = new Date(booking.checkIn);
          const checkOut = new Date(booking.checkOut);
          const totalNights = booking.numberOfNights || Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
          const totalAmount = booking.totalBookingPrice || booking.totalAmountUSD || 0;
          const pricePerNight = totalNights > 0 ? totalAmount / totalNights : 0;
          
          // Use full booking amount (no cross-month splitting) - booking counted in checkIn month only
          if (startDate && endDate) {
            // Full revenue for this booking (it's in the checkIn month)
            apartmentFinancials[aptId].revenue += totalAmount;
            
            // Commission: Apply if checkout is in this month or earlier
            const commissionStatus = booking.commissionStatus || (checkOut > new Date() ? 'pending' : 'applied');
            if (commissionStatus === 'applied' || checkOut <= endDate) {
              apartmentFinancials[aptId].platformCommission += booking.platformCommission || 0;
              apartmentFinancials[aptId].transferCommissionExpense += booking.transferCommissionAmount || booking.transferCommissionExpense || 0;
            }
          } else {
            apartmentFinancials[aptId].revenue += totalAmount;
            const commissionStatus = booking.commissionStatus || (checkOut > new Date() ? 'pending' : 'applied');
            if (commissionStatus === 'applied') {
              apartmentFinancials[aptId].platformCommission += booking.platformCommission || 0;
              apartmentFinancials[aptId].transferCommissionExpense += booking.transferCommissionAmount || booking.transferCommissionExpense || 0;
            }
          }
        });
        
        // Add apartment expenses
        apartmentsWithBookings.forEach(aptId => {
          const apt = allApartments.find(a => a._id === aptId);
          if (apt) {
            // Add monthly expenses
            if (apt.monthlyExpenses) {
              apt.monthlyExpenses.forEach(expense => {
                apartmentFinancials[aptId].operatingExpenses += (expense.amount || 0) / usdRate;
              });
            }
            // Add general expenses for this apartment (exclude transfer_commission - it's added separately)
            filteredExpenses.filter(e => 
              e.apartment === aptId && 
              e.category !== 'transfer_commission' // Exclude transfer commission expenses (added from booking)
            ).forEach(expense => {
              apartmentFinancials[aptId].operatingExpenses += (expense.amount || 0) / usdRate;
            });
            
            // Add transfer commission expenses from expenses collection (if any - system generated)
            filteredExpenses.filter(e => 
              e.apartment === aptId && 
              e.category === 'transfer_commission'
            ).forEach(expense => {
              apartmentFinancials[aptId].transferCommissionExpense += (expense.amount || 0) / usdRate;
            });
          }
        });
        
        // Calculate Operating Profit per apartment (Step A)
        Object.keys(apartmentFinancials).forEach(aptId => {
          const fin = apartmentFinancials[aptId];
          fin.operatingProfit = fin.revenue - fin.platformCommission - fin.transferCommissionExpense - fin.operatingExpenses;
        });
        
        // Step B: Distribute to Investors from Operating Profit
        // Step C: Calculate Company Profit
        // Step D: Distribute to Company Owners from Company Profit
        Object.keys(apartmentFinancials).forEach(aptId => {
          const fin = apartmentFinancials[aptId];
          const apt = allApartments.find(a => a._id === aptId);
          
          if (apt && apt.partners && apt.partners.length > 0) {
            let totalInvestorPayouts = 0;
            
            // Step B: Calculate investor payouts
            apt.partners.forEach(partner => {
              const partnerData = allPartners.find(p => p._id === partner.partnerId || p.name === partner.name);
              const partnerType = partnerData?.type || partner.type || 'investor';
              
              if (partnerType === 'investor') {
                const investorShare = fin.operatingProfit * ((partner.percentage || 0) / 100);
                fin.investorPayouts[partner.name || partner.partnerId] = {
                  name: partner.name || 'غير معروف',
                  percentage: partner.percentage || 0,
                  amount: investorShare,
                  type: 'investor'
                };
                totalInvestorPayouts += investorShare;
              }
            });
            
            // Step C: Company Profit = Operating Profit - Investor Payouts
            fin.companyProfit = fin.operatingProfit - totalInvestorPayouts;
            
            // Step D: Distribute Company Profit to Company Owners
            apt.partners.forEach(partner => {
              const partnerData = allPartners.find(p => p._id === partner.partnerId || p.name === partner.name);
              const partnerType = partnerData?.type || partner.type || 'investor';
              
              if (partnerType === 'company_owner') {
                const companyOwnerShare = fin.companyProfit * ((partner.percentage || 0) / 100);
                fin.companyOwnerPayouts[partner.name || partner.partnerId] = {
                  name: partner.name || 'غير معروف',
                  percentage: partner.percentage || 0,
                  amount: companyOwnerShare,
                  type: 'company_owner'
                };
              }
            });
          } else {
            // No partners - all operating profit goes to company
            fin.companyProfit = fin.operatingProfit;
          }
        });
        
        // Aggregate totals across all apartments
        let totalOperatingProfit = 0;
        let totalInvestorPayouts = 0;
        let totalCompanyProfit = 0;
        let totalCompanyOwnerPayouts = 0;
        
        Object.keys(apartmentFinancials).forEach(aptId => {
          const fin = apartmentFinancials[aptId];
          totalOperatingProfit += fin.operatingProfit;
          totalInvestorPayouts += Object.values(fin.investorPayouts).reduce((sum, p) => sum + p.amount, 0);
          totalCompanyProfit += fin.companyProfit;
          totalCompanyOwnerPayouts += Object.values(fin.companyOwnerPayouts).reduce((sum, p) => sum + p.amount, 0);
        });
        
        // Partner profits aggregation (for display)
        const partnerProfits = {};
        Object.values(apartmentFinancials).forEach(fin => {
          Object.values(fin.investorPayouts).forEach(payout => {
            if (!partnerProfits[payout.name]) {
              partnerProfits[payout.name] = { name: payout.name, type: 'investor', totalUSD: 0, totalEGP: 0 };
            }
            partnerProfits[payout.name].totalUSD += payout.amount;
            partnerProfits[payout.name].totalEGP += payout.amount * usdRate;
          });
          Object.values(fin.companyOwnerPayouts).forEach(payout => {
            if (!partnerProfits[payout.name]) {
              partnerProfits[payout.name] = { name: payout.name, type: 'company_owner', totalUSD: 0, totalEGP: 0 };
            }
            partnerProfits[payout.name].totalUSD += payout.amount;
            partnerProfits[payout.name].totalEGP += payout.amount * usdRate;
          });
        });
        
        // Pending amounts (not fully paid)
        const pendingAmount = bookingsInMonth.reduce((sum, b) => sum + (b.remainingAmount || 0), 0);
        const pendingAmountEGP = pendingAmount * usdRate;
        
        // Collected (actually paid by guests)
        const collectedAmount = bookingsInMonth.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        const collectedAmountEGP = collectedAmount * usdRate;
        
        // Total broker profit from all bookings in month (matches Financial page calculation)
        // Calculate brokerProfit if not already set in booking
        const totalBrokerProfitFromBookings = bookingsInMonth.reduce((sum, b) => {
          let brokerProfit = b.brokerProfit;
          if (brokerProfit === undefined || brokerProfit === null) {
            // Calculate brokerProfit dynamically if not set
            const totalAmount = b.totalBookingPrice || b.totalAmountUSD || 0;
            const ownerAmt = b.ownerAmount || 0;
            const platformFee = b.platformCommission || 0;
            const cleaningFee = b.cleaningFee || 0;
            const otherExpenses = b.otherExpenses || 0;
            brokerProfit = Math.max(0, totalAmount - ownerAmt - platformFee - cleaningFee - otherExpenses);
          }
          return sum + (brokerProfit || 0);
        }, 0);
        
        // Active bookings
        const today = new Date();
        const activeBookings = allBookings.filter(b => {
          const checkIn = new Date(b.checkIn);
          const checkOut = new Date(b.checkOut);
          return checkIn <= today && checkOut >= today;
        });
        const expectedProfitFromActive = activeBookings.reduce((sum, b) => sum + (b.brokerProfit || 0), 0);
        
        // Upcoming bookings
        const upcomingBookings = allBookings.filter(b => new Date(b.checkIn) > today);
        const expectedProfitFromUpcoming = upcomingBookings.reduce((sum, b) => sum + (b.brokerProfit || 0), 0);
        
        // Payment methods breakdown
        const bookingsByPayment = {};
        bookingsInMonth.forEach(b => {
          const method = b.paymentMethod || 'cash';
          if (!bookingsByPayment[method]) bookingsByPayment[method] = 0;
          bookingsByPayment[method] += b.paidAmount || 0;
        });
        
        // Prepare bookings for display (simplified version)
        const bookingsWithDetails = bookingsInMonth.map(b => {
          const apt = allApartments.find(a => a._id === b.apartment);
          const checkIn = new Date(b.checkIn);
          const checkOut = new Date(b.checkOut);
          const totalNights = b.numberOfNights || Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
          const totalAmount = b.totalBookingPrice || b.totalAmountUSD || 0;
          const pricePerNight = totalNights > 0 ? totalAmount / totalNights : 0;
          
          let nightsInMonth = totalNights;
          if (startDate && endDate) {
            const monthStart = Math.max(checkIn.getTime(), startDate.getTime());
            const monthEnd = Math.min(checkOut.getTime(), endDate.getTime());
            nightsInMonth = Math.max(0, Math.ceil((monthEnd - monthStart) / (1000 * 60 * 60 * 24)));
          }
          
          return {
            id: b._id,
            guestName: b.guestName,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            totalNights: totalNights,
            nightsInMonth: nightsInMonth,
            paidAmount: b.paidAmount || 0,
            paidAmountEGP: (b.paidAmount || 0) * usdRate,
            totalAmount: totalAmount,
            revenueInMonth: pricePerNight * nightsInMonth,
            remainingAmount: b.remainingAmount || 0,
            platformCommission: (checkOut <= endDate && checkOut >= startDate) ? (b.platformCommission || 0) : 0,
            transferCommissionExpense: (checkOut <= endDate && checkOut >= startDate) ? (b.transferCommissionAmount || b.transferCommissionExpense || 0) : 0,
            status: b.status,
            apartmentName: apt?.name || 'غير معروف',
            apartmentId: b.apartment
          };
        });
        
        // Prepare expenses for display
        const expensesWithDetails = filteredExpenses.map(e => {
          const apt = allApartments.find(a => a._id === e.apartment);
          return {
            id: e._id,
            type: e.category,
            amount: e.amount || 0,
            amountUSD: (e.amount || 0) / usdRate,
            description: e.description,
            date: e.date,
            apartmentName: apt?.name || 'عام'
          };
        });
        
        // Add apartment monthly expenses to display
        apartmentsWithBookings.forEach(aptId => {
          const apt = allApartments.find(a => a._id === aptId);
          if (apt && apt.monthlyExpenses && apt.monthlyExpenses.length > 0) {
            apt.monthlyExpenses.forEach((expense, idx) => {
              expensesWithDetails.push({
                id: `monthly-${aptId}-${idx}`,
                type: 'monthly',
                amount: expense.amount || 0,
                amountUSD: (expense.amount || 0) / usdRate,
                description: expense.name || 'مصروف شهري',
                date: year && month ? new Date(year, month - 1, 1).toISOString() : new Date().toISOString(),
                apartmentName: apt.name,
                isMonthly: true
              });
            });
          }
        });
        
        res.json({
          summary: {
            // Module 2: Revenue split by nights
            totalRevenue: totalRevenue,
            totalRevenueEGP: totalRevenue * usdRate,
            // Module 2: Commission only in checkout month
            totalPlatformCommission: totalPlatformCommission,
            // Module 1: Transfer commission as expense
            totalTransferCommissionExpense: totalTransferCommissionExpense,
            // Operating expenses
            totalOperatingExpenses: totalOperatingExpenses,
            totalOperatingExpensesEGP: totalOperatingExpensesEGP,
            // Module 3: Waterfall distribution
            totalOperatingProfit: totalOperatingProfit,
            totalOperatingProfitEGP: totalOperatingProfit * usdRate,
            totalInvestorPayouts: totalInvestorPayouts,
            totalInvestorPayoutsEGP: totalInvestorPayouts * usdRate,
            totalCompanyProfit: totalCompanyProfit,
            totalCompanyProfitEGP: totalCompanyProfit * usdRate,
            totalCompanyOwnerPayouts: totalCompanyOwnerPayouts,
            totalCompanyOwnerPayoutsEGP: totalCompanyOwnerPayouts * usdRate,
            // Net profit = Sum of brokerProfit from all bookings in month (matches Financial page calculation exactly)
            // This matches the calculation in Financial page which sums brokerProfit from bookings directly
            // No need to subtract investor payouts as brokerProfit already accounts for all deductions
            netProfit: totalBrokerProfitFromBookings,
            netProfitEGP: totalBrokerProfitFromBookings * usdRate,
            // Other metrics
            pendingAmount: pendingAmount,
            pendingAmountEGP: pendingAmountEGP,
            collectedAmount: collectedAmount,
            collectedAmountEGP: collectedAmountEGP,
            expectedProfitFromActive: expectedProfitFromActive,
            expectedProfitFromActiveEGP: expectedProfitFromActive * usdRate,
            expectedProfitFromUpcoming: expectedProfitFromUpcoming,
            expectedProfitFromUpcomingEGP: expectedProfitFromUpcoming * usdRate,
            totalBookings: bookingsInMonth.length,
            activeBookings: activeBookings.length,
            upcomingBookings: upcomingBookings.length,
            bookingsByPayment: bookingsByPayment,
            usdRate: usdRate
          },
          // Module 3: Per-apartment financial breakdown
          apartmentFinancials: Object.values(apartmentFinancials).map(fin => {
            const apt = allApartments.find(a => a._id === fin.apartmentId);
            return {
              ...fin,
              apartmentName: apt?.name || 'غير معروف',
              investorPayouts: Object.values(fin.investorPayouts),
              companyOwnerPayouts: Object.values(fin.companyOwnerPayouts)
            };
          }),
          partnerProfits: Object.values(partnerProfits),
          bookings: bookingsWithDetails,
          expenses: expensesWithDetails
        });
      } catch (err) {
        console.error('Error in monthly summary:', err);
        res.status(500).json({ error: err.message });
      }
    });
    
    // Get booking with full apartment and partner details
    serverApp.get('/api/bookings/:id/full', (req, res) => {
      try {
        const booking = db.findById('bookings', req.params.id);
        if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
        
        const apartment = booking.apartment ? db.findById('apartments', booking.apartment) : null;
        const currencyRates = db.find('currencyRates');
        const usdRate = currencyRates.find(r => r.currency === 'USD')?.rateToEGP || 50;
        
        // Populate partner details
        let partners = [];
        if (apartment && apartment.partners) {
          partners = apartment.partners.map(p => {
            const ownerData = p.owner ? db.findById('owners', p.owner) : null;
            const partnerShare = ((booking.ownerAmount || 0) * (p.percentage || 0)) / 100;
            return {
              name: p.name || ownerData?.name || 'غير معروف',
              phone: ownerData?.phone || '',
              percentage: p.percentage || 0,
              shareUSD: partnerShare,
              shareEGP: partnerShare * usdRate
            };
          });
        }
        
        res.json({
          booking: {
            ...booking,
            totalAmountEGP: (booking.totalAmountUSD || 0) * usdRate,
            brokerProfitEGP: (booking.brokerProfit || 0) * usdRate
          },
          apartment: apartment ? {
            _id: apartment._id,
            name: apartment.name,
            location: apartment.location,
            pricePerNight: apartment.pricePerNight,
            images: apartment.images
          } : null,
          partners,
          usdRate
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- MIGRATION: Convert owners to partners --------
    // Run migration once on startup if owners exist but partners don't
    try {
      const owners = db.find('owners');
      const partners = db.find('partners');
      
      if (owners.length > 0 && partners.length === 0) {
        owners.forEach(owner => {
          // Convert owner to partner
          db.insert('partners', {
            name: owner.name,
            phone: owner.phone || '',
            email: owner.email || '',
            defaultSharePercentage: owner.percentage || 0,
            contactInfo: {
              phone: owner.phone || '',
              email: owner.email || ''
            },
            totalEarnings: owner.totalEarnings || 0,
            notes: owner.notes || ''
          });
        });
      }
    } catch (err) {
      console.error('Migration error (non-critical):', err);
    }
    
    // -------- DELETE ALL DATA --------
    serverApp.delete('/api/data/all', (req, res) => {
      try {
        // Clear all user data collections but keep settings
        db.data.partners = [];
        db.data.apartments = [];
        db.data.bookings = [];
        db.data.expenses = [];
        db.save();
        
        res.json({ success: true, message: 'تم حذف جميع البيانات بنجاح' });
      } catch (err) {
        console.error('Error deleting all data:', err);
        res.status(500).json({ error: err.message });
      }
    });
    
    // -------- SEED TEST DATA --------
    serverApp.post('/api/data/seed', (req, res) => {
      try {
        // Helper function to generate IDs
        const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
        const getCurrentDate = () => new Date().toISOString();
        
        // Generate dates for bookings
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11 (0 = January)
        
        // Past month (previous month)
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        // Future month (next month)
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        
        // Past month dates
        const pastStart = new Date(prevYear, prevMonth, 1);
        const pastEnd = new Date(prevYear, prevMonth, 30);
        
        // Current month dates
        const currentStart = new Date(currentYear, currentMonth, 1);
        const currentEnd = new Date(currentYear, currentMonth, 31);
        
        // Future month dates
        const futureStart = new Date(nextYear, nextMonth, 1);
        const futureEnd = new Date(nextYear, nextMonth, 31);
        
        const formatDate = (date) => date.toISOString();
        
        // Clear existing data first
        db.data.partners = [];
        db.data.apartments = [];
        db.data.bookings = [];
        db.data.expenses = [];
        
        // 1. Add Partners (6 partners: 3 investors, 3 company_owners)
        const partners = [
          // Investors
          db.insert('partners', {
            name: "أحمد محمود",
            phone: "01001234567",
            email: "ahmed.mahmoud@email.com",
            defaultSharePercentage: 0,
            type: "investor",
            contactInfo: { phone: "01001234567", email: "ahmed.mahmoud@email.com" },
            totalEarnings: 0,
            notes: "مستثمر في شقة الزمالك"
          }),
          db.insert('partners', {
            name: "محمد علي",
            phone: "01002345678",
            email: "mohamed.ali@email.com",
            defaultSharePercentage: 0,
            type: "investor",
            contactInfo: { phone: "01002345678", email: "mohamed.ali@email.com" },
            totalEarnings: 0,
            notes: "مستثمر في فيلا المعادي"
          }),
          db.insert('partners', {
            name: "يوسف حسن",
            phone: "01003456789",
            email: "youssef.hassan@email.com",
            defaultSharePercentage: 0,
            type: "investor",
            contactInfo: { phone: "01003456789", email: "youssef.hassan@email.com" },
            totalEarnings: 0,
            notes: "مستثمر في شقة جاردن سيتي"
          }),
          // Company Owners
          db.insert('partners', {
            name: "خالد إبراهيم",
            phone: "01004567890",
            email: "khaled.ibrahim@email.com",
            defaultSharePercentage: 0,
            type: "company_owner",
            contactInfo: { phone: "01004567890", email: "khaled.ibrahim@email.com" },
            totalEarnings: 0,
            notes: "شريك أساسي - مدير العمليات"
          }),
          db.insert('partners', {
            name: "عمر سليم",
            phone: "01005678901",
            email: "omar.salem@email.com",
            defaultSharePercentage: 0,
            type: "company_owner",
            contactInfo: { phone: "01005678901", email: "omar.salem@email.com" },
            totalEarnings: 0,
            notes: "شريك أساسي - مدير المبيعات"
          }),
          db.insert('partners', {
            name: "أميرة محمود",
            phone: "01006789012",
            email: "amira.mahmoud@email.com",
            defaultSharePercentage: 0,
            type: "company_owner",
            contactInfo: { phone: "01006789012", email: "amira.mahmoud@email.com" },
            totalEarnings: 0,
            notes: "شريكة أساسية - مديرة المالية"
          })
        ];
        
        
        // 2. Add Apartments (4-5 apartments with rooms and expenses)
        const apt1 = db.insert('apartments', {
          name: "شقة الزمالك الفاخرة",
          location: { city: "Cairo", address: "شارع 26 يوليو، الزمالك" },
          platformCommission: 15,
          partners: [
            { partnerId: partners[0]._id, name: partners[0].name, phone: partners[0].phone, percentage: 20, role: "investor", type: "investor" },
            { partnerId: partners[3]._id, name: partners[3].name, phone: partners[3].phone, percentage: 50, role: "company_owner", type: "company_owner" }
          ],
          monthlyExpenses: [
            { name: "كهرباء", amount: 500, type: "fixed" },
            { name: "حارس", amount: 1500, type: "fixed" }
          ],
          pricePerNight: 120,
          currency: "USD",
          description: "شقة فاخرة في الزمالك بإطلالة على النيل",
          amenities: ["واي فاي", "تكييف", "تلفزيون", "مطبخ كامل"],
          images: [],
          guests: 4,
          bedrooms: 2,
          beds: 2,
          bathrooms: 1,
          numberOfRooms: 2,
          rooms: [
            { roomId: generateId(), roomNumber: "1", type: "Double", status: "available", images: [], createdAt: getCurrentDate(), updatedAt: getCurrentDate() },
            { roomId: generateId(), roomNumber: "2", type: "Single", status: "available", images: [], createdAt: getCurrentDate(), updatedAt: getCurrentDate() }
          ],
          isActive: true
        });
        
        const apt2 = db.insert('apartments', {
          name: "فيلا المعادي",
          location: { city: "Cairo", address: "طريق المعادي، المعادي" },
          platformCommission: 12,
          partners: [
            { partnerId: partners[1]._id, name: partners[1].name, phone: partners[1].phone, percentage: 25, role: "investor", type: "investor" },
            { partnerId: partners[4]._id, name: partners[4].name, phone: partners[4].phone, percentage: 50, role: "company_owner", type: "company_owner" },
            { partnerId: partners[5]._id, name: partners[5].name, phone: partners[5].phone, percentage: 50, role: "company_owner", type: "company_owner" }
          ],
          monthlyExpenses: [
            { name: "كهرباء", amount: 800, type: "fixed" },
            { name: "مياه", amount: 200, type: "fixed" },
            { name: "حارس", amount: 2000, type: "fixed" }
          ],
          pricePerNight: 200,
          currency: "USD",
          description: "فيلا فاخرة بحديقة في المعادي",
          amenities: ["واي فاي", "تكييف", "مسبح", "حديقة", "موقف سيارات"],
          images: [],
          guests: 8,
          bedrooms: 4,
          beds: 5,
          bathrooms: 3,
          numberOfRooms: 3,
          rooms: [
            { roomId: generateId(), roomNumber: "1", type: "Master", status: "available", images: [], createdAt: getCurrentDate(), updatedAt: getCurrentDate() },
            { roomId: generateId(), roomNumber: "2", type: "Double", status: "available", images: [], createdAt: getCurrentDate(), updatedAt: getCurrentDate() },
            { roomId: generateId(), roomNumber: "3", type: "Single", status: "available", images: [], createdAt: getCurrentDate(), updatedAt: getCurrentDate() }
          ],
          isActive: true
        });
        
        const apt3 = db.insert('apartments', {
          name: "شقة جاردن سيتي",
          location: { city: "Cairo", address: "كورنيش النيل، جاردن سيتي" },
          platformCommission: 15,
          partners: [
            { partnerId: partners[2]._id, name: partners[2].name, phone: partners[2].phone, percentage: 30, role: "investor", type: "investor" }
          ],
          monthlyExpenses: [
            { name: "كهرباء", amount: 400, type: "fixed" }
          ],
          pricePerNight: 80,
          currency: "USD",
          description: "شقة أنيقة في جاردن سيتي",
          amenities: ["واي فاي", "تكييف"],
          images: [],
          guests: 2,
          bedrooms: 1,
          beds: 1,
          bathrooms: 1,
          numberOfRooms: 1,
          rooms: [
            { roomId: generateId(), roomNumber: "1", type: "Single", status: "available", images: [], createdAt: getCurrentDate(), updatedAt: getCurrentDate() }
          ],
          isActive: true
        });
        
        const apt4 = db.insert('apartments', {
          name: "شقة مصر الجديدة",
          location: { city: "Cairo", address: "شارع العروبة، مصر الجديدة" },
          platformCommission: 10,
          partners: [],
          monthlyExpenses: [
            { name: "حارس", amount: 1000, type: "fixed" }
          ],
          pricePerNight: 60,
          currency: "USD",
          description: "شقة بسيطة في مصر الجديدة",
          amenities: ["واي فاي"],
          images: [],
          guests: 2,
          bedrooms: 1,
          beds: 1,
          bathrooms: 1,
          numberOfRooms: 1,
          rooms: [
            { roomId: generateId(), roomNumber: "1", type: "Single", status: "available", images: [], createdAt: getCurrentDate(), updatedAt: getCurrentDate() }
          ],
          isActive: true
        });
        
        const apartments = [apt1, apt2, apt3, apt4];
        
        // 3. Add Bookings
        const bookings = [];
        const usdRate = 50;
        
        // Past bookings (November 2024) - All completed and paid
        const pastBookings = [
          {
            bookingId: "BK-PAST-001",
            apartment: apt1._id,
            roomId: apt1.rooms[0].roomId,
            bookingType: "individual",
            guestName: "John Smith",
            guestNationality: "American",
            guestPhone: "+1234567890",
            guestEmail: "john.smith@email.com",
            guestOrigin: "USA",
            guestDestination: "Egypt",
            originType: "external",
            checkIn: formatDate(new Date(prevYear, prevMonth, 5)),
            checkOut: formatDate(new Date(prevYear, prevMonth, 12)),
            numberOfNights: 7,
            totalBookingPrice: 840,
            totalAmountUSD: 840,
            paidAmount: 840,
            remainingAmount: 0,
            ownerAmount: 672, // 80% of 840
            platformCommission: 126, // 15% of 840
            cleaningFee: 20,
            otherExpenses: 0,
            brokerProfit: 22, // 840 - 672 - 126 - 20
            paymentMethod: "visa",
            source: "Airbnb",
            currency: "USD",
            exchangeRate: usdRate,
            totalAmountEGP: 840 * usdRate,
            status: "completed",
            isPaid: true,
            commissionStatus: "applied",
            commissionAppliedDate: formatDate(new Date(prevYear, prevMonth, 12))
          },
          {
            bookingId: "BK-PAST-002",
            apartment: apt2._id,
            roomId: apt2.rooms[0].roomId,
            bookingType: "individual",
            guestName: "Maria Garcia",
            guestNationality: "Spanish",
            guestPhone: "+34123456789",
            guestEmail: "maria.garcia@email.com",
            guestOrigin: "Spain",
            guestDestination: "Egypt",
            originType: "external",
            checkIn: formatDate(new Date(prevYear, prevMonth, 10)),
            checkOut: formatDate(new Date(prevYear, prevMonth, 17)),
            numberOfNights: 7,
            totalBookingPrice: 1400,
            totalAmountUSD: 1400,
            paidAmount: 1400,
            remainingAmount: 0,
            ownerAmount: 1100, // 78.57% (25% investor + 53.57% company)
            platformCommission: 168, // 12% of 1400
            cleaningFee: 30,
            otherExpenses: 0,
            brokerProfit: 102, // 1400 - 1100 - 168 - 30
            paymentMethod: "cash",
            source: "Booking.com",
            currency: "USD",
            exchangeRate: usdRate,
            totalAmountEGP: 1400 * usdRate,
            status: "completed",
            isPaid: true,
            commissionStatus: "applied",
            commissionAppliedDate: formatDate(new Date(prevYear, prevMonth, 17))
          },
          {
            bookingId: "BK-PAST-003",
            apartment: apt3._id,
            roomId: apt3.rooms[0].roomId,
            bookingType: "individual",
            guestName: "Ahmed Hassan",
            guestNationality: "Egyptian",
            guestPhone: "01009876543",
            guestEmail: "ahmed.hassan@email.com",
            guestOrigin: "Cairo",
            guestDestination: "Cairo",
            originType: "external",
            checkIn: formatDate(new Date(prevYear, prevMonth, 15)),
            checkOut: formatDate(new Date(prevYear, prevMonth, 20)),
            numberOfNights: 5,
            totalBookingPrice: 400,
            totalAmountUSD: 400,
            paidAmount: 400,
            remainingAmount: 0,
            ownerAmount: 280, // 70% of 400 (30% investor)
            platformCommission: 0, // External booking - no commission
            cleaningFee: 15,
            otherExpenses: 0,
            brokerProfit: 105, // 400 - 280 - 0 - 15
            paymentMethod: "instapay",
            source: "External",
            currency: "USD",
            exchangeRate: usdRate,
            totalAmountEGP: 400 * usdRate,
            status: "completed",
            isPaid: true,
            commissionStatus: "applied",
            commissionAppliedDate: formatDate(new Date(prevYear, prevMonth, 20))
          }
        ];
        
        // Active bookings (December 2024) - Currently active
        const activeBookings = [
          {
            bookingId: "BK-ACTIVE-001",
            apartment: apt1._id,
            roomId: apt1.rooms[1].roomId,
            bookingType: "individual",
            guestName: "Sarah Johnson",
            guestNationality: "British",
            guestPhone: "+44123456789",
            guestEmail: "sarah.johnson@email.com",
            guestOrigin: "UK",
            guestDestination: "Egypt",
            originType: "external",
            checkIn: formatDate(new Date(currentYear, currentMonth, 1)),
            checkOut: formatDate(new Date(currentYear, currentMonth, 10)),
            numberOfNights: 9,
            totalBookingPrice: 1080,
            totalAmountUSD: 1080,
            paidAmount: 1080,
            remainingAmount: 0,
            ownerAmount: 864, // 80% of 1080
            platformCommission: 162, // 15% of 1080
            cleaningFee: 25,
            otherExpenses: 0,
            brokerProfit: 29, // 1080 - 864 - 162 - 25
            paymentMethod: "visa",
            source: "Airbnb",
            currency: "USD",
            exchangeRate: usdRate,
            totalAmountEGP: 1080 * usdRate,
            status: "confirmed",
            isPaid: true,
            commissionStatus: "pending", // Active booking
            commissionAppliedDate: null
          },
          {
            bookingId: "BK-ACTIVE-002",
            apartment: apt2._id,
            roomId: apt2.rooms[1].roomId,
            bookingType: "individual",
            guestName: "David Brown",
            guestNationality: "Canadian",
            guestPhone: "+15123456789",
            guestEmail: "david.brown@email.com",
            guestOrigin: "Canada",
            guestDestination: "Egypt",
            originType: "external",
            checkIn: formatDate(new Date(currentYear, currentMonth, 5)),
            checkOut: formatDate(new Date(currentYear, currentMonth, 15)),
            numberOfNights: 10,
            totalBookingPrice: 2000,
            totalAmountUSD: 2000,
            paidAmount: 1000, // Partial payment
            remainingAmount: 1000,
            ownerAmount: 1571, // 78.55% of 2000
            platformCommission: 240, // 12% of 2000
            cleaningFee: 40,
            otherExpenses: 0,
            brokerProfit: 149, // 2000 - 1571 - 240 - 40
            paymentMethod: "cash",
            source: "Booking.com",
            currency: "USD",
            exchangeRate: usdRate,
            totalAmountEGP: 2000 * usdRate,
            status: "confirmed",
            isPaid: false,
            commissionStatus: "pending",
            commissionAppliedDate: null
          }
        ];
        
        // Upcoming bookings (January 2025)
        const upcomingBookings = [
          {
            bookingId: "BK-UPCOMING-001",
            apartment: apt3._id,
            roomId: apt3.rooms[0].roomId,
            bookingType: "individual",
            guestName: "Lisa Anderson",
            guestNationality: "Swedish",
            guestPhone: "+46123456789",
            guestEmail: "lisa.anderson@email.com",
            guestOrigin: "Sweden",
            guestDestination: "Egypt",
            originType: "external",
            checkIn: formatDate(new Date(nextYear, nextMonth, 5)),
            checkOut: formatDate(new Date(nextYear, nextMonth, 12)),
            numberOfNights: 7,
            totalBookingPrice: 560,
            totalAmountUSD: 560,
            paidAmount: 0,
            remainingAmount: 560,
            ownerAmount: 392, // 70% of 560
            platformCommission: 84, // 15% of 560
            cleaningFee: 20,
            otherExpenses: 0,
            brokerProfit: 64, // 560 - 392 - 84 - 20
            paymentMethod: "visa",
            source: "Airbnb",
            currency: "USD",
            exchangeRate: usdRate,
            totalAmountEGP: 560 * usdRate,
            status: "confirmed",
            isPaid: false,
            commissionStatus: "pending",
            commissionAppliedDate: null
          },
          {
            bookingId: "BK-UPCOMING-002",
            apartment: apt4._id,
            roomId: apt4.rooms[0].roomId,
            bookingType: "individual",
            guestName: "Mohamed Ali",
            guestNationality: "Egyptian",
            guestPhone: "01234567890",
            guestEmail: "mohamed.ali@email.com",
            guestOrigin: "Alexandria",
            guestDestination: "Cairo",
            originType: "external",
            checkIn: formatDate(new Date(nextYear, nextMonth, 10)),
            checkOut: formatDate(new Date(nextYear, nextMonth, 15)),
            numberOfNights: 5,
            totalBookingPrice: 300,
            totalAmountUSD: 300,
            paidAmount: 150,
            remainingAmount: 150,
            ownerAmount: 240, // 80% of 300 (no partners, so this is company share)
            platformCommission: 0, // External booking - no commission
            cleaningFee: 10,
            otherExpenses: 0,
            brokerProfit: 50, // 300 - 240 - 0 - 10
            paymentMethod: "cash",
            source: "External",
            currency: "USD",
            exchangeRate: usdRate,
            totalAmountEGP: 300 * usdRate,
            status: "confirmed",
            isPaid: false,
            commissionStatus: "pending",
            commissionAppliedDate: null
          }
        ];
        
        // Insert all bookings
        [...pastBookings, ...activeBookings, ...upcomingBookings].forEach(bookingData => {
          const booking = db.insert('bookings', bookingData);
          bookings.push(booking);
        });
        
        
        // 4. Add Expenses
        const expenses = [
          // Monthly expenses for apartments (already in apartment.monthlyExpenses, but add general expenses)
          db.insert('expenses', {
            apartment: apt1._id,
            category: "maintenance",
            amount: 500, // EGP
            currency: "EGP",
            description: "صيانة دورية - شقة الزمالك",
            date: formatDate(new Date(currentYear, currentMonth, 1))
          }),
          db.insert('expenses', {
            apartment: apt2._id,
            category: "utilities",
            amount: 300, // EGP
            currency: "EGP",
            description: "فاتورة مياه - فيلا المعادي",
            date: formatDate(new Date(currentYear, currentMonth, 5))
          })
        ];
        
        
        db.save();
        
        res.json({
          success: true,
          message: 'تم إضافة بيانات الاختبار بنجاح',
          data: {
            partners: partners.length,
            apartments: apartments.length,
            bookings: bookings.length,
            expenses: expenses.length
          }
        });
      } catch (err) {
        console.error('Error seeding test data:', err);
        res.status(500).json({ error: err.message });
      }
    });
    
    // Serve frontend for all other routes
    serverApp.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      const indexPath = path.join(frontendPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Frontend not found');
      }
    });
    
    serverApp.use((err, req, res, next) => {
      console.error('Server error:', err);
      res.status(500).json({ error: err.message });
    });
    
    return new Promise((resolve, reject) => {
      const server = serverApp.listen(currentPort, '127.0.0.1', () => {
        backendProcess = { server, db };
        resolve(currentPort);
      });
      
      server.on('error', (err) => {
        console.error('Server error:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error in startBackend:', error);
    throw error;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    show: false,
    title: 'HOSTEL MASR - نظام إدارة الحجوزات',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'public', 'icon.png')
  });
  
  Menu.setApplicationMenu(null);
  
  startBackend().then((port) => {
    const url = `http://127.0.0.1:${port}`;
    mainWindow.loadURL(url).catch((err) => {
      console.error('Failed to load URL:', err);
    });
    mainWindow.show();
    mainWindow.focus();
  }).catch((err) => {
    console.error('Failed to start backend:', err);
    mainWindow.show();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess && backendProcess.server) {
    backendProcess.server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess && backendProcess.server) {
    backendProcess.server.close();
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
