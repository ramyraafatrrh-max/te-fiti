// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB655W4hRpEPrfH7NOQdYwD_6f3G4xpBjE",
  authDomain: "te-fiti-bd76d.firebaseapp.com",
  projectId: "te-fiti-bd76d",
  storageBucket: "te-fiti-bd76d.firebasestorage.app",
  messagingSenderId: "329846201703",
  appId: "1:329846201703:web:48df63e24ded481d3523c2",
  measurementId: "G-T6HVN9PKSL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);