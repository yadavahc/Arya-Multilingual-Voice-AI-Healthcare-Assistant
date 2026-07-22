'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';

// Three.js hero — client only (no SSR).
const AryaHero3D = dynamic(() => import('@/components/AryaHero3D').then((m) => m.AryaHero3D), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

const featureKeys = [
  { title: 'Voice-Native Triage', body: '24/7 symptom triage in the patient’s language with red-flag escalation to the on-call doctor.' },
  { title: 'Ambient Scribing', body: 'Consultations become SOAP notes with ICD-10 codes and cited differentials — in seconds.' },
  { title: 'Care Companion', body: 'Answers medication, diet, rest and follow-up questions; books appointments by voice.' },
  { title: 'Document Q&A', body: 'Upload a prescription or lab report and ask about it in your own language.' },
  { title: 'One Language, Everywhere', body: 'Pick your language once — the whole app and Arya speak it, clearly and instantly.' },
  { title: 'Doctor Oversight', body: 'Every call is transcribed, summarised, and reviewable, with feedback to improve Arya.' },
];

export default function Landing() {
  const t = useT();
  return (
    <div className="mx-auto max-w-7xl px-6">
      {/* Hero */}
      <section className="grid items-center gap-8 py-16 md:grid-cols-2 md:py-24">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="mb-4 inline-block rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700"
          >
            {t('landing.tag')}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
            className="text-5xl font-semibold leading-tight tracking-tight text-teal-900"
          >
            {t('landing.title')}
          </motion.h1>
          <p className="mt-5 max-w-xl text-lg text-teal-700">{t('landing.subtitle')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/login" className="rounded-xl bg-teal-600 px-6 py-3 font-medium text-cream-50 shadow-lift transition-transform duration-200 hover:-translate-y-0.5">
              {t('landing.google')}
            </Link>
            <Link href="/login" className="rounded-xl bg-white px-6 py-3 font-medium text-teal-800 shadow-card transition-transform duration-200 hover:-translate-y-0.5">
              {t('landing.start')}
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="relative h-[380px] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-600 shadow-lift md:h-[460px]"
        >
          <AryaHero3D />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6 text-center">
            <p className="text-cream-100/90">“नमस्ते, I’m Arya. How can I help you today?”</p>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="pb-24">
        <h2 className="mb-8 text-2xl font-semibold text-teal-900">Built for real clinics</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featureKeys.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.05 }}
              className="rounded-2xl bg-white p-6 shadow-card transition-shadow duration-200 hover:shadow-lift"
            >
              <div className="mb-3 h-1 w-10 rounded-full bg-teal-400" />
              <h3 className="text-lg font-semibold text-teal-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-teal-700">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
