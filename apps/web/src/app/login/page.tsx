'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@/components/GoogleLogin';

export default function LoginPortal() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl bg-white p-8 shadow-lift"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-teal-600 text-2xl font-semibold text-cream-50">
            A
          </div>
          <h1 className="text-2xl font-semibold text-teal-900">Welcome to Arya</h1>
          <p className="mt-1 text-sm text-teal-600">
            Sign in — patients talk to Arya, clinicians manage care.
          </p>
        </div>

        <GoogleLogin />

        <div className="my-6 flex items-center gap-3 text-xs text-teal-400">
          <span className="h-px flex-1 bg-teal-100" />
          or use the demo phone login
          <span className="h-px flex-1 bg-teal-100" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/login/patient"
            className="rounded-xl bg-cream-100 py-3 text-center text-sm font-medium text-teal-800"
          >
            🙋 Patient
          </Link>
          <Link
            href="/login/doctor"
            className="rounded-xl bg-cream-100 py-3 text-center text-sm font-medium text-teal-800"
          >
            🩺 Clinician
          </Link>
        </div>
      </motion.div>

      <p className="mt-4 text-center text-xs text-teal-500">
        Demo: patient <b>8904030441</b> · doctor <b>9481479268</b> · code <b>123456</b>
      </p>
    </div>
  );
}
