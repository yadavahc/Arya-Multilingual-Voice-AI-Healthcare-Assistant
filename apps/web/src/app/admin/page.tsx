'use client';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';

const PIE = ['#1c7a76', '#43b3ac', '#78d0ca', '#aee5e0', '#d97706', '#dc2626'];

export default function Admin() {
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: () => api.analytics() });

  const langData = Object.entries(data?.languageDistribution || {}).map(([name, value]) => ({
    name,
    value,
  }));

  const stats = [
    { label: 'Documentation time saved', value: `${data?.docTimeSavedMinutes ?? '—'} min` },
    { label: 'Red-flag catches', value: data?.redFlagCatches ?? '—' },
    { label: 'Avg latency (p50)', value: data?.avgLatencyP50 ? `${data.avgLatencyP50} ms` : '—' },
    { label: 'Emergency calls', value: data?.emergencyCalls ?? '—' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-teal-900">Consult Intelligence</h1>
      <p className="text-sm text-teal-600">Aggregate metrics · Arya Demo Clinic</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-5 shadow-card">
            <p className="text-sm text-teal-600">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold text-teal-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-teal-500">
            Language distribution
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={langData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {langData.map((_, i) => (
                  <Cell key={i} fill={PIE[i % PIE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-teal-500">
            Calls by language
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={langData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2ece0" />
              <XAxis dataKey="name" stroke="#1a615f" fontSize={12} />
              <YAxis stroke="#1a615f" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#279791" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
