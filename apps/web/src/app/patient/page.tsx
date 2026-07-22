'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireRole } from '@/components/RequireRole';
import { BookingCalendar } from '@/components/BookingCalendar';
import { CallArya } from '@/components/CallArya';
import { HealthFeatures } from '@/components/HealthFeatures';
import { useAuth } from '@/lib/auth';
import { useLang, useT } from '@/lib/i18n';
import { api, type ChatMessage } from '@/lib/api';

export default function PatientPage() {
  return (
    <RequireRole allow={['patient']}>
      <PatientCare />
    </RequireRole>
  );
}

function PatientCare() {
  const user = useAuth((s) => s.user)!;
  const t = useT();
  const patientId = user.patientId || 'pat-1';

  const { data } = useQuery({
    queryKey: ['patient-context', patientId],
    queryFn: () => api.patientContext(patientId),
  });
  const ctx = data?.context;
  const patient = ctx?.patient ?? {};
  const doctorId = patient.primaryDoctorId || 'doc-1';
  const rx = ctx?.prescriptions?.[0];
  const meds = rx?.drugs ?? [];
  const schedule = rx?.schedule ?? [];
  const nextAppt = ctx?.appointments?.[0];

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold text-teal-900">{t('patient.greeting')}, {user.displayName}</h1>
        <p className="mt-1 text-lg text-teal-600">{t('patient.subtitle')}</p>
      </motion.div>

      <div className="mt-6">
        <CallArya patientId={patientId} patientName={user.displayName} />
      </div>

      <AryaChat patientId={patientId} />

      <HealthFeatures patientId={patientId} />

      <BookingCalendar patientId={patientId} doctorId={doctorId} />

      <DocumentHistory patientId={patientId} />

      <ChatHistory patientId={patientId} />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-teal-900">{t('patient.medicines')}</h2>
        <div className="mt-3 space-y-3">
          {meds.map((m: any, i: number) => {
            const slot = schedule.find((s: any) => (s.drug || '').includes(m.name));
            const icon = slot?.timeOfDay === 'night' ? '🌙' : slot?.timeOfDay === 'afternoon' ? '🍽️' : '☀️';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card"
              >
                <span className="text-4xl">{icon}</span>
                <div className="flex-1">
                  <p className="text-lg font-medium text-teal-900">{m.name} {m.strength || m.dose}</p>
                  <p className="text-teal-600">{m.frequency}{m.timing ? ` · ${m.timing}` : ''}</p>
                </div>
              </motion.div>
            );
          })}
          {meds.length === 0 && <p className="text-sm text-teal-500">No active medicines on file.</p>}
        </div>
      </section>

      {nextAppt && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 rounded-2xl bg-teal-50 p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-teal-900">{t('patient.nextAppt')}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              nextAppt.status === 'confirmed' ? 'bg-signal-green/15 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {nextAppt.status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending confirmation'}
            </span>
          </div>
          <p className="mt-1 text-2xl font-semibold text-teal-800">{nextAppt.date} · {nextAppt.time}</p>
          <p className="text-teal-600">{nextAppt.reason}</p>
        </motion.section>
      )}
    </div>
  );
}

function DocumentHistory({ patientId }: { patientId: string }) {
  const t = useT();
  const { data } = useQuery({ queryKey: ['documents', patientId], queryFn: () => api.listDocuments(patientId) });
  const docs = data?.documents ?? [];
  if (docs.length === 0) return null;
  const icon = (type: string) => (type === 'prescription' ? '💊' : type === 'lab_report' ? '🧪' : '📄');
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-teal-900">{t('patient.documents')}</h2>
      <div className="mt-3 space-y-2">
        {docs.map((d: any, i: number) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card"
          >
            <span className="text-2xl">{icon(d.type)}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-teal-900">{d.filename}</p>
              <p className="text-xs text-teal-500 capitalize">{(d.type || 'document').replace('_', ' ')} · {(d.uploadedAt || '').slice(0, 10)}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ChatHistory({ patientId }: { patientId: string }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['conversations', patientId], queryFn: () => api.conversations(patientId) });
  const convs = (data?.conversations ?? []).filter((c: any) => (c.turns || []).length > 0);
  if (convs.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-teal-900">{t('patient.history')}</h2>
      <div className="mt-3 space-y-2">
        {convs.map((c: any) => (
          <div key={c.id} className="rounded-xl bg-white p-3 shadow-card">
            <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
              <div>
                <p className="text-sm text-teal-900">{c.summary || `${c.channel} conversation`}</p>
                <p className="text-xs text-teal-500 capitalize">{c.channel} · {(c.startedAt || '').slice(0, 16).replace('T', ' ')}</p>
              </div>
              <span className="text-teal-400">{open === c.id ? '▲' : '▼'}</span>
            </button>
            {open === c.id && (
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg bg-cream-100 p-3">
                {(c.turns || []).map((turn: any, i: number) => (
                  <p key={i} className={`text-sm ${turn.role === 'arya' ? 'text-teal-700' : 'text-teal-900'}`}>
                    <b className="capitalize">{turn.role}:</b> {turn.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AryaChat({ patientId }: { patientId: string }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [docName, setDocName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const sessionRef = useRef<string>(`conv-${Date.now()}`);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getDocument(patientId).then((d) => d.hasDocument && setDocName(d.filename || 'document')).catch(() => {});
  }, [patientId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await api.aryaChat(patientId, next, { sessionId: sessionRef.current, language: lang, channel: 'chat' });
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Sorry, I could not reach the clinic just now.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const r = await api.uploadDocument(patientId, file);
      setDocName(r.filename);
      qc.invalidateQueries({ queryKey: ['documents', patientId] });
      setMessages((m) => [...m, { role: 'assistant', content: `📄 I've read "${r.filename}". Ask me anything about it.` }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I could not read that file.' }]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-600 text-cream-50">A</span>
          <span className="font-medium text-teal-900">{t('patient.chat')}</span>
        </div>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-cream-100 px-3 py-1.5 text-xs font-medium text-teal-700">
          {uploading ? 'Reading…' : docName ? `📄 ${docName.slice(0, 14)}…` : `📎 ${t('patient.upload')}`}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.jpg,.png" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-teal-600 text-cream-50' : 'bg-cream-100 text-teal-900'}`}
          >
            {m.content}
          </motion.div>
        ))}
        {busy && <div className="w-16 rounded-2xl bg-cream-100 px-4 py-2 text-sm text-teal-500">…</div>}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={t('patient.ask')}
          className="flex-1 rounded-xl border border-teal-100 bg-cream-50 px-4 py-2.5 text-teal-900 outline-none focus:border-teal-400"
        />
        <button onClick={() => send()} disabled={busy} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-cream-50 disabled:opacity-60">{t('common.send')}</button>
      </div>
    </section>
  );
}
