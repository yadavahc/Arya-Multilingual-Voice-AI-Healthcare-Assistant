import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Arya — Multilingual Voice AI Clinical Companion',
  description:
    'Sub-second multilingual voice AI for clinics: ambient scribing, red-flag triage, and rural reach.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <NavBar />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
