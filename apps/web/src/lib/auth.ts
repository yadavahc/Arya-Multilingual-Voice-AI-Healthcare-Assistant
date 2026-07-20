'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ResolvedIdentity } from './api';

interface AuthState {
  user: ResolvedIdentity | null;
  setUser: (u: ResolvedIdentity) => void;
  logout: () => void;
}

// Persisted so a refresh keeps the session. Firebase holds the real auth token;
// this mirrors the resolved role/identity for routing + UI.
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: 'arya-auth' },
  ),
);
