'use client';
import { useEffect, useState } from 'react';

/**
 * Live latency counter — social proof. Animates around a sub-800ms p50 target.
 * In a real call this is fed by per-turn `time_to_first_audio_byte` from the
 * agent (via Redis/API); here it simulates realistic jitter for the hero/demo.
 */
export function LatencyCounter({ live }: { live?: number | null }) {
  const [ms, setMs] = useState(live ?? 640);

  useEffect(() => {
    if (live != null) {
      setMs(live);
      return;
    }
    const id = setInterval(() => {
      setMs(560 + Math.round(Math.random() * 220));
    }, 1400);
    return () => clearInterval(id);
  }, [live]);

  const good = ms < 800;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-card">
      <span
        className={`h-2.5 w-2.5 rounded-full ${good ? 'bg-signal-green' : 'bg-signal-amber'} orb-pulse`}
      />
      <span className="font-mono text-2xl font-semibold tabular-nums text-teal-800">
        {ms}
        <span className="ml-0.5 text-sm text-teal-500">ms</span>
      </span>
      <span className="text-xs text-teal-600">voice round-trip</span>
    </div>
  );
}
