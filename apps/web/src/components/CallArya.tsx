'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVoiceRoom } from '@/lib/useVoiceRoom';

/**
 * Beautiful, modern voice-call UI for talking to Arya. A big call button that
 * expands into a full-screen call surface with an animated orb + waveform,
 * live timer, mute, and end-call — all in the teal theme.
 */
export function CallArya({ patientId, patientName }: { patientId: string; patientName: string }) {
  const { status, connect, disconnect } = useVoiceRoom('companion', { patientId, identity: patientName });
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const live = status === 'live';
  const connecting = status === 'connecting';

  useEffect(() => {
    if (!live) return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  async function start() {
    setOpen(true);
    await connect();
  }
  async function end() {
    await disconnect();
    setOpen(false);
    setMuted(false);
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <>
      {/* Trigger card */}
      <motion.button
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        onClick={start}
        className="relative grid w-full place-items-center gap-2 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 to-teal-500 py-9 text-cream-50 shadow-lift"
      >
        <span className="pointer-events-none absolute inset-0 opacity-20">
          <span className="absolute -left-6 top-4 h-24 w-24 rounded-full bg-cream-50/30 blur-2xl" />
          <span className="absolute right-2 bottom-0 h-28 w-28 rounded-full bg-teal-300/40 blur-2xl" />
        </span>
        <span className="text-4xl">📞</span>
        <span className="text-lg font-semibold">Call Arya</span>
        <span className="text-sm text-cream-100/85">Talk about your medicines, diet & appointments</span>
      </motion.button>

      {/* Full-screen call surface */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-teal-900/95 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="flex w-full max-w-sm flex-col items-center px-8 py-12 text-center text-cream-50"
            >
              <p className="text-sm uppercase tracking-widest text-teal-200">
                {connecting ? 'Connecting…' : live ? 'On call' : status === 'unconfigured' ? 'Demo mode' : 'Calling'}
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Arya</h2>
              <p className="mt-1 font-mono text-teal-200">{live ? mmss : '—'}</p>

              {/* Animated orb + waveform */}
              <div className="relative my-10 grid h-52 w-52 place-items-center">
                <motion.span
                  animate={{ scale: live && !muted ? [1, 1.12, 1] : 1, opacity: live ? 1 : 0.7 }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full bg-teal-400/20"
                />
                <motion.span
                  animate={{ scale: live && !muted ? [1, 1.22, 1] : 1 }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut', delay: 0.3 }}
                  className="absolute inset-4 rounded-full bg-teal-400/25"
                />
                <div className="relative grid h-28 w-28 place-items-center rounded-full bg-teal-400 shadow-lift">
                  <div className="flex items-end gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 rounded-full bg-teal-900"
                        animate={{ height: live && !muted ? [8, 26, 8] : 8 }}
                        transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.12, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {status === 'unconfigured' && (
                <p className="mb-4 max-w-xs text-sm text-amber-200">
                  Voice needs LiveKit keys. Everything else (chat, booking) works.
                </p>
              )}

              {/* Controls */}
              <div className="flex items-center gap-6">
                <ControlButton
                  label={muted ? 'Unmute' : 'Mute'}
                  active={muted}
                  onClick={() => setMuted((m) => !m)}
                  icon={muted ? '🔇' : '🎙️'}
                  disabled={!live}
                />
                <button
                  onClick={end}
                  className="grid h-16 w-16 place-items-center rounded-full bg-signal-red text-2xl shadow-lift transition-transform hover:scale-105"
                  aria-label="End call"
                >
                  📵
                </button>
                <ControlButton label="Speaker" active icon="🔊" onClick={() => {}} disabled={!live} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ControlButton({ label, icon, active, onClick, disabled }: {
  label: string; icon: string; active?: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`grid h-14 w-14 place-items-center rounded-full text-xl transition-colors disabled:opacity-40 ${
        active ? 'bg-cream-50/25' : 'bg-cream-50/10 hover:bg-cream-50/20'
      }`}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
