'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useVoiceRoom } from '@/lib/useVoiceRoom';
import { Waveform } from '@/components/Waveform';
import { LatencyCounter } from '@/components/LatencyCounter';

// Demo transcript that streams in — shows the mid-call language switch and the
// red-flag trigger. In production these turns arrive from the agent via the
// encounter's transcript stream.
const SCRIPT: { role: 'patient' | 'doctor'; text: string; lang: string }[] = [
  { role: 'patient', text: 'नमस्ते डॉक्टर, seene mein dard ho raha hai', lang: 'hi-en' },
  { role: 'doctor', text: 'Namaste. When did it start?', lang: 'en' },
  { role: 'patient', text: 'Since this morning. It goes to my left arm', lang: 'en' },
  { role: 'doctor', text: 'Any sweating or breathlessness?', lang: 'en' },
  { role: 'patient', text: 'हाँ, थोड़ा पसीना भी आ रहा है', lang: 'hi' },
];

const ENCOUNTER_ID = 'enc-1';

export default function Consult() {
  const { status, connect, disconnect } = useVoiceRoom('scribe');
  const [turns, setTurns] = useState<typeof SCRIPT>([]);
  const [gaps, setGaps] = useState<{ field: string; label: string }[]>([]);
  const [note, setNote] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  // Stream the demo transcript.
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i >= SCRIPT.length) return clearInterval(id);
      setTurns((t) => [...t, SCRIPT[i]]);
      i++;
    }, 1800);
    return () => clearInterval(id);
  }, []);

  // Surface gap cards once ~80% through.
  useEffect(() => {
    if (turns.length >= 4) {
      api
        .gaps(ENCOUNTER_ID, 0.85)
        .then((r) => setGaps(r.surface))
        .catch(() => {});
    }
  }, [turns.length]);

  const redFlag = useMemo(
    () => turns.some((t) => /left arm|seene|chest/i.test(t.text)),
    [turns],
  );

  async function generateNote() {
    setGenerating(true);
    try {
      const n = await api.generateNote(ENCOUNTER_ID, {
        encounterType: 'chest_pain',
        patientLanguage: 'hi',
      });
      setNote(n);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-teal-900">Live Consult</h1>
          <p className="text-sm text-teal-600">Encounter {ENCOUNTER_ID} · Dr. Meera Nair · Ramesh Kumar</p>
        </div>
        <div className="flex items-center gap-3">
          <LatencyCounter />
          {status === 'live' ? (
            <button onClick={disconnect} className="rounded-xl bg-signal-red px-4 py-2 text-sm font-medium text-white shadow-card">
              End voice
            </button>
          ) : (
            <button onClick={connect} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-cream-50 shadow-card">
              {status === 'connecting' ? 'Connecting…' : 'Join voice'}
            </button>
          )}
        </div>
      </div>

      {status === 'unconfigured' && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-card">
          LiveKit env not set — running in transcript-only demo mode. Add
          <code className="mx-1">LIVEKIT_URL</code> + keys to enable live audio.
        </div>
      )}

      {redFlag && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-signal-red shadow-lift"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-signal-red text-white">!</span>
          <div>
            <p className="font-semibold">Red flag: possible cardiac chest pain</p>
            <p className="text-sm text-red-700">Radiating to left arm + diaphoresis. On-call doctor alerted.</p>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Bilingual transcript */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="orb-pulse grid h-9 w-9 place-items-center rounded-full bg-teal-600">
              <Waveform bars={4} className="scale-75" />
            </div>
            <span className="text-sm font-medium text-teal-700">Listening…</span>
          </div>
          <div className="grid grid-cols-2 gap-4 border-b border-teal-100 pb-2 text-xs font-semibold uppercase tracking-wide text-teal-500">
            <span>Original</span>
            <span>English</span>
          </div>
          <div className="mt-3 space-y-3">
            <AnimatePresence>
              {turns.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className={`rounded-xl p-3 text-sm ${t.role === 'doctor' ? 'bg-teal-50' : 'bg-cream-100'}`}>
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-teal-500">
                      {t.role} · {t.lang}
                    </span>
                    {t.text}
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-teal-800 shadow-card">
                    {t.text /* translation layer would replace this */}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={generateNote}
              disabled={generating}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-cream-50 shadow-card disabled:opacity-60"
            >
              {generating ? 'Generating…' : 'Generate Note'}
            </button>
            {note && (
              <a href={`/notes/${ENCOUNTER_ID}`} className="text-sm font-medium text-teal-700 underline">
                View SOAP note →
              </a>
            )}
          </div>
        </div>

        {/* Ambient gap cards */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-500">Arya Nudge</h3>
          <AnimatePresence>
            {gaps.length === 0 && (
              <p className="text-sm text-teal-500">No gaps yet — checklist on track.</p>
            )}
            {gaps.map((g) => (
              <motion.div
                key={g.field}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border-l-4 border-signal-amber bg-white p-4 shadow-card"
              >
                <p className="text-xs font-semibold uppercase text-signal-amber">Not yet asked</p>
                <p className="mt-1 text-sm text-teal-800">{g.label}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
