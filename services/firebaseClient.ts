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

// ==================== Real-Time Cross-Device Presence ====================

export async function upsertCloudPresence(params: {
  userId: string;
  sessionId: string;
  tripId: string;
  deviceName: string;
  knownExists?: boolean;
}): Promise<void> {
  const safeOwnerId = sanitizeValidId(params.userId);
  const safeSessionId = sanitizeValidId(params.sessionId);
  const safeTripId = sanitizeValidId(params.tripId || 'HOME');
  const safeDeviceName = (params.deviceName || 'Web 裝置').trim().slice(0, 60) || 'Web 裝置';
  const path = `users/${safeOwnerId}/presence/${safeSessionId}`;
  const ref = doc(db, 'users', safeOwnerId, 'presence', safeSessionId);

  try {
    if (params.knownExists) {
      await updateDoc(ref, {
        tripId: safeTripId,
        deviceName: safeDeviceName,
        clientUpdatedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: safeSessionId,
        ownerId: safeOwnerId,
        tripId: safeTripId,
        deviceName: safeDeviceName,
        clientUpdatedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    // If document vanished before update, recreate cleanly once
    if (params.knownExists) {
      try {
        await setDoc(ref, {
          id: safeSessionId,
          ownerId: safeOwnerId,
          tripId: safeTripId,
          deviceName: safeDeviceName,
          clientUpdatedAt: Date.now(),
          updatedAt: serverTimestamp(),
        });
        return;
      } catch (retryErr) {
        handleFirestoreError(retryErr, OperationType.WRITE, path);
      }
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeCloudPresence(userId: string, sessionId: string): Promise<void> {
  const safeOwnerId = sanitizeValidId(userId);
  const safeSessionId = sanitizeValidId(sessionId);
  const path = `users/${safeOwnerId}/presence/${safeSessionId}`;
  const ref = doc(db, 'users', safeOwnerId, 'presence', safeSessionId);

  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== Chunked Cross-Device Travel Document Sync ====================

const CLOUD_FILE_CHUNK_BYTES = 450_000; // 450 KB raw -> ~600 KB base64 (< 1 MiB Firestore doc cap)
const MAX_CLOUD_FILE_BYTES = 22 * 1024 * 1024;
const cloudBlobUrlCache = new Map<string, string>();

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function uploadCloudFile(params: {
  userId: string;
  tripId: string;
  file: File;
  fileId?: string;
}): Promise<{ fileId: string; fileSize: number; mimeType: string }> {
  const safeOwnerId = sanitizeValidId(params.userId);
  const safeTripId = sanitizeValidId(params.tripId || 'trip');
  const safeFileId = sanitizeValidId(
    params.fileId || `file_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );

  const buf = new Uint8Array(await params.file.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new Error('檔案內容為空');
  }
  if (buf.byteLength > MAX_CLOUD_FILE_BYTES) {
    throw new Error('單一檔案上限為 20MB');
  }

  const totalChunks = Math.ceil(buf.byteLength / CLOUD_FILE_CHUNK_BYTES);
  if (totalChunks > 60) {
    throw new Error('檔案過大，請控制在 20MB 以內');
  }

  const safeFileName = (params.file.name || 'document').trim().slice(0, 255) || 'document';
  const safeMimeType = (params.file.type || 'application/octet-stream').trim().slice(0, 120) || 'application/octet-stream';

  const manifestPath = `users/${safeOwnerId}/files/${safeFileId}`;
  const manifestRef = doc(db, 'users', safeOwnerId, 'files', safeFileId);

  try {
    await setDoc(manifestRef, {
      id: safeFileId,
      ownerId: safeOwnerId,
      tripId: safeTripId,
      fileName: safeFileName,
      mimeType: safeMimeType,
      fileSize: buf.byteLength,
      chunkCount: totalChunks,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, manifestPath);
  }

  // Upload chunks in bounded parallel batches of 4
  const uploadChunk = async (index: number) => {
    const start = index * CLOUD_FILE_CHUNK_BYTES;
    const end = Math.min(buf.byteLength, start + CLOUD_FILE_CHUNK_BYTES);
    const slice = buf.subarray(start, end);
    const chunkId = `c_${index}`;
    const chunkPath = `${manifestPath}/chunks/${chunkId}`;
    const chunkRef = doc(db, 'users', safeOwnerId, 'files', safeFileId, 'chunks', chunkId);

    try {
      await setDoc(chunkRef, {
        index,
        ownerId: safeOwnerId,
        fileId: safeFileId,
        data: uint8ToBase64(slice),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, chunkPath);
    }
  };

  for (let i = 0; i < totalChunks; i += 4) {
    const batch: Promise<void>[] = [];
    for (let j = i; j < Math.min(totalChunks, i + 4); j++) {
      batch.push(uploadChunk(j));
    }
    await Promise.all(batch);
  }

  // Cache local blob URL immediately for instant viewing on uploading device
  const blob = new Blob([buf], { type: safeMimeType });
  const cacheKey = `${safeOwnerId}:${safeFileId}`;
  if (!cloudBlobUrlCache.has(cacheKey)) {
    cloudBlobUrlCache.set(cacheKey, URL.createObjectURL(blob));
  }

  return { fileId: safeFileId, fileSize: buf.byteLength, mimeType: safeMimeType };
}

export async function downloadCloudFileUrl(userId: string, fileId: string): Promise<string> {
  const safeOwnerId = sanitizeValidId(userId);
  const safeFileId = sanitizeValidId(fileId);
  const cacheKey = `${safeOwnerId}:${safeFileId}`;
  const cached = cloudBlobUrlCache.get(cacheKey);
  if (cached) return cached;

  const manifestPath = `users/${safeOwnerId}/files/${safeFileId}`;
  const manifestRef = doc(db, 'users', safeOwnerId, 'files', safeFileId);

  let chunkCount = 0;
  let mimeType = 'application/octet-stream';
  try {
    const snap = await getDoc(manifestRef);
    if (!snap.exists()) {
      throw new Error('雲端檔案尚在同步或不存在');
    }
    const data = snap.data() as { chunkCount?: number; mimeType?: string };
    chunkCount = Number(data.chunkCount || 0);
    mimeType = String(data.mimeType || 'application/octet-stream');
  } catch (error) {
    if (error instanceof Error && error.message.includes('不存在')) throw error;
    handleFirestoreError(error, OperationType.GET, manifestPath);
  }

  if (chunkCount <= 0) {
    throw new Error('雲端檔案分段資訊無效');
  }

  const chunkBuffers: Uint8Array[] = new Array(chunkCount);
  const fetchChunk = async (index: number) => {
    const chunkId = `c_${index}`;
    const chunkPath = `${manifestPath}/chunks/${chunkId}`;
    const chunkRef = doc(db, 'users', safeOwnerId, 'files', safeFileId, 'chunks', chunkId);
    try {
      const cSnap = await getDoc(chunkRef);
      if (!cSnap.exists()) {
        throw new Error(`檔案分段 ${index + 1} 不存在`);
      }
      const cData = cSnap.data() as { data?: string };
      chunkBuffers[index] = base64ToUint8(String(cData.data || ''));
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) throw error;
      handleFirestoreError(error, OperationType.GET, chunkPath);
    }
  };

  for (let i = 0; i < chunkCount; i += 6) {
    const batch: Promise<void>[] = [];
    for (let j = i; j < Math.min(chunkCount, i + 6); j++) {
      batch.push(fetchChunk(j));
    }
    await Promise.all(batch);
  }

  const totalBytes = chunkBuffers.reduce((sum, b) => sum + b.byteLength, 0);
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of chunkBuffers) {
    combined.set(part, offset);
    offset += part.byteLength;
  }

  const blob = new Blob([combined], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  cloudBlobUrlCache.set(cacheKey, objectUrl);
  return objectUrl;
}

export async function deleteCloudFile(userId: string, fileId: string): Promise<void> {
  const safeOwnerId = sanitizeValidId(userId);
  const safeFileId = sanitizeValidId(fileId);
  const cacheKey = `${safeOwnerId}:${safeFileId}`;
  const cachedUrl = cloudBlobUrlCache.get(cacheKey);
  if (cachedUrl) {
    URL.revokeObjectURL(cachedUrl);
    cloudBlobUrlCache.delete(cacheKey);
  }

  const manifestPath = `users/${safeOwnerId}/files/${safeFileId}`;
  const manifestRef = doc(db, 'users', safeOwnerId, 'files', safeFileId);
  try {
    const snap = await getDoc(manifestRef);
    if (snap.exists()) {
      const chunkCount = Math.min(60, Math.max(0, Number((snap.data() as { chunkCount?: number })?.chunkCount || 0)));
      for (let i = 0; i < chunkCount; i += 6) {
        const batch: Promise<void>[] = [];
        for (let j = i; j < Math.min(chunkCount, i + 6); j++) {
          batch.push(deleteDoc(doc(db, 'users', safeOwnerId, 'files', safeFileId, 'chunks', `c_${j}`)));
        }
        await Promise.all(batch);
      }
      await deleteDoc(manifestRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, manifestPath);
  }
}
