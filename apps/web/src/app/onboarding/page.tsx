'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'தமிழ்' },
];

export default function Onboarding() {
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [hospitalId, setHospitalId] = useState('');
  const [language, setLanguage] = useState('en');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: hospData } = useQuery({ queryKey: ['hospitals'], queryFn: () => api.hospitals() });
  const hospitals = hospData?.hospitals ?? [];

  useEffect(() => {
    const raw = sessionStorage.getItem('arya-onboard');
    if (!raw) {
      router.replace('/login');
      return;
    }
    const p = JSON.parse(raw);
    setEmail(p.email || '');
    setName(p.displayName || '');
  }, [router]);

  useEffect(() => {
    if (!hospitalId && hospitals.length) setHospitalId(hospitals[0].id);
  }, [hospitals, hospitalId]);

  async function submit() {
    setError(null);
    if (!name.trim() || phone.replace(/\D/g, '').length < 10 || !hospitalId) {
      setError('Please fill your name, a valid phone number, and hospital.');
      return;
    }
    setSaving(true);
    try {
      const { profile } = await api.completeProfile({
        email,
        role,
        displayName: name,
        phone,
        hospitalId,
        preferredLanguage: language,
      });
      setUser(profile);
      sessionStorage.removeItem('arya-onboard');
      router.push(role === 'patient' ? '/patient' : '/doctor');
    } catch {
      setError('Could not save your profile. Is the API running?');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-white p-8 shadow-lift"
      >
        <h1 className="text-2xl font-semibold text-teal-900">Complete your profile</h1>
        <p className="mt-1 text-sm text-teal-600">{email}</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-teal-700">I am a</label>
            <div className="grid grid-cols-2 gap-2">
              {(['patient', 'doctor'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-xl py-3 text-sm font-medium capitalize transition-colors ${
                    role === r ? 'bg-teal-600 text-cream-50' : 'bg-cream-100 text-teal-800'
                  }`}
                >
                  {r === 'patient' ? '🙋 Patient' : '🩺 Doctor'}
                </button>
              ))}
            </div>
          </div>

          <Field label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Your name" />
          </Field>
          <Field label="Phone number">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Hospital">
            <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} className={inputCls}>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Preferred language">
            <div className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    language === l.code ? 'bg-teal-600 text-cream-50' : 'bg-cream-100 text-teal-800'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Field>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-signal-red">{error}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-xl bg-teal-600 py-3 font-medium text-cream-50 shadow-card disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
          <p className="text-center text-xs text-teal-500">
            Patients and doctors in the same hospital are connected automatically.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-teal-100 bg-cream-50 px-4 py-3 text-teal-900 outline-none focus:border-teal-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-teal-700">{label}</label>
      {children}
    </div>
  );
}
