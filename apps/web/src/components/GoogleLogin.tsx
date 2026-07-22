'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { firebaseReady, signInWithGoogle } from '@/lib/firebase';

/** Google sign-in. On success, resolves the profile; routes to onboarding if new. */
export function GoogleLogin() {
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setLoading(true);
    try {
      if (!firebaseReady) throw new Error('Firebase not configured.');
      const g = await signInWithGoogle();
      if (!g?.email) throw new Error('Google sign-in returned no email.');

      const { needsOnboarding, profile } = await api.googleAuth(g.email, g.displayName);
      if (needsOnboarding) {
        // Stash email/name for the onboarding form.
        sessionStorage.setItem('arya-onboard', JSON.stringify(profile));
        router.push('/onboarding');
        return;
      }
      setUser(profile);
      router.push(profile.role === 'patient' ? '/patient' : '/doctor');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('operation-not-allowed') || msg.includes('configuration')) {
        setError('Enable Google sign-in in Firebase Console → Authentication → Sign-in method.');
      } else if (msg.includes('popup-closed')) {
        setError('Sign-in cancelled.');
      } else {
        setError(msg || 'Sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={signIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-teal-100 bg-white py-3 font-medium text-teal-900 shadow-card disabled:opacity-60"
      >
        <GoogleG />
        {loading ? 'Signing in…' : t('login.google')}
      </motion.button>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-signal-red">{error}</p>}
      {!firebaseReady && (
        <p className="text-xs text-amber-700">Set NEXT_PUBLIC_FIREBASE_* to enable Google login.</p>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.5 6.9l7 5.4c4.1-3.8 6.4-9.4 6.4-16.8z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.4l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7-5.4c-2 1.3-4.6 2.1-8.2 2.1-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
