import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getEnv = (key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).env && (window as any).env[key]) {
        return (window as any).env[key];
    }
    return import.meta.env[key];
};

const firebaseConfig = {
    apiKey: getEnv("VITE_FIREBASE_API_KEY"),
    authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    databaseURL: getEnv("VITE_FIREBASE_DATABASE_URL"),
    projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnv("VITE_FIREBASE_APP_ID")
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
