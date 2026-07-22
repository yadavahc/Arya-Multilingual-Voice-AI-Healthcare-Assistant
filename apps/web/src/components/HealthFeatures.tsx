'use client';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** The four AI health tools on the patient dashboard. */
export function HealthFeatures({ patientId }: { patientId: string }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-teal-900">AI health tools</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <MedicineScan patientId={patientId} />
        <SymptomChecker patientId={patientId} />
        <DietPlan patientId={patientId} />
        <HealthWatch patientId={patientId} />
      </div>
    </section>
  );
}

function Card({ icon, title, subtitle, children }: { icon: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="flex flex-col rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-xl">{icon}</span>
        <div>
          <h3 className="font-semibold text-teal-900">{title}</h3>
          <p className="text-xs text-teal-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </motion.div>
  );
}

// ── 1. Medicine verification ────────────────────────────────────────────
function MedicineScan({ patientId }: { patientId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  async function scan(file: File) {
    setBusy(true); setRes(null);
    try { setRes(await api.verifyMedicine(patientId, file)); }
    catch { setRes({ error: true }); }
    finally { setBusy(false); }
  }
  const m = res?.medicine;
  return (
    <Card icon="💊" title="Scan a medicine" subtitle="Verify a strip against your prescription">
      <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-cream-50">
        {busy ? 'Reading…' : '📷 Upload medicine photo'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
      <AnimatePresence>
        {res && !res.error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-1 text-sm">
            {m?.name ? (
              <>
                <p className="font-medium text-teal-900">{m.name} {m.strength}</p>
                <p className="text-teal-600">{m.purpose}</p>
                <p className="text-xs text-teal-500">Take: {m.howToTake} · Exp: {m.expiryText || '—'}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge ok={res.matchesPrescription} okText="On your prescription" noText="Not on prescription" />
                  {res.expired === true && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-signal-red">Expired</span>}
                  {res.possibleDuplicate && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Possible duplicate</span>}
                </div>
                {res.warnings?.map((w: string, i: number) => <p key={i} className="text-xs text-signal-red">⚠ {w}</p>)}
              </>
            ) : <p className="text-sm text-teal-500">Couldn't read the strip — try a clearer photo.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function Badge({ ok, okText, noText }: { ok: boolean; okText: string; noText: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? 'bg-green-50 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{ok ? `✓ ${okText}` : noText}</span>;
}

// ── 2. Symptom / condition checker ──────────────────────────────────────
function SymptomChecker({ patientId }: { patientId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  async function check(file: File) {
    setBusy(true); setRes(null);
    try { setRes(await api.detectCondition(patientId, file)); }
    catch { setRes({ error: true }); }
    finally { setBusy(false); }
  }
  const urgencyColor = res?.urgency === 'urgent' ? 'text-signal-red' : res?.urgency === 'see_doctor_soon' ? 'text-signal-amber' : 'text-teal-600';
  return (
    <Card icon="🩹" title="Symptom checker" subtitle="Photo of a rash, burn, eye, swelling…">
      <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-cream-50">
        {busy ? 'Analyzing…' : '📷 Upload a photo'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && check(e.target.files[0])} />
      <AnimatePresence>
        {res && !res.error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-1 text-sm">
            <p className="text-teal-900">{res.observation}</p>
            {res.possibleConditions?.length > 0 && (
              <p className="text-teal-600">Possibly: {res.possibleConditions.slice(0, 3).join(', ')}</p>
            )}
            <p className={`font-medium capitalize ${urgencyColor}`}>{(res.urgency || '').replace(/_/g, ' ')}</p>
            {res.advice && <p className="text-xs text-teal-600">{res.advice}</p>}
            <p className="pt-1 text-[11px] italic text-teal-400">{res.disclaimer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── 3. Diet plan ────────────────────────────────────────────────────────
function DietPlan({ patientId }: { patientId: string }) {
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  async function gen() {
    setBusy(true);
    try { setPlan((await api.dietPlan(patientId)).plan); } finally { setBusy(false); }
  }
  return (
    <Card icon="🥗" title="Personalized diet" subtitle="Tailored to your conditions & reports">
      {!plan ? (
        <button onClick={gen} className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-cream-50">
          {busy ? 'Generating…' : 'Generate my diet plan'}
        </button>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 text-sm">
          <div className="mb-2 flex gap-2 text-xs">
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-700">{plan.calorieTarget} kcal</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-700">{plan.proteinTarget} g protein</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-700">💧 {plan.waterLitres} L</span>
          </div>
          <Meal label="Breakfast" v={plan.breakfast} />
          <Meal label="Lunch" v={plan.lunch} />
          <Meal label="Dinner" v={plan.dinner} />
          {plan.avoid?.length > 0 && <p className="text-xs text-signal-red">Avoid: {plan.avoid.join(', ')}</p>}
        </motion.div>
      )}
    </Card>
  );
}
function Meal({ label, v }: { label: string; v: string }) {
  return <p className="text-teal-900"><b className="text-teal-500">{label}:</b> {v}</p>;
}

// ── 4. Wearable / health watch ──────────────────────────────────────────
function HealthWatch({ patientId }: { patientId: string }) {
  const { data } = useQuery({ queryKey: ['wearables', patientId], queryFn: () => api.wearables(patientId) });
  const m = data?.metrics ?? {};
  const a = data?.analysis ?? { alerts: [], status: 'good' };
  const statusColor = a.status === 'attention' ? 'text-signal-red' : a.status === 'review' ? 'text-signal-amber' : 'text-green-600';
  return (
    <Card icon="⌚" title="Health watch" subtitle="Synced from Google Fit / Fire-Boltt">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Metric label="Steps" v={m.steps ?? '—'} />
        <Metric label="Resting HR" v={m.restingHeartRate ? `${m.restingHeartRate} bpm` : '—'} />
        <Metric label="SpO₂" v={m.spo2 ? `${m.spo2}%` : '—'} warn={m.spo2 && m.spo2 < 94} />
        <Metric label="Sleep" v={m.sleepHours ? `${m.sleepHours} h` : '—'} />
      </div>
      <p className={`mt-2 text-sm font-medium capitalize ${statusColor}`}>Status: {a.status}</p>
      {a.alerts?.map((x: any, i: number) => <p key={i} className="text-xs text-signal-red">⚠ {x.message}</p>)}
      {data?.metrics && Object.keys(m).length === 0 && (
        <p className="mt-2 text-xs text-teal-500">Connect Google Fit to sync your watch data.</p>
      )}
    </Card>
  );
}
function Metric({ label, v, warn }: { label: string; v: any; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${warn ? 'bg-red-50' : 'bg-cream-100'}`}>
      <p className="text-[10px] uppercase text-teal-500">{label}</p>
      <p className={`font-semibold ${warn ? 'text-signal-red' : 'text-teal-900'}`}>{v}</p>
    </div>
  );
}
