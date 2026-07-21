'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function DoctorHome() {
  return (
    <RequireRole allow={['doctor', 'admin']}>
      <DoctorInner />
    </RequireRole>
  );
}

function DoctorInner() {
  const user = useAuth((s) => s.user)!;
  const { data: patientsData } = useQuery({
    queryKey: ['doctor-patients', user.uid],
    queryFn: () => api.doctorPatients(user.uid),
  });
  const { data: apptData } = useQuery({
    queryKey: ['doctor-appts', user.uid],
    queryFn: () => api.appointments({ doctorId: user.uid }),
  });
  const patients = patientsData?.patients ?? [];
  const appts = apptData?.appointments ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appts.filter((a) => a.date >= today);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold text-teal-900">{user.displayName}</h1>
        <p className="text-sm text-teal-600">Your patients & schedule · Oxford Health</p>
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Patients */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-500">
            Patients ({patients.length})
          </h2>
          <div className="space-y-3">
            {patients.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/doctor/patients/${p.id}`}
                  className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-card transition-shadow hover:shadow-lift"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-teal-100 font-semibold text-teal-700">
                      {(p.name || '?').slice(0, 1)}
                    </span>
                    <div>
                      <p className="font-medium text-teal-900">{p.name}</p>
                      <p className="text-xs text-teal-500">
                        {(p.conditions || []).join(', ') || 'No conditions recorded'}
                      </p>
                    </div>
                  </div>
                  <span className="text-teal-400">→</span>
                </Link>
              </motion.div>
            ))}
            {patients.length === 0 && <p className="text-sm text-teal-500">No patients yet.</p>}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-500">
            Upcoming appointments
          </h2>
          <div className="space-y-2">
            {upcoming.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl bg-white p-3 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-teal-900">{a.patientName}</span>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
                    {a.date} · {a.time}
                  </span>
                </div>
                <p className="mt-1 text-xs text-teal-500">{a.reason}</p>
              </motion.div>
            ))}
            {upcoming.length === 0 && <p className="text-sm text-teal-500">No upcoming appointments.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
