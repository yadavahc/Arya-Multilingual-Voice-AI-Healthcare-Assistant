'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LANGUAGES, useLang } from '@/lib/i18n';

export function LanguageSelector() {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-teal-800 shadow-card"
      >
        <span aria-hidden>🌐</span>
        <span>{current.native}</span>
        <span className="text-xs text-teal-400">▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute right-0 z-40 mt-2 w-40 overflow-hidden rounded-xl bg-white py-1 shadow-lift"
            >
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                    l.code === lang ? 'bg-teal-50 text-teal-800' : 'text-teal-700 hover:bg-cream-100'
                  }`}
                >
                  <span>{l.native}</span>
                  {l.code === lang && <span className="text-teal-500">✓</span>}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
