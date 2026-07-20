'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

type Role = 'doctor' | 'patient' | 'admin' | 'frontdesk';

/**
 * Client-side role gate. Redirects to /login if unauthenticated, or to the
 * caller's own home if their role isn't allowed for this page.
 */
export function RequireRole({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!allow.includes(user.role)) {
      router.replace(user.role === 'patient' ? '/patient' : '/consult');
      return;
    }
    setReady(true);
  }, [user, allow, router]);

  if (!ready) {
    return <div className="mx-auto max-w-md px-6 py-24 text-center text-teal-500">Loading…</div>;
  }
  return <>{children}</>;
}
