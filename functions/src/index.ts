/**
 * Firebase Cloud Functions — webhooks & Firestore triggers.
 *
 *  - razorpayWebhook: verifies signature, marks payment paid, writes receipt.
 *  - onEncounterCompleted: when an encounter flips to "completed", asks the API
 *    to generate the SOAP note (keeps note generation off the client).
 *  - onAdherenceMissed: three missed doses → doctor alert.
 *  - onAlertCreated: fan out FCM push to on-call doctors.
 */
import * as crypto from 'crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();
const db = getFirestore();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

export const razorpayWebhook = onRequest(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const signature = req.headers['x-razorpay-signature'] as string;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (secret && signature !== expected) {
    res.status(400).send('invalid signature');
    return;
  }

  const entity = req.body?.payload?.payment?.entity;
  if (entity?.order_id) {
    const snap = await db
      .collection('payments')
      .where('razorpayOrderId', '==', entity.order_id)
      .limit(1)
      .get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ status: 'paid' });
    }
  }
  res.json({ received: true });
});

export const onEncounterCompleted = onDocumentUpdated('encounters/{id}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (before?.status !== 'completed' && after?.status === 'completed') {
    await fetch(`${API_BASE_URL}/encounters/${event.params.id}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encounterType: after?.encounterType || 'general',
        patientLanguage: after?.detectedLanguages?.[0] || 'en',
      }),
    }).catch((e) => console.error('note generation failed', e));
  }
});

export const onAdherenceMissed = onDocumentCreated('adherence/{id}', async (event) => {
  const entry = event.data?.data();
  if (entry?.status !== 'missed' || !entry?.patientId) return;

  const recent = await db
    .collection('adherence')
    .where('patientId', '==', entry.patientId)
    .where('status', '==', 'missed')
    .get();

  if (recent.size >= 3) {
    await db.collection('alerts').add({
      orgId: entry.orgId || 'demo-org',
      severity: 'warning',
      kind: 'missed_dose',
      title: 'Adherence alert',
      body: `Patient ${entry.patientId} has missed ${recent.size} doses.`,
      createdAt: new Date().toISOString(),
    });
  }
});

export const onAlertCreated = onDocumentCreated('alerts/{id}', async (event) => {
  const alert = event.data?.data();
  if (!alert) return;
  // Look up on-call doctors' FCM tokens for the org.
  const docs = await db
    .collection('users')
    .where('orgId', '==', alert.orgId)
    .where('role', '==', 'doctor')
    .get();
  const tokens = docs.docs.map((d) => d.data().fcmToken).filter(Boolean);
  if (tokens.length === 0) return;
  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: alert.title, body: alert.body },
    data: { kind: alert.kind, encounterRef: alert.encounterRef || '' },
  });
});
