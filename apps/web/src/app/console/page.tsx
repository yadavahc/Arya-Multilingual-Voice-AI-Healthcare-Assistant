'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const TRIAGE_STYLE: Record<string, string> = {
  emergency: 'bg-red-50 border-signal-red text-signal-red',
  urgent: 'bg-amber-50 border-signal-amber text-signal-amber',
  routine: 'bg-teal-50 border-teal-400 text-teal-700',
};

export default function Console() {
  const { data: callsData } = useQuery({ queryKey: ['calls'], queryFn: () => api.calls() });
  const { data: alertsData } = useQuery({ queryKey: ['alerts'], queryFn: () => api.alerts() });

  const calls = callsData?.calls || [];
  const alerts = alertsData?.alerts || [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-teal-900">Call Console</h1>
      <p className="text-sm text-teal-600">Live inbound & outbound calls · triage severity</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {calls.map((c: any) => (
            <div
              key={c.id}
              className={`flex items-center justify-between rounded-xl border-l-4 bg-white p-4 shadow-card ${
                TRIAGE_STYLE[c.triageLevel] || ''
              }`}
            >
              <div>
                <p className="font-medium text-teal-900">
                  {c.direction === 'inbound' ? '↓ Inbound' : '↑ Outbound'} · {c.fromNumber}
                </p>
                <p className="text-xs text-teal-500">
                  p50 {c.latencyMetrics?.p50 ?? '—'}ms · p95 {c.latencyMetrics?.p95 ?? '—'}ms
                </p>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase">
                {c.triageLevel}
              </span>
            </div>
          ))}
          {calls.length === 0 && <p className="text-sm text-teal-500">No calls yet.</p>}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-500">Escalations</h3>
          {alerts.map((a: any) => (
            <div key={a.id} className="rounded-xl border-l-4 border-signal-red bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase text-signal-red">{a.severity}</p>
              <p className="mt-1 font-medium text-teal-900">{a.title}</p>
              <p className="mt-1 text-sm text-teal-700">{a.body}</p>
              <button className="mt-3 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-cream-50">
                One-tap dial-back
              </button>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm text-teal-500">No escalations.</p>}
        </div>
      </div>
    </div>
  );
}
