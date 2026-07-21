'use client';
import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
} from 'firebase/auth';

// Phone OTP auth. Values come from apps/web/.env.local (NEXT_PUBLIC_*).
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(config.apiKey && config.projectId);

export function getFirebaseAuth() {
  if (!firebaseReady) return null;
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  return getAuth(app);
}

/** Google popup sign-in. Returns the user's email + name, or null if unavailable. */
export async function signInWithGoogle(): Promise<{ email: string; displayName: string } | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return {
    email: result.user.email || '',
    displayName: result.user.displayName || '',
  };
}

export { RecaptchaVerifier, signInWithPhoneNumber };
