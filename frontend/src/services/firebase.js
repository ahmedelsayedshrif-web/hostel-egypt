import { initializeApp } from 'firebase/app'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { getFirestore, collection } from 'firebase/firestore'

// Firebase configuration
// TODO: Replace with your actual Firebase config
// You can get these values from Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const storage = getStorage(app)
const db = getFirestore(app)

// Firestore collection references
export const apartmentsFirestore = collection(db, 'apartments')
export const bookingsFirestore = collection(db, 'bookings')
export const partnersFirestore = collection(db, 'partners')
export const settingsFirestore = collection(db, 'settings')
export const expensesFirestore = collection(db, 'expenses')
export { db }

/**
 * Upload image to Firebase Storage
 * @param {File} file - Image file to upload
 * @param {string} folder - Folder path in storage (e.g., 'inventory_images')
 * @param {Function} onProgress - Optional progress callback (progress: number) => void
 * @returns {Promise<string>} Download URL of uploaded image
 */
export const uploadImageToFirebase = async (file, folder = 'inventory_images', onProgress = null) => {
  try {
    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${folder}/${timestamp}_${randomStr}.${fileExtension}`
    
    // Create storage reference
    const storageRef = ref(storage, fileName)
    
    // Create upload task
    const uploadTask = uploadBytesResumable(storageRef, file)
    
    // Return promise that resolves with download URL
    return new Promise((resolve, reject) => {
      // Listen for state changes
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Track upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          if (onProgress) {
            onProgress(progress)
          }
        },
        (error) => {
          // Handle unsuccessful uploads
          console.error('Firebase upload error:', error)
          reject(error)
        },
        async () => {
          // Handle successful uploads
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            resolve(downloadURL)
          } catch (error) {
            console.error('Error getting download URL:', error)
            reject(error)
          }
        }
      )
    })
  } catch (error) {
    console.error('Error uploading to Firebase:', error)
    throw error
  }
}

/**
 * Delete image from Firebase Storage
 * @param {string} url - Full URL of the image to delete
 */
export const deleteImageFromFirebase = async (url) => {
  try {
    // Extract file path from URL
    // Firebase Storage URLs look like: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Ffile.jpg?alt=media
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)\?/)
    if (!pathMatch) {
      throw new Error('Invalid Firebase Storage URL')
    }
    
    const filePath = decodeURIComponent(pathMatch[1])
    const fileRef = ref(storage, filePath)
    
    // Delete file
    const { deleteObject } = await import('firebase/storage')
    await deleteObject(fileRef)
    return true
  } catch (error) {
    console.error('Error deleting from Firebase:', error)
    // Don't throw - file might already be deleted
    return false
  }
}

export default storage

