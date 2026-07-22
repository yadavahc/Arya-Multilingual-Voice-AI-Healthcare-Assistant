'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { LanguageSelector } from '@/components/LanguageSelector';

export function NavBar() {
  const path = usePathname();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const t = useT();

  const staffLinks = [
    { href: '/doctor', label: t('nav.myPatients') },
    { href: '/doctor/calls', label: t('nav.callReviews') },
    { href: '/admin', label: t('nav.analytics') },
  ];
  const patientLinks = [{ href: '/patient', label: t('nav.myCare') }];
  const links = user?.role === 'patient' ? patientLinks : user ? staffLinks : [];

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-cream-50/80 shadow-card">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-teal-800">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-600 text-cream-50">A</span>
          <span className="text-lg tracking-tight">Arya</span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${
                  active ? 'bg-teal-600 text-cream-50' : 'text-teal-800 hover:bg-teal-100'
                }`}
              >
                {l.label}
              </Link>
            );
          })}

          <div className="ml-2"><LanguageSelector /></div>

          {user ? (
            <div className="ml-2 flex items-center gap-3">
              <span className="hidden text-sm text-teal-600 sm:inline">
                {user.displayName} · <span className="capitalize">{user.role}</span>
              </span>
              <button
                onClick={() => { logout(); router.push('/'); }}
                className="rounded-lg bg-white px-3 py-1.5 text-sm text-teal-800 shadow-card"
              >
                {t('nav.signOut')}
              </button>
            </div>
          ) : (
            <Link href="/login" className="ml-2 rounded-lg bg-teal-600 px-3 py-1.5 text-sm text-cream-50">
              {t('nav.signIn')}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
