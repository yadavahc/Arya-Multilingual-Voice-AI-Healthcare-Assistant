'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Portal = 'doctor' | 'patient';

// Demo OTP. Matches the Firebase test-number codes so the flow feels identical.
// Swap this path for real Firebase phone OTP when going to production.
const DEMO_OTP = '123456';

/** Normalize an Indian number to E.164 (+91XXXXXXXXXX) for the resolve lookup. */
function toE164(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return input.trim().startsWith('+') ? input.trim() : `+${digits}`;
}

export function PhoneLogin({ portal }: { portal: Portal }) {
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const [phone, setPhone] = useState('+91 ');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function sendCode() {
    setError(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setStep('code');
  }

  async function verify() {
    setError(null);
    setLoading(true);
    try {
      if (code.trim() !== DEMO_OTP) {
        setError('Incorrect code. For this demo the code is 123456.');
        return;
      }
      // Code accepted — resolve role via our API (enforces portal separation).
      const identity = await api.resolveIdentity(toE164(phone), portal);
      setUser(identity);
      router.push(identity.role === 'patient' ? '/patient' : '/consult');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('403')) {
        setError(
          portal === 'doctor'
            ? 'This number is not registered as clinical staff.'
            : 'This number is registered as staff — please use the staff portal.',
        );
      } else {
        setError('Could not sign you in. Is the API running on :8080?');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-3xl bg-white p-8 shadow-lift">
      <h1 className="text-2xl font-semibold text-teal-900">
        {portal === 'doctor' ? 'Clinician sign in' : 'Patient sign in'}
      </h1>
      <p className="mt-1 text-sm text-teal-600">
        {portal === 'doctor'
          ? 'For doctors, admins and front-desk staff.'
          : 'Sign in with your phone to talk to Arya.'}
      </p>

      {step === 'phone' ? (
        <div className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-teal-700">Phone number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            placeholder="+91 98765 43210"
            className="w-full rounded-xl border border-teal-100 bg-cream-50 px-4 py-3 text-teal-900 outline-none focus:border-teal-400"
          />
          <button
            onClick={sendCode}
            className="w-full rounded-xl bg-teal-600 py-3 font-medium text-cream-50 shadow-card"
          >
            Send code
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-teal-700">
            Enter the 6-digit code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verify()}
            placeholder="123456"
            inputMode="numeric"
            autoFocus
            className="w-full rounded-xl border border-teal-100 bg-cream-50 px-4 py-3 text-center text-2xl tracking-widest text-teal-900 outline-none focus:border-teal-400"
          />
          <button
            onClick={verify}
            disabled={loading}
            className="w-full rounded-xl bg-teal-600 py-3 font-medium text-cream-50 shadow-card disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Verify & continue'}
          </button>
          <button onClick={() => setStep('phone')} className="w-full text-sm text-teal-600">
            ← Use a different number
          </button>
          <p className="text-center text-xs text-teal-500">Demo code: 123456</p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-signal-red">{error}</p>
      )}
    </div>
  );
}
