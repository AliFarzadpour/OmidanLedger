// src/ai/utils.ts
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';

export function getAdminFirestore(): Firestore {
  return getAdminDb();
}
