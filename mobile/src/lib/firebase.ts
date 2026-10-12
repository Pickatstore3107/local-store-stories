import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// The live (prod) project the website uses, so the app shows the same posts.
// These values only name the project; the security rules protect the data.
const firebaseConfig = {
  apiKey: "AIzaSyAD6taq4iJnrpKfK5BmWhRYkmR8ydmmnAw",
  authDomain: "pas-prod-c8190.firebaseapp.com",
  projectId: "pas-prod-c8190",
  storageBucket: "pas-prod-c8190.firebasestorage.app",
  messagingSenderId: "1014325020479",
  appId: "1:1014325020479:web:e1f5115bc77e5c3c88b58a",
};

const fresh = !getApps().length;
const app = fresh ? initializeApp(firebaseConfig) : getApp();

// Keeps people signed in after the app closes. (The web preview, used only
// for checking screens on a computer, has its own way of doing that.)
const auth: Auth = fresh && Platform.OS !== "web"
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const firebase = { app, auth, db: getFirestore(app) };

/** The same services, under the name the website's shared code uses. */
export function getFirebase() {
  return firebase;
}
