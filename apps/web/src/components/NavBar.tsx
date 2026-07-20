'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/consult', label: 'Live Consult' },
  { href: '/console', label: 'Call Console' },
  { href: '/admin', label: 'Analytics' },
  { href: '/patient', label: 'Patient' },
];

export function NavBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-cream-50/80 shadow-card">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-teal-800">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-600 text-cream-50">
            A
          </span>
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
        </div>
      </nav>
    </header>
  );
}
