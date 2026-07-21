'use client';
import { use } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { RequireRole } from '@/components/RequireRole';
import { api } from '@/lib/api';

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireRole allow={['doctor', 'admin']}>
      <Detail id={id} />
    </RequireRole>
  );
}

function Detail({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ['patient-detail', id], queryFn: () => api.patientDetail(id) });
  if (!data) return <div className="px-6 py-16 text-center text-teal-500">Loading…</div>;

  const p = data.context?.patient ?? {};
  const rx = data.context?.prescriptions?.[0];
  const care = data.context?.carePlan;
  const encounters = data.context?.encounters ?? [];
  const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/doctor" className="text-sm text-teal-600">← All patients</Link>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-card"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-xl font-semibold text-teal-700">
          {(p.name || '?').slice(0, 1)}
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-teal-900">{p.name}</h1>
          <p className="text-sm text-teal-600">
            {[p.sex, age && `${age} yrs`, p.bloodGroup].filter(Boolean).join(' · ')} · {p.phone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(p.conditions || []).map((c: string) => (
            <span key={c} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">{c}</span>
          ))}
          {(p.allergies || []).map((a: string) => (
            <span key={a} className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-signal-red">Allergy: {a}</span>
          ))}
        </div>
      </motion.div>

      {p.vitals && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['BP', p.vitals.bp], ['Pulse', p.vitals.pulse], ['Weight', p.vitals.weightKg && `${p.vitals.weightKg} kg`], ['HbA1c', p.vitals.hba1c],
          ].filter(([, v]) => v).map(([k, v], i) => (
            <motion.div key={k as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl bg-white p-3 text-center shadow-card">
              <p className="text-xs text-teal-500">{k}</p>
              <p className="text-lg font-semibold text-teal-900">{v}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Prescription */}
        {rx && (
          <Section title="Prescription">
            <p className="text-xs text-teal-500">{rx.doctorName} · issued {rx.issuedAt}</p>
            <p className="mt-1 text-sm font-medium text-teal-800">{rx.diagnosis}</p>
            <div className="mt-3 space-y-2">
              {rx.drugs.map((d: any, i: number) => (
                <div key={i} className="rounded-xl bg-cream-100 p-3">
                  <p className="font-medium text-teal-900">
                    {d.name} {d.strength} <span className="text-teal-500">· {d.form}</span>
                  </p>
                  <p className="text-sm text-teal-700">{d.frequency} — {d.timing} · {d.durationDays} days</p>
                  <p className="text-xs text-teal-500">{d.instructions}</p>
                </div>
              ))}
            </div>
            {rx.advice && <p className="mt-3 text-sm text-teal-700"><b>Advice:</b> {rx.advice}</p>}
            {rx.followUp && <p className="text-sm text-teal-700"><b>Follow-up:</b> {rx.followUp}</p>}
          </Section>
        )}

        {/* Conversations with Arya */}
        <Section title={`Conversations with Arya (${data.conversations.length})`}>
          <div className="space-y-4">
            {data.conversations.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-teal-50 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-teal-500">
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 capitalize text-teal-700">{c.channel} · {c.language}</span>
                  <span>{(c.startedAt || '').slice(0, 16).replace('T', ' ')}</span>
                </div>
                {c.summary && <p className="mb-2 text-sm italic text-teal-600">“{c.summary}”</p>}
                <div className="space-y-1">
                  {(c.turns || []).map((t: any, i: number) => (
                    <p key={i} className={`text-sm ${t.role === 'arya' ? 'text-teal-700' : 'text-teal-900'}`}>
                      <b className="capitalize">{t.role}:</b> {t.text}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {data.conversations.length === 0 && <p className="text-sm text-teal-500">No conversations yet.</p>}
          </div>
        </Section>

        {/* Appointments */}
        <Section title="Appointments">
          <div className="space-y-2">
            {data.appointments.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-cream-100 p-3 text-sm">
                <span className="text-teal-900">{a.date} · {a.time}</span>
                <span className="text-teal-500">{a.reason}</span>
              </div>
            ))}
            {data.appointments.length === 0 && <p className="text-sm text-teal-500">None scheduled.</p>}
          </div>
        </Section>

        {/* History + care plan */}
        <Section title="History & care plan">
          {encounters.map((e: any) => (
            <div key={e.id} className="mb-2 rounded-xl bg-cream-100 p-3">
              <p className="text-xs text-teal-500">{(e.startedAt || '').slice(0, 10)} · {e.encounterType}</p>
              <p className="text-sm text-teal-800">{e.summary}</p>
            </div>
          ))}
          {care && (
            <div className="mt-2 space-y-1 text-sm text-teal-700">
              <p><b>Diet:</b> {care.diet}</p>
              <p><b>Rest:</b> {care.rest}</p>
              <p><b>Follow-up:</b> {care.followUp}</p>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl bg-white p-5 shadow-card"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-500">{title}</h2>
      {children}
    </motion.div>
  );
}
