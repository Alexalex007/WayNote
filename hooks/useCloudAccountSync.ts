import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  FIREBASE_DATABASE_ID,
  FIREBASE_PROJECT_ID,
  ensureUserProfile,
  upsertCloudTrip,
  updateCloudTripArchived,
  deleteCloudTrip,
  upsertCloudPresence,
  removeCloudPresence,
  signInWithGooglePopup,
  signInWithApplePopup,
  signOutFirebase,
  sanitizeValidId,
  handleFirestoreError,
  isFirestoreQuotaError,
  OperationType,
} from '../services/firebaseClient';
import { mergeTrips } from '../shared/syncMerge';
import type { Trip, SyncDevice } from '../types';
import { getStoredLanguage, tr } from '../shared/i18n';

export type CloudSyncState = 'signed-out' | 'connecting' | 'synced' | 'syncing' | 'error';

const CLOUD_PRESENCE_STALE_MS = 28_000;
const CLOUD_PRESENCE_HEARTBEAT_MS = 8_000;

interface UseCloudAccountSyncOptions {
  tripsList: Trip[];
  archivedTrips: Trip[];
  activeTripId?: string | null;
  clientId?: string;
  deviceName?: string;
  onApplyCloudSnapshot: (nextActiveTrips: Trip[], nextArchivedTrips: Trip[]) => void;
  onNotify?: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

function docToTrip(raw: Record<string, unknown>): Trip {
  return {
    id: String(raw.id || ''),
    syncId: String(raw.syncId || ''),
    revision: Number(raw.revision || 0),
    updatedAt: Number(raw.clientUpdatedAt || Date.now()),
    metaUpdatedAt: Number(raw.metaUpdatedAt || raw.clientUpdatedAt || Date.now()),
    budgetUpdatedAt: Number(raw.budgetUpdatedAt || raw.clientUpdatedAt || Date.now()),
    activitiesOrderUpdatedAt: (raw.activitiesOrderUpdatedAt as Record<string, number>) || {},
    themesUpdatedAt: (raw.themesUpdatedAt as Record<string, number>) || {},
    tombstones: (raw.tombstones as Record<string, number>) || {},
    name: String(raw.name || tr(getStoredLanguage(), '我的旅程', '我的旅程', 'My Trip')),
    destination: String(raw.destination || ''),
    startDate: String(raw.startDate || ''),
    endDate: String(raw.endDate || ''),
    type: raw.type === 'Multi' ? 'Multi' : 'Single',
    stops: Array.isArray(raw.stops) && raw.stops.length > 0 ? (raw.stops as Trip['stops']) : undefined,
    hotels: Array.isArray(raw.hotels) ? (raw.hotels as Trip['hotels']) : [],
    activities: (raw.activities as Trip['activities']) || {},
    themes: (raw.themes as Trip['themes']) || {},
    expenses: Array.isArray(raw.expenses) ? (raw.expenses as Trip['expenses']) : [],
    packingList: Array.isArray(raw.packingList) ? (raw.packingList as Trip['packingList']) : [],
    documents: Array.isArray(raw.documents) ? (raw.documents as Trip['documents']) : [],
    budget: (raw.budget as Trip['budget']) || { amount: 0, currency: 'JPY', type: 'total' },
  };
}

export function useCloudAccountSync({
  tripsList,
  archivedTrips,
  activeTripId,
  clientId,
  deviceName,
  onApplyCloudSnapshot,
  onNotify,
}: UseCloudAccountSyncOptions) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncState>('signed-out');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<number | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [quotaUpgradeUrl, setQuotaUpgradeUrl] = useState<string | null>(null);
  const [rawPresenceEntries, setRawPresenceEntries] = useState<
    Array<{ id: string; tripId: string; deviceName: string; clientUpdatedAt: number }>
  >([]);
  const [presenceTick, setPresenceTick] = useState<number>(() => Date.now());

