'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useVoiceRoom } from '@/lib/useVoiceRoom';
import { api } from '@/lib/api';

const DOSES = [
  { icon: '☀️', label: 'Morning', time: '8:00 AM', med: 'BP tablet' },
  { icon: '🍽️', label: 'Afternoon', time: '2:00 PM', med: 'Metformin' },
  { icon: '🌙', label: 'Night', time: '9:00 PM', med: 'BP tablet' },
];

export default function Patient() {
  const { status, connect, disconnect } = useVoiceRoom('triage');
  const [paid, setPaid] = useState<string | null>(null);

  async function pay() {
    const r = await api.sendPaymentLink({ orgId: 'demo-org', patientId: 'pat-1', amount: 50000, note: 'Consultation fee' });
    setPaid(r.link);
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="text-3xl font-semibold text-teal-900">Namaste, Ramesh</h1>
      <p className="mt-1 text-lg text-teal-600">How can Arya help today?</p>

      <button
        onClick={status === 'live' ? disconnect : connect}
        className={`mt-6 grid w-full place-items-center gap-2 rounded-3xl py-10 text-cream-50 shadow-lift transition-transform duration-200 hover:-translate-y-0.5 ${
          status === 'live' ? 'bg-signal-red' : 'bg-teal-600'
        }`}
      >
        <motion.span
          animate={{ scale: status === 'live' ? [1, 1.1, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="text-5xl"
        >
          {status === 'live' ? '⏹' : '🎙️'}
        </motion.span>
        <span className="text-lg font-medium">
          {status === 'live' ? 'Tap to end' : 'Tap to talk to Arya'}
        </span>
      </button>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-teal-900">Your medicines</h2>
        <div className="mt-3 space-y-3">
          {DOSES.map((d) => (
            <div key={d.label} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card">
              <span className="text-4xl">{d.icon}</span>
              <div className="flex-1">
                <p className="text-lg font-medium text-teal-900">{d.med}</p>
                <p className="text-teal-600">{d.label} · {d.time}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-teal-50 p-5 shadow-card">
        <h2 className="text-lg font-semibold text-teal-900">Consultation fee</h2>
        <p className="mt-1 text-2xl font-semibold text-teal-800">₹500</p>
        {paid ? (
          <a href={paid} className="mt-3 inline-block rounded-xl bg-teal-600 px-5 py-3 font-medium text-cream-50">
            Open payment link →
          </a>
        ) : (
          <button onClick={pay} className="mt-3 w-full rounded-xl bg-teal-600 py-3 font-medium text-cream-50 shadow-card">
            Pay now
          </button>
        )}
      </section>
    </div>
  );
}
