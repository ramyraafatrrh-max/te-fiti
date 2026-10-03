// =====================================================================
//  1) Paste YOUR Firebase web-app config here (keep the quotes and commas)
//     Firebase Console -> Project settings -> General -> Your apps -> SDK setup and configuration -> Config
// =====================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyB655W4hRpEPrfH7NOQdYwD_6f3G4xpBjE",
  authDomain: "te-fiti-bd76d.firebaseapp.com",
  projectId: "te-fiti-bd76d",
  storageBucket: "te-fiti-bd76d.firebasestorage.app",
  messagingSenderId: "329846201703",
  appId: "1:329846201703:web:48df63e24ded481d3523c2",
};

// =====================================================================
//  2) Moderator account (used to log in to monitor.html)
//     Create this user in Firebase -> Authentication -> Users -> Add user.
//     Use lowercase letters, and put the SAME email in firestore.rules.
// =====================================================================
export const ADMIN_EMAIL = "ramy.tefiti@gmail.com";