  const tripsListRef = useRef<Trip[]>(tripsList);
  const archivedTripsRef = useRef<Trip[]>(archivedTrips);
  const knownCloudIdsRef = useRef<Set<string>>(new Set());
  const profileReadyUidRef = useRef<string | null>(null);
  const presenceDocExistsRef = useRef<boolean>(false);
  const onApplyRef = useRef(onApplyCloudSnapshot);
  const onNotifyRef = useRef(onNotify);

  const safeSessionId = sanitizeValidId(clientId || 'browser_session');
  const lang = getStoredLanguage();
  const safeDeviceLabel =
    (deviceName || tr(lang, 'Web 裝置', 'Web 设备', 'Web Device')).trim().slice(0, 60) ||
    tr(lang, 'Web 裝置', 'Web 设备', 'Web Device');
  const normalizedTripScope = sanitizeValidId(activeTripId || 'HOME');

  useEffect(() => {
    tripsListRef.current = tripsList;
  }, [tripsList]);

  useEffect(() => {
    archivedTripsRef.current = archivedTrips;
  }, [archivedTrips]);

  useEffect(() => {
    onApplyRef.current = onApplyCloudSnapshot;
  }, [onApplyCloudSnapshot]);

  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  // Observe Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        knownCloudIdsRef.current = new Set();
        profileReadyUidRef.current = null;
        presenceDocExistsRef.current = false;
        setRawPresenceEntries([]);
        setCloudStatus('signed-out');
        setCloudError(null);
      }
    });
    return () => unsub();
  }, []);

  // Periodic local freshness re-evaluation so stale remote devices drop immediately after timeout
  useEffect(() => {
    if (!user) return;
    const t = window.setInterval(() => {
      setPresenceTick(Date.now());
    }, 2000);
    return () => window.clearInterval(t);
  }, [user]);

  // Attach private Firestore listener when signed in and verified
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    let unsubSnapshot: (() => void) | null = null;
    const uid = sanitizeValidId(user.uid);
    const collectionPath = `users/${uid}/trips`;

    const initAndSubscribe = async () => {
      setCloudStatus('connecting');
      setCloudError(null);

      try {
        if (!user.emailVerified) {
          const curLang = getStoredLanguage();
          setCloudStatus('error');
          setCloudError(tr(curLang, '帳號電子郵件尚未完成驗證', '账号电子邮件尚未完成验证', 'Email address is not verified yet'));
          return;
        }

        await ensureUserProfile(user);
        if (cancelled) return;
        profileReadyUidRef.current = uid;

        const q = query(collection(db, 'users', uid, 'trips'), where('ownerId', '==', uid));
        unsubSnapshot = onSnapshot(
          q,
          (snapshot) => {
            if (cancelled) return;
            const cloudIds = new Set<string>();
            const cloudActiveMap = new Map<string, Trip>();
            const cloudArchivedMap = new Map<string, Trip>();

            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Record<string, unknown>;
              const parsed = docToTrip(data);
              const safeId = sanitizeValidId(parsed.id || docSnap.id);
              parsed.id = safeId;
              cloudIds.add(safeId);
              if (data.archived === true) {
                cloudArchivedMap.set(safeId, parsed);
              } else {
                cloudActiveMap.set(safeId, parsed);
              }
            });

            knownCloudIdsRef.current = cloudIds;

            // Merge local active trips with cloud active trips
            const localActive = tripsListRef.current;
            const localArchived = archivedTripsRef.current;

            const mergedActiveMap = new Map<string, Trip>();
            const localPendingUploads: { trip: Trip; archived: boolean }[] = [];

            for (const cTrip of cloudActiveMap.values()) {
              mergedActiveMap.set(cTrip.id, cTrip);
            }

            for (const lTrip of localActive) {
              const safeId = sanitizeValidId(lTrip.id);
              const lNormalized = { ...lTrip, id: safeId };

              if (cloudArchivedMap.has(safeId)) {
                // Respect cloud archived state if cloud record is newer
                const cArch = cloudArchivedMap.get(safeId)!;
                if ((lNormalized.updatedAt || 0) > (cArch.updatedAt || 0)) {
                  mergedActiveMap.set(safeId, mergeTrips(cArch, lNormalized));
                }
                continue;
              }

              const existingCloud = mergedActiveMap.get(safeId);
              if (existingCloud) {
                const merged = mergeTrips(existingCloud, lNormalized);
                mergedActiveMap.set(safeId, merged);
                if ((lNormalized.updatedAt || 0) > (existingCloud.updatedAt || 0)) {
                  localPendingUploads.push({ trip: merged, archived: false });
                }
              } else {
                // Local-only trip created before login -> keep and upload to cloud once
                mergedActiveMap.set(safeId, lNormalized);
                localPendingUploads.push({ trip: lNormalized, archived: false });
              }
            }

            const mergedArchivedMap = new Map<string, Trip>(cloudArchivedMap);
            for (const lArch of localArchived) {
              const safeId = sanitizeValidId(lArch.id);
              if (!mergedActiveMap.has(safeId) && !mergedArchivedMap.has(safeId)) {
                const lNorm = { ...lArch, id: safeId };
                mergedArchivedMap.set(safeId, lNorm);
                localPendingUploads.push({ trip: lNorm, archived: true });
              }
            }

            const nextActive = Array.from(mergedActiveMap.values()).sort(
              (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
            );
            const nextArchived = Array.from(mergedArchivedMap.values()).sort(
              (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
            );

            onApplyRef.current(nextActive, nextArchived);
            setLastCloudSyncAt(Date.now());
            setCloudStatus('synced');

            // Upload local-only trips from pre-login session
            if (localPendingUploads.length > 0 && profileReadyUidRef.current === uid) {
              for (const pending of localPendingUploads) {
                const exists = knownCloudIdsRef.current.has(pending.trip.id);
                void upsertCloudTrip(uid, pending.trip, exists, pending.archived).catch((err) => {
                  console.error('Background upload sync error:', err);
                });
              }
            }
          },
          (error) => {
            if (cancelled) return;
            setCloudStatus('error');
            if (isFirestoreQuotaError(error)) {
              const curLang = getStoredLanguage();
              const url = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIREBASE_DATABASE_ID}/data?openUpgradeDialog=true`;
              setQuotaUpgradeUrl(url);
              setCloudError(tr(curLang, '今日雲端資料庫免費額度已達上限', '今日云端数据库免费额度已达上限', 'Daily cloud database free quota reached'));
              onNotifyRef.current?.(tr(curLang, '雲端免費額度已達上限，將於明日重置', '云端免费额度已达上限，将于明日重置', 'Cloud free quota reached; resets tomorrow'), 'error');
            } else {
              const curLang = getStoredLanguage();
              setCloudError(tr(curLang, '雲端同步權限或連線發生問題', '云端同步权限或连接发生问题', 'Cloud sync permission or connection error'));
              handleFirestoreError(error, OperationType.LIST, collectionPath);
            }
          }
        );
      } catch (err) {
        if (cancelled) return;
        const curLang = getStoredLanguage();
        setCloudStatus('error');
        if (isFirestoreQuotaError(err)) {
          setCloudError(tr(curLang, '今日雲端資料庫免費額度已達上限', '今日云端数据库免费额度已达上限', 'Daily cloud database free quota reached'));
        } else {
          setCloudError(err instanceof Error ? err.message : tr(curLang, '雲端初始化失敗', '云端初始化失败', 'Cloud initialization failed'));
        }
      }
    };

    void initAndSubscribe();

    return () => {
      cancelled = true;
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [authReady, user]);

  // Real-time Cross-Device Presence subscription + heartbeat across all signed-in domains/devices
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setRawPresenceEntries([]);
      return;
    }

    let cancelled = false;
    let unsubPresence: (() => void) | null = null;
    const uid = sanitizeValidId(user.uid);
    const presencePath = `users/${uid}/presence`;

    const sendHeartbeat = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      try {
        if (profileReadyUidRef.current !== uid) {
          await ensureUserProfile(user);
          profileReadyUidRef.current = uid;
        }
        if (cancelled) return;
        await upsertCloudPresence({
          userId: uid,
          sessionId: safeSessionId,
          tripId: normalizedTripScope,
          deviceName: safeDeviceLabel,
          knownExists: presenceDocExistsRef.current,
        });
        presenceDocExistsRef.current = true;
      } catch (err) {
        if (!isFirestoreQuotaError(err)) {
          console.error('Presence heartbeat error:', err);
        }
      }
    };

    const startPresence = async () => {
      try {
        if (profileReadyUidRef.current !== uid) {
          await ensureUserProfile(user);
          profileReadyUidRef.current = uid;
        }
        if (cancelled) return;

        const q = query(collection(db, 'users', uid, 'presence'), where('ownerId', '==', uid));
        unsubPresence = onSnapshot(
          q,
          (snap) => {
            if (cancelled) return;
            const list: Array<{ id: string; tripId: string; deviceName: string; clientUpdatedAt: number }> = [];
            snap.forEach((docSnap) => {
              const d = docSnap.data() as Record<string, unknown>;
              const entryId = String(d.id || docSnap.id);
              if (entryId === safeSessionId) {
                presenceDocExistsRef.current = true;
              }
              list.push({
                id: entryId,
                tripId: String(d.tripId || 'HOME'),
                deviceName: String(d.deviceName || tr(getStoredLanguage(), 'Web 裝置', 'Web 设备', 'Web Device')),
                clientUpdatedAt: Number(d.clientUpdatedAt || Date.now()),
              });
            });
            setRawPresenceEntries(list);
            setPresenceTick(Date.now());
          },
          (error) => {
            if (cancelled) return;
            if (!isFirestoreQuotaError(error)) {
              handleFirestoreError(error, OperationType.LIST, presencePath);
            }
          }
        );

        await sendHeartbeat();
      } catch (err) {
        if (!isFirestoreQuotaError(err)) {
          console.error('Presence init error:', err);
        }
      }
    };

    void startPresence();

    const heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat();
    }, CLOUD_PRESENCE_HEARTBEAT_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat();
      }
    };

    const handleUnload = () => {
      presenceDocExistsRef.current = false;
      void removeCloudPresence(uid, safeSessionId).catch(() => undefined);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      if (unsubPresence) unsubPresence();
    };
  }, [authReady, user, safeSessionId, safeDeviceLabel, normalizedTripScope]);

  const pushTripToCloud = useCallback(
    async (trip: Trip, archived = false) => {
      if (!user || !user.emailVerified) return;
      const uid = sanitizeValidId(user.uid);
      if (profileReadyUidRef.current !== uid) {
        await ensureUserProfile(user);
        profileReadyUidRef.current = uid;
      }
      const safeId = sanitizeValidId(trip.id);
      const knownExists = knownCloudIdsRef.current.has(safeId);
      setCloudStatus('syncing');
      try {
        await upsertCloudTrip(uid, trip, knownExists, archived);
        knownCloudIdsRef.current.add(safeId);
        setLastCloudSyncAt(Date.now());
        setCloudStatus('synced');
      } catch (err) {
        setCloudStatus('error');
        if (isFirestoreQuotaError(err)) {
          const curLang = getStoredLanguage();
          setCloudError(tr(curLang, '今日雲端資料庫免費額度已達上限', '今日云端数据库免费额度已达上限', 'Daily cloud database free quota reached'));
        }
        throw err;
      }
    },
    [user]
  );

  const syncArchiveStateToCloud = useCallback(
    async (trip: Trip, archived: boolean) => {
      if (!user || !user.emailVerified) return;
      const uid = sanitizeValidId(user.uid);
      const safeId = sanitizeValidId(trip.id);
      if (profileReadyUidRef.current !== uid) {
        await ensureUserProfile(user);
        profileReadyUidRef.current = uid;
      }
      setCloudStatus('syncing');
      if (knownCloudIdsRef.current.has(safeId)) {
        await updateCloudTripArchived(uid, safeId, archived);
      } else {
        await upsertCloudTrip(uid, trip, false, archived);
        knownCloudIdsRef.current.add(safeId);
      }
      setLastCloudSyncAt(Date.now());
      setCloudStatus('synced');
    },
    [user]
  );

  const removeTripFromCloud = useCallback(
    async (tripId: string) => {
      if (!user || !user.emailVerified) return;
      const uid = sanitizeValidId(user.uid);
      const safeId = sanitizeValidId(tripId);
      if (!knownCloudIdsRef.current.has(safeId)) return;
      await deleteCloudTrip(uid, safeId);
      knownCloudIdsRef.current.delete(safeId);
      setLastCloudSyncAt(Date.now());
    },
    [user]
  );

  const forceSyncAllLocalToCloud = useCallback(async () => {
    if (!user || !user.emailVerified) return;
    const uid = sanitizeValidId(user.uid);
    setCloudStatus('syncing');
    if (profileReadyUidRef.current !== uid) {
      await ensureUserProfile(user);
      profileReadyUidRef.current = uid;
    }
    for (const t of tripsListRef.current) {
      const safeId = sanitizeValidId(t.id);
      await upsertCloudTrip(uid, t, knownCloudIdsRef.current.has(safeId), false);
      knownCloudIdsRef.current.add(safeId);
    }
    setLastCloudSyncAt(Date.now());
    setCloudStatus('synced');
    const curLang = getStoredLanguage();
    onNotifyRef.current?.(tr(curLang, '已完成雲端同步', '已完成云端同步', 'Cloud sync completed'), 'success');
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    const signedUser = await signInWithGooglePopup();
    const curLang = getStoredLanguage();
    onNotifyRef.current?.(
      tr(
        curLang,
        `已登入：${signedUser.displayName || signedUser.email || 'Google 帳號'}`,
        `已登录：${signedUser.displayName || signedUser.email || 'Google 账号'}`,
        `Signed in: ${signedUser.displayName || signedUser.email || 'Google Account'}`
      ),
      'success'
    );
    return signedUser;
  }, []);

  const signInWithApple = useCallback(async () => {
    const signedUser = await signInWithApplePopup();
    const curLang = getStoredLanguage();
    onNotifyRef.current?.(
      tr(
        curLang,
        `已登入：${signedUser.displayName || signedUser.email || 'Apple 帳號'}`,
        `已登录：${signedUser.displayName || signedUser.email || 'Apple 账号'}`,
        `Signed in: ${signedUser.displayName || signedUser.email || 'Apple Account'}`
      ),
      'success'
    );
    return signedUser;
  }, []);

  const handleSignOut = useCallback(async () => {
    if (user) {
      const uid = sanitizeValidId(user.uid);
      presenceDocExistsRef.current = false;
      await removeCloudPresence(uid, safeSessionId).catch(() => undefined);
    }
    await signOutFirebase();
    const curLang = getStoredLanguage();
    onNotifyRef.current?.(tr(curLang, '已登出雲端帳號', '已退出云端账号', 'Signed out of cloud account'), 'info');
  }, [user, safeSessionId]);

  const cloudPresenceDevices: SyncDevice[] = rawPresenceEntries
    .filter(
      (entry) =>
        entry.id === safeSessionId ||
        (entry.tripId === normalizedTripScope && presenceTick - entry.clientUpdatedAt <= CLOUD_PRESENCE_STALE_MS)
    )
    .map((entry) => ({
      clientId: entry.id,
      deviceName: entry.deviceName,
      connectedAt: entry.clientUpdatedAt,
    }));

  const latestRemoteCloudDeviceName =
    rawPresenceEntries
      .filter(
        (entry) =>
          entry.id !== safeSessionId && presenceTick - entry.clientUpdatedAt <= CLOUD_PRESENCE_STALE_MS
      )
      .sort((a, b) => b.clientUpdatedAt - a.clientUpdatedAt)[0]?.deviceName || null;

  return {
    user,
    authReady,
    cloudStatus,
    lastCloudSyncAt,
    cloudError,
    quotaUpgradeUrl,
    cloudPresenceDevices,
    latestRemoteCloudDeviceName,
    signInWithGoogle,
    signInWithApple,
    signOut: handleSignOut,
    pushTripToCloud,
    syncArchiveStateToCloud,
    removeTripFromCloud,
    forceSyncAllLocalToCloud,
  };
}
