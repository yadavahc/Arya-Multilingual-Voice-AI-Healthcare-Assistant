'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { RequireRole } from '@/components/RequireRole';
import { BookingCalendar } from '@/components/BookingCalendar';
import { useVoiceRoom } from '@/lib/useVoiceRoom';
import { useAuth } from '@/lib/auth';
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
  const patientId = user.patientId || 'pat-1';
  const { status, connect, disconnect } = useVoiceRoom('companion', {
    patientId,
    identity: user.displayName,
  });

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
  const lang = patient.preferredLanguage || 'en';

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold text-teal-900">Namaste, {user.displayName}</h1>
        <p className="mt-1 text-lg text-teal-600">Arya is here whenever you need her.</p>
      </motion.div>

      {/* Call your doctor → Arya answers */}
      <motion.button
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        onClick={status === 'live' ? disconnect : connect}
        className={`mt-6 grid w-full place-items-center gap-2 rounded-3xl py-8 text-cream-50 shadow-lift ${
          status === 'live' ? 'bg-signal-red' : 'bg-teal-600'
        }`}
      >
        <motion.span
          animate={{ scale: status === 'live' ? [1, 1.12, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="text-5xl"
        >
          {status === 'live' ? '⏹' : '📞'}
        </motion.span>
        <span className="text-lg font-medium">
          {status === 'live' ? 'On call with Arya — tap to end' : 'Call your doctor'}
        </span>
        <span className="text-sm text-cream-100/80">
          {status === 'connecting' ? 'Connecting…' : 'Arya answers first, in your language'}
        </span>
      </motion.button>
      {status === 'unconfigured' && (
        <p className="mt-2 text-center text-xs text-amber-700">
          Voice needs LiveKit keys. Meanwhile, chat with Arya below — same brain, real answers.
        </p>
      )}

      {/* Chat with Arya */}
      <AryaChat patientId={patientId} language={lang} />

      {/* Scheduling calendar linked to the doctor */}
      <BookingCalendar patientId={patientId} doctorId={doctorId} />

      {/* Medicines */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-teal-900">Your medicines</h2>
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
          <h2 className="text-lg font-semibold text-teal-900">Next appointment</h2>
          <p className="mt-1 text-2xl font-semibold text-teal-800">
            {nextAppt.date} · {nextAppt.time}
          </p>
          <p className="text-teal-600">{nextAppt.reason}</p>
        </motion.section>
      )}
    </div>
  );
}

function AryaChat({ patientId, language }: { patientId: string; language: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<string>(`conv-${Date.now()}`);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await api.aryaChat(patientId, next, {
        sessionId: sessionRef.current,
        language,
        channel: 'chat',
      });
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Sorry, I could not reach the clinic just now.' }]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = [
    'When do I take my BP tablet?',
    'What should I eat?',
    'Book my next appointment',
  ];

  return (
    <section className="mt-6 rounded-3xl bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-600 text-cream-50">A</span>
        <span className="font-medium text-teal-900">Chat with Arya</span>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full bg-cream-100 px-3 py-1.5 text-sm text-teal-700">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
              m.role === 'user' ? 'ml-auto bg-teal-600 text-cream-50' : 'bg-cream-100 text-teal-900'
            }`}
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
          placeholder="Ask about medicines, diet, appointments…"
          className="flex-1 rounded-xl border border-teal-100 bg-cream-50 px-4 py-2.5 text-teal-900 outline-none focus:border-teal-400"
        />
        <button onClick={() => send()} disabled={busy} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-cream-50 disabled:opacity-60">
          Send
        </button>
      </div>
    </section>
  );
}
