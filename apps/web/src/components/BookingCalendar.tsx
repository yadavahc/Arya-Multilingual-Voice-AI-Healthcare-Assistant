'use client';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Patient-facing scheduling calendar. Shows the doctor's real open slots and
 * books into the same calendar the doctor sees. */
export function BookingCalendar({ patientId, doctorId }: { patientId: string; doctorId: string }) {
  const qc = useQueryClient();
  const days = useMemo(() => {
    const out: { date: string; label: string; dow: string }[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        dow: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      });
    }
    return out;
  }, []);

  const [date, setDate] = useState(days[0].date);
  const [reason, setReason] = useState('Follow-up consultation');
  const [booked, setBooked] = useState<{ date: string; time: string } | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['slots', doctorId, date],
    queryFn: () => api.slots(doctorId, date),
    enabled: !!doctorId,
  });
  const slots = data?.slots ?? [];

  async function book(time: string) {
    try {
      await api.bookAppointment({ patientId, doctorId, date, time, reason });
      setBooked({ date, time });
      qc.invalidateQueries({ queryKey: ['slots', doctorId, date] });
      qc.invalidateQueries({ queryKey: ['patient-context', patientId] });
    } catch {
      // slot taken — refresh
      qc.invalidateQueries({ queryKey: ['slots', doctorId, date] });
    }
  }

  return (
    <section className="mt-6 rounded-3xl bg-white p-5 shadow-card">
      <h2 className="text-lg font-semibold text-teal-900">Book an appointment</h2>
      <p className="text-sm text-teal-600">Pick a day, then an open time with your doctor.</p>

      {/* Day strip */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => (
          <button
            key={d.date}
            onClick={() => { setDate(d.date); setBooked(null); }}
            className={`min-w-[64px] rounded-xl px-3 py-2 text-center transition-colors ${
              date === d.date ? 'bg-teal-600 text-cream-50' : 'bg-cream-100 text-teal-800'
            }`}
          >
            <div className="text-xs opacity-80">{d.dow}</div>
            <div className="text-sm font-medium">{d.label}</div>
          </button>
        ))}
      </div>

      {/* Slots */}
      <div className="mt-4 min-h-[52px]">
        {isFetching ? (
          <p className="text-sm text-teal-500">Checking availability…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-teal-500">No open slots that day — try another.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {slots.map((t) => (
                <motion.button
                  key={t}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -2 }}
                  onClick={() => book(t)}
                  className="rounded-xl bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
                >
                  {t}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {booked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-xl bg-signal-green/10 px-4 py-3 text-sm text-green-800"
          >
            ✓ Booked for {booked.date} at {booked.time}. Your doctor can see it now.
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-3 text-xs text-teal-500">
        Tip: you can also just tell Arya “book me for next Monday morning” on a call.
      </p>
    </section>
  );
}
