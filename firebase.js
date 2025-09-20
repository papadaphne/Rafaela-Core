// Import functions dari Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCvxwqoClL-dJICjD1DH1JvcTODSQirPUE",
  authDomain: "rafaela-system.firebaseapp.com",
  projectId: "rafaela-system",
  storageBucket: "rafaela-system.firebasestorage.app",
  messagingSenderId: "161823738723",
  appId: "1:161823738723:web:5e4d98ad0608501a72e156"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
const db = getFirestore(app);

// Export fungsi yang diperlukan
export { 
    db, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot,
    serverTimestamp 
};
