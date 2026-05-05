import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId:         "legio-invicta-clan",
  appId:             "1:299382240591:web:c5b92e8260058ca180413a",
  storageBucket:     "legio-invicta-clan.firebasestorage.app",
  apiKey:            "AIzaSyCANZXzfsQPadgKmaSL30NHt6GNRScNqAE",
  authDomain:        "legio-invicta-clan.firebaseapp.com",
  messagingSenderId: "299382240591",
};

const app = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
