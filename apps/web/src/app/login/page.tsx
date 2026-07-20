'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';

const portals = [
  {
    href: '/login/doctor',
    icon: '🩺',
    title: 'Clinician',
    body: 'Doctors, admins & front-desk. Live consults, notes, call console and analytics.',
  },
  {
    href: '/login/patient',
    icon: '🙋',
    title: 'Patient',
    body: 'Talk to Arya about your medicines, diet, rest and appointments — any time.',
  },
];

export default function LoginPortal() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-teal-900">Welcome to Arya</h1>
        <p className="mt-2 text-teal-600">Choose how you’d like to sign in.</p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {portals.map((p, i) => (
          <motion.div
            key={p.href}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Link
              href={p.href}
              className="block h-full rounded-3xl bg-white p-8 shadow-card transition-shadow duration-200 hover:shadow-lift"
            >
              <div className="text-4xl">{p.icon}</div>
              <h2 className="mt-4 text-xl font-semibold text-teal-900">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-teal-700">{p.body}</p>
              <span className="mt-4 inline-block font-medium text-teal-600">Continue →</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
