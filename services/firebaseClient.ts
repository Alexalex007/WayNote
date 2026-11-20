import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { Trip } from '../types';
import { generateSyncCode, normalizeSyncCode } from '../shared/syncMerge';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export const FIREBASE_AUTH_HANDLER_URL = `https://${firebaseConfig.authDomain}/__/auth/handler`;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isFirestoreQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /quota exceeded|resource-exhausted|Free daily read units/i.test(msg);
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export class AuthActionError extends Error {
  code: string;
  needsAppleConsoleSetup?: boolean;
  constructor(message: string, code: string, needsAppleConsoleSetup = false) {
    super(message);
    this.code = code;
    this.needsAppleConsoleSetup = needsAppleConsoleSetup;
  }
}

function mapFirebaseAuthError(err: unknown, provider: 'google' | 'apple'): AuthActionError {
  const firebaseErr = err as { code?: string; message?: string };
  const code = firebaseErr?.code || 'auth/unknown';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return new AuthActionError('已取消登入視窗', code);
  }
  if (code === 'auth/popup-blocked') {
    return new AuthActionError('瀏覽器封鎖了登入視窗，請允許彈出視窗後再試一次', code);
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return new AuthActionError('此電子郵件已綁定其他登入方式，請改用原本的方式登入', code);
  }
  if (code === 'auth/operation-not-allowed') {
    if (provider === 'apple') {
      return new AuthActionError(
        'Apple 登入尚未於 Firebase Console 啟用 Service ID 與金鑰設定',
        code,
        true
      );
    }
    return new AuthActionError('此登入方式目前尚未於 Firebase Console 啟用', code);
  }
  if (code === 'auth/unauthorized-domain') {
    return new AuthActionError('目前網域尚未加入 Firebase Auth 授權網域清單', code);
  }
  return new AuthActionError(firebaseErr?.message || '登入失敗，請稍後再試', code);
}

export async function signInWithGooglePopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    throw mapFirebaseAuthError(err, 'google');
  }
}

export async function signInWithApplePopup(): Promise<User> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  provider.setCustomParameters({ locale: 'zh_TW' });
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    throw mapFirebaseAuthError(err, 'apple');
  }
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function sanitizeValidId(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  return (cleaned || `trip_${Date.now()}`).slice(0, 128);
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function isValidIsoDate(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const uid = sanitizeValidId(user.uid);
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  const primaryProvider = user.providerData?.[0]?.providerId || 'google.com';
  const fallbackName = user.email ? user.email.split('@')[0] : 'Waynote 旅人';
  const safeName = (user.displayName || fallbackName || 'Waynote 旅人').trim().slice(0, 100);
  const safeProvider = String(primaryProvider).slice(0, 40);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        displayName: safeName,
        providerId: safeProvider,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        displayName: safeName,
        providerId: safeProvider,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface CloudTripDoc extends Trip {
  ownerId: string;
  archived: boolean;
  clientUpdatedAt: number;
}

export function buildFirestoreTripFields(trip: Trip, ownerId: string) {
  const safeId = sanitizeValidId(trip.id);
  const safeOwnerId = sanitizeValidId(ownerId);
  const rawSync = normalizeSyncCode(trip.syncId || '');
  const safeSyncId = (rawSync || generateSyncCode()).slice(0, 32);
  const todayFallback = new Date().toISOString().slice(0, 10);

  const editableFields = stripUndefinedDeep({
    syncId: safeSyncId,
    name: (trip.name || `${trip.destination || '探索'} 旅程`).trim().slice(0, 120) || '我的旅程',
    destination: (trip.destination || 'Tokyo').trim().slice(0, 200) || 'Tokyo',
    startDate: isValidIsoDate(trip.startDate) ? trip.startDate : todayFallback,
    endDate: isValidIsoDate(trip.endDate) ? trip.endDate : todayFallback,
    type: trip.type === 'Multi' ? ('Multi' as const) : ('Single' as const),
    revision: Math.max(0, Math.floor(Number(trip.revision) || 0)),
    clientUpdatedAt: Math.max(0, Math.floor(Number(trip.updatedAt) || Date.now())),
    metaUpdatedAt: Math.max(0, Math.floor(Number(trip.metaUpdatedAt ?? trip.updatedAt) || Date.now())),
    budgetUpdatedAt: Math.max(0, Math.floor(Number(trip.budgetUpdatedAt ?? trip.updatedAt) || Date.now())),
    stops: Array.isArray(trip.stops) ? trip.stops.slice(0, 20) : [],
    hotels: Array.isArray(trip.hotels) ? trip.hotels.slice(0, 100) : [],
    activities: trip.activities && typeof trip.activities === 'object' ? trip.activities : {},
    activitiesOrderUpdatedAt:
      trip.activitiesOrderUpdatedAt && typeof trip.activitiesOrderUpdatedAt === 'object'
        ? trip.activitiesOrderUpdatedAt
        : {},
    themes: trip.themes && typeof trip.themes === 'object' ? trip.themes : {},
    themesUpdatedAt:
      trip.themesUpdatedAt && typeof trip.themesUpdatedAt === 'object' ? trip.themesUpdatedAt : {},
    expenses: Array.isArray(trip.expenses) ? trip.expenses.slice(0, 1000) : [],
    packingList: Array.isArray(trip.packingList) ? trip.packingList.slice(0, 500) : [],
    documents: Array.isArray(trip.documents) ? trip.documents.slice(0, 200) : [],
    budget:
      trip.budget && typeof trip.budget === 'object'
        ? trip.budget
        : { amount: 0, currency: 'JPY', type: 'total' as const },
    tombstones: trip.tombstones && typeof trip.tombstones === 'object' ? trip.tombstones : {},
  });

  return {
    safeId,
    safeOwnerId,
    editableFields,
  };
}

export async function upsertCloudTrip(
  userId: string,
  trip: Trip,
  knownExists: boolean,
  archived = false
): Promise<void> {
  const { safeId, safeOwnerId, editableFields } = buildFirestoreTripFields(trip, userId);
  const path = `users/${safeOwnerId}/trips/${safeId}`;
  const tripRef = doc(db, 'users', safeOwnerId, 'trips', safeId);

  try {
    if (knownExists) {
      await updateDoc(tripRef, {
        ...editableFields,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(tripRef, {
        id: safeId,
        ownerId: safeOwnerId,
        archived: Boolean(archived),
        ...editableFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, knownExists ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function updateCloudTripArchived(
  userId: string,
  tripId: string,
  archived: boolean
): Promise<void> {
  const safeOwnerId = sanitizeValidId(userId);
  const safeId = sanitizeValidId(tripId);
  const path = `users/${safeOwnerId}/trips/${safeId}`;
  const tripRef = doc(db, 'users', safeOwnerId, 'trips', safeId);

  try {
    await updateDoc(tripRef, {
      archived: Boolean(archived),
      clientUpdatedAt: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudTrip(userId: string, tripId: string): Promise<void> {
  const safeOwnerId = sanitizeValidId(userId);
  const safeId = sanitizeValidId(tripId);
  const path = `users/${safeOwnerId}/trips/${safeId}`;
  const tripRef = doc(db, 'users', safeOwnerId, 'trips', safeId);

  try {
    await deleteDoc(tripRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
