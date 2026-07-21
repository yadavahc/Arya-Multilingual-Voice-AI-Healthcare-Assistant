'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function CallReviewPage() {
  return (
    <RequireRole allow={['doctor', 'admin']}>
      <CallReview />
    </RequireRole>
  );
}

function CallReview() {
  const user = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['doctor-calls', user.uid], queryFn: () => api.doctorCalls(user.uid) });
  const calls = data?.calls ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/doctor" className="text-sm text-teal-600">← Dashboard</Link>
      <h1 className="mt-2 text-2xl font-semibold text-teal-900">Call & chat reviews</h1>
      <p className="text-sm text-teal-600">Every Arya conversation — summary, transcript, insights, and your feedback.</p>

      <div className="mt-6 space-y-3">
        {calls.map((c: any, i: number) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="rounded-2xl bg-white p-4 shadow-card"
          >
            <button className="flex w-full items-center justify-between text-left" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs capitalize text-teal-700">{c.channel} · {c.language}</span>
                  {c.insights?.redFlag && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-signal-red">red flag</span>}
                  {c.feedback && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.feedback.handledCorrectly ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {c.feedback.handledCorrectly ? '✓ reviewed' : '⚠ flagged'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-teal-900">{c.summary || 'Tap to generate insights…'}</p>
                <p className="text-xs text-teal-500">
                  {(c.startedAt || '').slice(0, 16).replace('T', ' ')}
                  {c.durationSeconds ? ` · ${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : ''}
                </p>
              </div>
              <span className="text-teal-400">{openId === c.id ? '▲' : '▼'}</span>
            </button>

            <AnimatePresence>
              {openId === c.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <CallDetail conv={c} onChange={() => qc.invalidateQueries({ queryKey: ['doctor-calls', user.uid] })} reviewer={user.uid} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
        {calls.length === 0 && <p className="text-sm text-teal-500">No conversations yet.</p>}
      </div>
    </div>
  );
}

function CallDetail({ conv, onChange, reviewer }: { conv: any; onChange: () => void; reviewer: string }) {
  const [correct, setCorrect] = useState<boolean | null>(conv.feedback?.handledCorrectly ?? null);
  const [rating, setRating] = useState<number>(conv.feedback?.rating ?? 0);
  const [notes, setNotes] = useState<string>(conv.feedback?.notes ?? '');
  const [saved, setSaved] = useState(false);
  const ins = conv.insights;

  async function generate() {
    await api.finalizeConversation(conv.id);
    onChange();
  }
  async function submit() {
    if (correct === null) return;
    await api.conversationFeedback(conv.id, { handledCorrectly: correct, rating, notes, reviewedBy: reviewer });
    setSaved(true);
    onChange();
  }

  return (
    <div className="mt-4 border-t border-teal-50 pt-4">
      {!ins && (
        <button onClick={generate} className="mb-3 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-cream-50">
          Generate AI insights
        </button>
      )}
      {ins && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <Insight label="Topics" value={(ins.topics || []).join(', ') || '—'} />
          <Insight label="Actions taken" value={(ins.actionsTaken || []).join(', ') || '—'} />
          <Insight label="Follow-up needed" value={ins.followUpNeeded ? 'Yes' : 'No'} />
          <Insight label="Handled well" value={ins.handledWell ? 'Yes' : 'Review'} />
          {(ins.possibleIssues || []).length > 0 && (
            <div className="sm:col-span-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              <b>Possible issues:</b> {(ins.possibleIssues || []).join('; ')}
            </div>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="mb-4 max-h-52 space-y-1 overflow-y-auto rounded-xl bg-cream-100 p-3">
        {(conv.turns || []).map((t: any, i: number) => (
          <p key={i} className={`text-sm ${t.role === 'arya' ? 'text-teal-700' : 'text-teal-900'}`}>
            <b className="capitalize">{t.role}:</b> {t.text}
          </p>
        ))}
      </div>

      {/* Feedback */}
      <div className="rounded-xl border border-teal-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-teal-500">Did Arya respond correctly?</p>
        <div className="flex gap-2">
          <button onClick={() => setCorrect(true)} className={`rounded-lg px-3 py-1.5 text-sm ${correct === true ? 'bg-green-600 text-white' : 'bg-cream-100 text-teal-800'}`}>👍 Yes</button>
          <button onClick={() => setCorrect(false)} className={`rounded-lg px-3 py-1.5 text-sm ${correct === false ? 'bg-signal-red text-white' : 'bg-cream-100 text-teal-800'}`}>👎 Needs fixing</button>
          <div className="ml-auto flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className={n <= rating ? 'text-signal-amber' : 'text-teal-200'}>★</button>
            ))}
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes to improve Arya (what was missed or wrong)…"
          className="mt-2 w-full rounded-lg border border-teal-100 bg-cream-50 p-2 text-sm text-teal-900 outline-none focus:border-teal-400"
          rows={2}
        />
        <button onClick={submit} disabled={correct === null} className="mt-2 rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-cream-50 disabled:opacity-50">
          {saved ? '✓ Saved' : 'Save feedback'}
        </button>
      </div>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-cream-100 p-2">
      <p className="text-[10px] font-semibold uppercase text-teal-500">{label}</p>
      <p className="text-sm text-teal-900">{value}</p>
    </div>
  );
}
