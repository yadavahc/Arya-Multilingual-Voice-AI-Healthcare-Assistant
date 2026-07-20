const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => j<{ ok: boolean; store: string; llm: boolean }>('/health'),
  analytics: (orgId = 'demo-org') =>
    j<AnalyticsResp>(`/analytics?orgId=${orgId}`),
  calls: (orgId = 'demo-org') => j<{ calls: any[] }>(`/calls?orgId=${orgId}`),
  alerts: (orgId = 'demo-org') => j<{ alerts: any[] }>(`/alerts?orgId=${orgId}`),
  encounters: (orgId = 'demo-org') =>
    j<{ encounters: any[] }>(`/encounters?orgId=${orgId}`),
  token: (body: { room: string; identity: string; name?: string; role?: string }) =>
    j<{ token: string; url: string; room: string }>('/token', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  generateNote: (encounterId: string, body: { encounterType?: string; patientLanguage?: string }) =>
    j<any>(`/encounters/${encounterId}/note`, { method: 'POST', body: JSON.stringify(body) }),
  gaps: (encounterId: string, progress = 1) =>
    j<{ gaps: any[]; surface: any[] }>(`/encounters/${encounterId}/gaps?progress=${progress}`, {
      method: 'POST',
    }),
  sendPaymentLink: (body: { orgId: string; patientId?: string; amount: number; note?: string }) =>
    j<any>('/payments/link', { method: 'POST', body: JSON.stringify(body) }),
};

export interface AnalyticsResp {
  docTimeSavedMinutes: number;
  languageDistribution: Record<string, number>;
  redFlagCatches: number;
  avgLatencyP50: number | null;
  totalCalls: number;
  emergencyCalls: number;
}
