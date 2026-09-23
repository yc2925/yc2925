import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBlCYUpq0wu-CObwV9gCbw5HZGlctGC_Lc",
  authDomain: "pwb-yc2925-project-64c07.firebaseapp.com",
  projectId: "pwb-yc2925-project-64c07",
  storageBucket: "pwb-yc2925-project-64c07.firebasestorage.app",
  messagingSenderId: "102278625735",
  appId: "1:102278625735:web:9a9f1a0169ae7d8baf81e2"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
