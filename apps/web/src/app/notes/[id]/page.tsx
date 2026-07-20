'use client';
import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const SECTIONS: [keyof any, string][] = [
  ['subjective', 'Subjective'],
  ['objective', 'Objective'],
  ['assessment', 'Assessment'],
  ['plan', 'Plan'],
];

export default function NoteReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [note, setNote] = useState<any>(null);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    api
      .generateNote(id, { encounterType: 'chest_pain', patientLanguage: 'hi' })
      .then(setNote)
      .catch(() => {});
  }, [id]);

  if (!note) return <div className="mx-auto max-w-4xl px-6 py-16 text-teal-600">Generating note…</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-teal-900">Note Review</h1>
          <p className="text-sm text-teal-600">Encounter {id}</p>
        </div>
        <button
          onClick={() => setSigned(true)}
          disabled={signed}
          className={`rounded-xl px-5 py-2.5 text-sm font-medium shadow-card ${
            signed ? 'bg-signal-green text-white' : 'bg-teal-600 text-cream-50'
          }`}
        >
          {signed ? '✓ Signed off' : 'Sign off'}
        </button>
      </div>

      <div className="space-y-4">
        {SECTIONS.map(([key, label]) => (
          <div key={label as string} className="rounded-2xl bg-white p-5 shadow-card">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-500">{label}</h3>
            <p
              contentEditable={!signed}
              suppressContentEditableWarning
              className="text-sm leading-relaxed text-teal-900 outline-none focus:bg-cream-100 focus:rounded-lg focus:p-2"
            >
              {note.soap?.[key] || '—'}
            </p>
          </div>
        ))}

        <div className="grid gap-4 md:grid-cols-2">
          <CodeChips title="ICD-10" items={note.icd10} />
          <CodeChips title="CPT" items={note.cpt} />
        </div>

        {note.differentials?.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-500">
              Differentials (cited)
            </h3>
            <ul className="space-y-2 text-sm text-teal-800">
              {note.differentials.map((d: any, i: number) => (
                <li key={i}>
                  <span className="font-medium">{d.diagnosis}</span> — {d.rationale}
                  {d.source && <span className="ml-1 text-teal-500">[{d.source}]</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl bg-teal-50 p-5 shadow-card">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-600">
            Patient summary ({note.patientSummaryLanguage})
          </h3>
          <p className="text-sm leading-relaxed text-teal-900">{note.patientSummaryTranslated || '—'}</p>
        </div>
      </div>
    </div>
  );
}

function CodeChips({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-500">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {(items || []).map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 rounded-full bg-cream-100 px-3 py-1 text-sm text-teal-800"
          >
            <span className="font-mono font-medium">{c.code}</span>
            <span className="text-teal-500">{c.description}</span>
            <span className="rounded-full bg-teal-600 px-1.5 text-xs text-cream-50">
              {Math.round((c.confidence || 0) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
