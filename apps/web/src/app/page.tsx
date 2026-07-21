'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Waveform } from '@/components/Waveform';
import { LatencyCounter } from '@/components/LatencyCounter';

const features = [
  {
    title: 'Ambient Gap-Detection',
    body: 'A silent agent watches the live transcript and nudges the doctor about missing questions — never speaking over them.',
  },
  {
    title: 'Voice-Native Triage Line',
    body: '24/7 symptom triage in the patient’s language with red-flag escalation that breaks script and alerts the on-call doctor mid-turn.',
  },
  {
    title: 'Adherence Voice Loop',
    body: 'Automated dose-time calls for elderly & low-literacy patients, with pictogram cards for non-readers.',
  },
  {
    title: 'Zero-Internet Fallback',
    body: 'Degrades to DTMF IVR + SMS in the local script, plus a free missed-call-to-callback flow for rural reach.',
  },
  {
    title: 'Consult Intelligence',
    body: 'SOAP note, ICD-10/CPT codes, cited differentials, and a pre-filled insurance claim bundle — in seconds.',
  },
  {
    title: 'Mid-Call Language Switch',
    body: 'Hindi → English → Tamil with zero restart. The model mirrors the caller’s language from audio, no detection pass.',
  },
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-7xl px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-20 md:grid-cols-2">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-4 inline-block rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700"
          >
            Multilingual Voice AI · HIPAA-minded
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-5xl font-semibold leading-tight tracking-tight text-teal-900"
          >
            The clinical companion that listens, translates, and calls back.
          </motion.h1>
          <p className="mt-5 max-w-xl text-lg text-teal-700">
            Arya scribes consultations, triages patient calls in 12+ Indian languages,
            and reaches rural patients even without internet — with a voice round-trip
            under 800&nbsp;milliseconds.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="rounded-xl bg-teal-600 px-6 py-3 font-medium text-cream-50 shadow-lift transition-transform duration-200 hover:-translate-y-0.5"
            >
              Sign in with Google
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-white px-6 py-3 font-medium text-teal-800 shadow-card transition-transform duration-200 hover:-translate-y-0.5"
            >
              Get started
            </Link>
            <LatencyCounter />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative grid place-items-center rounded-3xl bg-gradient-to-br from-teal-800 to-teal-600 p-12 shadow-lift"
        >
          <div className="grid h-40 w-40 place-items-center rounded-full bg-cream-50/10">
            <div className="orb-pulse grid h-28 w-28 place-items-center rounded-full bg-cream-50/20">
              <Waveform bars={9} />
            </div>
          </div>
          <p className="mt-8 text-center text-cream-100/90">
            “नमस्ते, main Arya. How can I help you today?”
          </p>
        </motion.div>
      </section>

      {/* Features */}
      <section className="pb-24">
        <h2 className="mb-8 text-2xl font-semibold text-teal-900">Five things that make it real</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
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
