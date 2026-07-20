import type { LanguageCode } from './language.js';

/** Firestore stores timestamps as its own Timestamp type; over the wire we use ISO strings. */
export type ISODateString = string;

export type UserRole = 'doctor' | 'patient' | 'admin' | 'frontdesk';

export interface Organization {
  id: string;
  name: string;
  plan: 'trial' | 'clinic' | 'hospital';
  region: string; // e.g. asia-south1
  createdAt: ISODateString;
}

export interface User {
  uid: string;
  role: UserRole;
  orgId: string;
  displayName: string;
  phone: string;
  email?: string;
  preferredLanguage: LanguageCode;
  createdAt: ISODateString;
}

export interface Patient {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  dob?: ISODateString;
  sex?: 'male' | 'female' | 'other';
  preferredLanguage: LanguageCode;
  allergies: string[];
  meds: string[];
  createdAt: ISODateString;
}

export type EncounterStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface TranscriptTurn {
  role: 'doctor' | 'patient' | 'agent';
  text: string;
  /** Language detected for THIS turn — never gates the voice response, only artifacts. */
  language: LanguageCode;
  /** ms since epoch */
  at: number;
  /** Per-turn latency metrics, populated for agent turns. */
  latencyMs?: TurnLatency;
}

export interface TurnLatency {
  timeToFirstAudioByte?: number;
  endOfSpeechToResponseStart?: number;
}

export interface Encounter {
  id: string;
  orgId: string;
  doctorId: string;
  patientId: string;
  startedAt: ISODateString;
  endedAt?: ISODateString;
  status: EncounterStatus;
  encounterType?: string; // "chest_pain", "general", ...
  transcript: TranscriptTurn[];
  detectedLanguages: LanguageCode[];
  audioUrl?: string;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface CodedItem {
  code: string;
  description: string;
  /** 0..1 model confidence; doctor confirms before sign-off. */
  confidence: number;
  confirmed?: boolean;
}

export interface Note {
  id: string;
  encounterId: string;
  soap: SoapNote;
  icd10: CodedItem[];
  cpt: CodedItem[];
  differentials: Array<{ diagnosis: string; rationale: string; source?: string }>;
  patientSummaryTranslated: string;
  patientSummaryLanguage: LanguageCode;
  signedBy?: string;
  signedAt?: ISODateString;
  createdAt: ISODateString;
}

export type GapStatus = 'open' | 'resolved' | 'dismissed';

export interface Gap {
  id: string;
  encounterId: string;
  field: string; // "family_history_cad"
  label: string; // "Family history of CAD"
  status: GapStatus;
  resolvedVia?: 'in_consult' | 'callback' | 'manual';
  createdAt: ISODateString;
}

export type CallDirection = 'inbound' | 'outbound';
export type TriageLevel = 'routine' | 'urgent' | 'emergency';

export interface Call {
  id: string;
  orgId: string;
  direction: CallDirection;
  patientId?: string;
  twilioSid?: string;
  fromNumber: string;
  toNumber: string;
  startedAt: ISODateString;
  endedAt?: ISODateString;
  triageLevel: TriageLevel;
  latencyMetrics: {
    p50?: number;
    p95?: number;
    samples?: number;
  };
  transcriptRef?: string; // encounterId or storage path
}

export interface DoseSlot {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  withFood?: boolean;
  hhmm: string; // "08:00"
}

export interface AdherenceEntry {
  slotHHMM: string;
  scheduledAt: ISODateString;
  status: 'taken' | 'missed' | 'unknown';
  confirmedVia?: 'voice' | 'app' | 'sms';
}

export interface Prescription {
  id: string;
  encounterId: string;
  patientId: string;
  drugs: Array<{ name: string; dose: string; frequency: string; durationDays: number }>;
  schedule: DoseSlot[];
  adherenceLog: AdherenceEntry[];
  pictogramPdfUrl?: string;
  createdAt: ISODateString;
}

export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  orgId: string;
  patientId: string;
  encounterId?: string;
  provider: 'razorpay' | 'stripe';
  razorpayOrderId?: string;
  amount: number; // in smallest unit (paise)
  currency: string;
  status: PaymentStatus;
  invoiceUrl?: string;
  createdAt: ISODateString;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  orgId: string;
  severity: AlertSeverity;
  kind: 'red_flag' | 'missed_dose' | 'gap_callback' | 'payment';
  title: string;
  body: string;
  encounterRef?: string;
  callRef?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: ISODateString;
  createdAt: ISODateString;
}

export interface GlossaryTerm {
  term: string; // canonical English, doc id
  category?: string;
  translations: Partial<Record<LanguageCode, string>>;
}

export interface AuditLog {
  id: string;
  actor: string; // uid or "system"
  action: string;
  resource: string;
  timestamp: ISODateString;
  ip?: string;
}
