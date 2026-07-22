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
  token: (body: {
    room: string;
    identity: string;
    name?: string;
    role?: string;
    patientId?: string;
    language?: string;
  }) =>
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
  resolveIdentity: (phone: string, portal: 'doctor' | 'patient') =>
    j<ResolvedIdentity>('/auth/resolve', {
      method: 'POST',
      body: JSON.stringify({ phone, portal }),
    }),
  patientContext: (patientId: string) =>
    j<{ context: any; summary: string }>(`/patients/${patientId}/context`),
  aryaChat: (
    patientId: string,
    messages: ChatMessage[],
    opts: { sessionId?: string; language?: string; channel?: string } = {},
  ) =>
    j<AryaChatResp>('/arya/chat', {
      method: 'POST',
      body: JSON.stringify({ patientId, messages, ...opts }),
    }),

  // Google auth + onboarding
  googleAuth: (email: string, displayName?: string) =>
    j<{ needsOnboarding: boolean; profile: any }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, displayName }),
    }),
  completeProfile: (body: {
    email: string;
    role: 'doctor' | 'patient';
    displayName: string;
    phone: string;
    hospitalId: string;
    preferredLanguage?: string;
  }) => j<{ needsOnboarding: boolean; profile: any }>('/profile/complete', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  hospitals: () => j<{ hospitals: any[] }>('/hospitals'),
  doctors: (hospitalId: string) => j<{ doctors: any[] }>(`/doctors?hospitalId=${hospitalId}`),

  // Calendar / appointments
  slots: (doctorId: string, date: string) =>
    j<{ doctorId: string; date: string; slots: string[] }>(
      `/calendar/slots?doctorId=${doctorId}&date=${date}`,
    ),
  bookAppointment: (body: {
    patientId: string;
    doctorId: string;
    date: string;
    time: string;
    reason?: string;
  }) => j<{ booked: boolean; appointment: any }>('/appointments/book', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  appointments: (params: { doctorId?: string; patientId?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return j<{ appointments: any[] }>(`/appointments?${q}`);
  },
  confirmAppointment: (id: string) =>
    j<{ confirmed: boolean; emailed: boolean }>(`/appointments/${id}/confirm`, { method: 'POST' }),
  rejectAppointment: (id: string) =>
    j<{ rejected: boolean }>(`/appointments/${id}/reject`, { method: 'POST' }),

  // Doctor views
  doctorPatients: (doctorId: string) =>
    j<{ patients: any[] }>(`/doctors/${doctorId}/patients`),
  patientDetail: (patientId: string) =>
    j<{ context: any; conversations: any[]; appointments: any[] }>(
      `/patients/${patientId}/detail`,
    ),
  conversations: (patientId: string) =>
    j<{ conversations: any[] }>(`/conversations?patientId=${patientId}`),

  // Documents (multilingual RAG)
  uploadDocument: async (patientId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/patients/${patientId}/document`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`upload → ${res.status}`);
    return res.json() as Promise<{ uploaded: boolean; filename: string; chars: number; preview: string }>;
  },
  getDocument: (patientId: string) =>
    j<{ hasDocument: boolean; count: number; filename?: string; chars: number }>(`/patients/${patientId}/document`),
  listDocuments: (patientId: string) =>
    j<{ documents: any[] }>(`/patients/${patientId}/documents`),

  // AI health features
  verifyMedicine: async (patientId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/patients/${patientId}/verify-medicine`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`verify → ${res.status}`);
    return res.json() as Promise<any>;
  },
  detectCondition: async (patientId: string, file: File, note = '') => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/patients/${patientId}/detect-condition?note=${encodeURIComponent(note)}`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`detect → ${res.status}`);
    return res.json() as Promise<any>;
  },
  dietPlan: (patientId: string) =>
    j<{ plan: any }>(`/patients/${patientId}/diet-plan`, { method: 'POST' }),
  wearables: (patientId: string) =>
    j<{ metrics: any; analysis: any }>(`/wearables/${patientId}`),
  syncWearables: (patientId: string, metrics: any) =>
    j<{ metrics: any; analysis: any }>(`/wearables/${patientId}/sync`, { method: 'POST', body: JSON.stringify(metrics) }),

  // Call review + feedback
  doctorCalls: (doctorId: string) => j<{ calls: any[] }>(`/doctors/${doctorId}/calls`),
  getConversation: (convId: string) => j<any>(`/conversations/${convId}`),
  finalizeConversation: (convId: string) =>
    j<any>(`/conversations/${convId}/finalize`, { method: 'POST' }),
  conversationFeedback: (convId: string, body: { handledCorrectly: boolean; rating: number; notes: string; reviewedBy?: string }) =>
    j<{ saved: boolean }>(`/conversations/${convId}/feedback`, { method: 'POST', body: JSON.stringify(body) }),
};

export interface ResolvedIdentity {
  uid: string;
  role: 'doctor' | 'patient' | 'admin' | 'frontdesk';
  orgId: string;
  displayName: string;
  hospitalId?: string;
  email?: string;
  phone?: string;
  patientId?: string | null;
  preferredLanguage: string;
  isNew?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AryaChatResp {
  reply: string;
  actions: { tool: string; args: any; result: any }[];
  context_used: boolean;
}

export interface AnalyticsResp {
  docTimeSavedMinutes: number;
  languageDistribution: Record<string, number>;
  redFlagCatches: number;
  avgLatencyP50: number | null;
  totalCalls: number;
  emergencyCalls: number;
}
