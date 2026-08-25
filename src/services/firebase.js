// src/services/firebase.js
// Firebase App Initialization for SpendAchu
// Replace the placeholder values below with your actual Firebase project config
// from Firebase Console → Project Settings → General → Your apps → Web app

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  FacebookAuthProvider 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCtsH0AwRBn_5nDOZtKoUEYTRehz9D3zak",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "spendachu-dc2d2.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "spendachu-dc2d2",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "spendachu-dc2d2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "839448345410",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "1:839448345410:web:ab3e663e422a2bef90a6db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);

// Firestore Database
export const db = getFirestore(app);

// Firebase Storage (for profile pictures)
export const storage = getStorage(app);

// Social Login Providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');

export default app;
