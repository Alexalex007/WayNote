import { useState, useEffect, useRef, useCallback } from 'react';
import type { Trip, SyncConnectionState, SyncDevice } from '../types';
import { mergeTrips, normalizeSyncCode } from '../shared/syncMerge';
import { getStoredLanguage, tr } from '../shared/i18n';

function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'server';
  const devKey = 'sky_travel_client_id';
  let devId = localStorage.getItem(devKey);
  if (!devId) {
    devId = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem(devKey, devId);
  }
  const tabKey = 'waynote_tab_session_id';
  let tabId = sessionStorage.getItem(tabKey);
  if (!tabId) {
    tabId = Math.random().toString(36).slice(2, 7);
    sessionStorage.setItem(tabKey, tabId);
  }
  return `${devId}_${tabId}`;
}

function getDeviceLabel(): string {
  const lang = getStoredLanguage();
  if (typeof navigator === 'undefined') return tr(lang, '瀏覽器', '浏览器', 'Browser');
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return tr(lang, 'Android 手機', 'Android 手机', 'Android Phone');
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return tr(lang, 'Web 裝置', 'Web 设备', 'Web Device');
}

export type RemoteSyncSectionTarget = 'ITINERARY' | 'EXPLORE' | 'EXPENSES' | 'TOOLBOX' | 'SETTINGS';

export interface RemoteChangeNotification {
  deviceName: string;
  sectionLabel: string;
  targetTab: RemoteSyncSectionTarget;
}

export function detectEditedSection(
  prev: Trip | null | undefined,
  next: Trip
): { sectionLabel: string; targetTab: RemoteSyncSectionTarget } | null {
  const lang = getStoredLanguage();
  if (!prev) {
    return { sectionLabel: tr(lang, '旅程內容', '旅程内容', 'Trip details'), targetTab: 'ITINERARY' };
  }
  if (JSON.stringify(prev.hotels || []) !== JSON.stringify(next.hotels || [])) {
    return { sectionLabel: tr(lang, '住宿酒店', '住宿酒店', 'Accommodations'), targetTab: 'ITINERARY' };
  }
  if (
    JSON.stringify(prev.activities || {}) !== JSON.stringify(next.activities || {}) ||
    JSON.stringify(prev.themes || {}) !== JSON.stringify(next.themes || {}) ||
    JSON.stringify(prev.activitiesOrderUpdatedAt || {}) !== JSON.stringify(next.activitiesOrderUpdatedAt || {})
  ) {
    return { sectionLabel: tr(lang, '行程規劃', '行程规划', 'Itinerary'), targetTab: 'ITINERARY' };
  }
  if (JSON.stringify(prev.savedPlaces || []) !== JSON.stringify(next.savedPlaces || [])) {
    return { sectionLabel: tr(lang, '探索口袋名單', '探索口袋名单', 'Saved places'), targetTab: 'EXPLORE' };
  }
  if (JSON.stringify(prev.expenses || []) !== JSON.stringify(next.expenses || [])) {
    return { sectionLabel: tr(lang, '開支紀錄', '开支记录', 'Expenses'), targetTab: 'EXPENSES' };
  }
  if (
    JSON.stringify(prev.budget || {}) !== JSON.stringify(next.budget || {}) ||
    (prev.budgetUpdatedAt || 0) !== (next.budgetUpdatedAt || 0)
  ) {
    return { sectionLabel: tr(lang, '預算設定', '预算设置', 'Budget'), targetTab: 'EXPENSES' };
  }
  if (JSON.stringify(prev.packingList || []) !== JSON.stringify(next.packingList || [])) {
    return { sectionLabel: tr(lang, '旅行清單', '旅行清单', 'Packing list'), targetTab: 'TOOLBOX' };
  }
  if (JSON.stringify(prev.documents || []) !== JSON.stringify(next.documents || [])) {
    return { sectionLabel: tr(lang, '文件庫', '文件库', 'Documents'), targetTab: 'TOOLBOX' };
  }
  if (
    prev.name !== next.name ||
    prev.destination !== next.destination ||
    prev.startDate !== next.startDate ||
    prev.endDate !== next.endDate ||
    JSON.stringify(prev.stops || []) !== JSON.stringify(next.stops || [])
  ) {
    return { sectionLabel: tr(lang, '旅程設定', '旅程设置', 'Trip settings'), targetTab: 'SETTINGS' };
  }
  return null;
}

interface UseTripSyncOptions {
  trip: Trip | null;
  onRemoteTrip: (mergedTrip: Trip) => void;
  onRemoteChangeMeta?: (info: RemoteChangeNotification) => void;
}

export function useTripSync({ trip, onRemoteTrip, onRemoteChangeMeta }: UseTripSyncOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncConnectionState>('idle');
  const [connectedDevices, setConnectedDevices] = useState<SyncDevice[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const clientIdRef = useRef<string>(getOrCreateClientId());
  const deviceLabelRef = useRef<string>(getDeviceLabel());
  const wsRef = useRef<WebSocket | null>(null);
  const tripRef = useRef<Trip | null>(trip);
  const onRemoteTripRef = useRef(onRemoteTrip);
  const onRemoteChangeMetaRef = useRef(onRemoteChangeMeta);
  const pendingPushRef = useRef<Trip | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRemoteApplyingRef = useRef(false);

  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  useEffect(() => {
    onRemoteTripRef.current = onRemoteTrip;
  }, [onRemoteTrip]);

  useEffect(() => {
    onRemoteChangeMetaRef.current = onRemoteChangeMeta;
  }, [onRemoteChangeMeta]);

  const activeSyncId = trip?.syncId ? normalizeSyncCode(trip.syncId) : '';

  const sendPushOverWs = useCallback((payload: Trip, editedSection?: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'trip:push', trip: payload, editedSection }));
      pendingPushRef.current = null;
      return true;
    }
    pendingPushRef.current = payload;
    return false;
  }, []);

  const pushTripUpdate = useCallback(
    (updatedTrip: Trip) => {
      if (isRemoteApplyingRef.current) return;
      if (!updatedTrip.syncId) return;

      const diff = detectEditedSection(tripRef.current, updatedTrip);
      const editedSection = diff?.sectionLabel;

      if (!sendPushOverWs(updatedTrip, editedSection)) {
        const code = normalizeSyncCode(updatedTrip.syncId);
        fetch(`/api/trips/${encodeURIComponent(code)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip: updatedTrip,
            clientId: clientIdRef.current,
            deviceName: deviceLabelRef.current,
            editedSection,
          }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.trip) {
              setLastSyncedAt(Date.now());
            }
          })
          .catch(() => {
            // Keep pendingPushRef so WS flushes on reconnect
          });
      }
    },
    [sendPushOverWs]
  );

  // Connect & Reconnect WebSocket when activeSyncId changes
  useEffect(() => {
    if (!activeSyncId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setSyncStatus('idle');
      setConnectedDevices([]);
      return;
    }

    let isUnmounted = false;

    const cleanupTimers = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const connect = () => {
      if (isUnmounted) return;
      cleanupTimers();
      setSyncStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');
      setSyncError(null);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?syncId=${encodeURIComponent(activeSyncId)}&clientId=${encodeURIComponent(clientIdRef.current)}&deviceName=${encodeURIComponent(deviceLabelRef.current)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        reconnectAttemptRef.current = 0;
        setSyncStatus('connected');
        setSyncError(null);

        if (pendingPushRef.current) {
          sendPushOverWs(pendingPushRef.current);
        }

        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN && document.visibilityState !== 'hidden') {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 500);
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'presence:update') {
            setConnectedDevices(msg.devices || []);
            return;
          }

          if (msg.type === 'sync:init') {
            setConnectedDevices(msg.devices || []);
            const serverTrip = msg.trip as Trip | null;
            const localTrip = tripRef.current;

            if (serverTrip && localTrip) {
              const merged = mergeTrips(localTrip, serverTrip);
              isRemoteApplyingRef.current = true;
              onRemoteTripRef.current(merged);
              queueMicrotask(() => {
                isRemoteApplyingRef.current = false;
              });
              if ((localTrip.updatedAt || 0) > (serverTrip.updatedAt || 0) || !serverTrip.revision) {
                sendPushOverWs(merged);
              }
              setLastSyncedAt(Date.now());
            } else if (!serverTrip && localTrip) {
              sendPushOverWs(localTrip);
            } else if (serverTrip && !localTrip) {
              isRemoteApplyingRef.current = true;
              onRemoteTripRef.current(serverTrip);
              queueMicrotask(() => {
                isRemoteApplyingRef.current = false;
              });
              setLastSyncedAt(Date.now());
            }
            return;
          }

          if (msg.type === 'sync:ack') {
            setLastSyncedAt(Date.now());
            return;
          }

          if (msg.type === 'trip:remote_update' && msg.trip) {
            const incoming = msg.trip as Trip;
            const localTrip = tripRef.current;
            const merged = localTrip ? mergeTrips(localTrip, incoming) : incoming;
            const diff = detectEditedSection(localTrip, merged);

            isRemoteApplyingRef.current = true;
            onRemoteTripRef.current(merged);
            queueMicrotask(() => {
              isRemoteApplyingRef.current = false;
            });
            setLastSyncedAt(Date.now());

            if (diff && onRemoteChangeMetaRef.current) {
              const lang = getStoredLanguage();
              const sourceDevice =
                typeof msg.sourceDeviceName === 'string' && msg.sourceDeviceName.trim()
                  ? msg.sourceDeviceName.trim()
                  : tr(lang, '另一台裝置', '另一台设备', 'Another device');
              const customLabel =
                typeof msg.editedSection === 'string' && msg.editedSection.trim()
                  ? msg.editedSection.trim()
                  : diff.sectionLabel;
              onRemoteChangeMetaRef.current({
                deviceName: sourceDevice,
                sectionLabel: customLabel,
                targetTab: diff.targetTab,
              });
            }
          }
        } catch (err) {
          console.error('[SkyTravel Sync] Failed to parse message', err);
        }
      };

      ws.onerror = () => {
        if (!isUnmounted) {
          const lang = getStoredLanguage();
          setSyncError(tr(lang, '連線不穩定，正在重新連線', '连接不稳定，正在重新连接', 'Unstable connection, reconnecting...'));
        }
      };

      ws.onclose = () => {
        cleanupTimers();
        if (isUnmounted) return;
        setSyncStatus('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 15000);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    const sendLeaveSignal = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'presence:leave' }));
        } catch {
          // ignore
        }
      }
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify({ clientId: clientIdRef.current })], {
            type: 'application/json',
          });
          navigator.sendBeacon(`/api/trips/${encodeURIComponent(activeSyncId)}/leave`, blob);
        } catch {
          // ignore
        }
      }
    };

    connect();

    const handleOnline = () => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        reconnectAttemptRef.current = 0;
        connect();
      }
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        } else if (!ws || ws.readyState === WebSocket.CLOSED) {
          reconnectAttemptRef.current = 0;
          connect();
        }
      }
    };
    const handlePageHide = () => {
      sendLeaveSignal();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.close(1000, 'pagehide');
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isUnmounted = true;
      cleanupTimers();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'presence:leave' }));
          } catch {
            // ignore
          }
        }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeSyncId, sendPushOverWs]);

  const joinSyncTripByCode = useCallback(async (rawCode: string): Promise<Trip | null> => {
    const lang = getStoredLanguage();
    const code = normalizeSyncCode(rawCode);
    if (!code) throw new Error(tr(lang, '請輸入有效的同步代碼', '请输入有效的同步代码', 'Please enter a valid sync code'));

    const res = await fetch(`/api/trips/${encodeURIComponent(code)}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          tr(
            lang,
            '找不到此同步代碼的旅程，請確認主裝置已開啟並連線同步',
            '找不到此同步代码的旅程，请确认主设备已打开并连线同步',
            'No trip found for this sync code. Check that the host device is online.'
          )
        );
      }
      throw new Error(tr(lang, '無法連線至同步伺服器', '无法连接到同步服务器', 'Unable to reach sync server'));
    }
    const data = await res.json();
    if (!data.trip) throw new Error(tr(lang, '同步資料格式無效', '同步数据格式无效', 'Invalid sync payload'));
    setLastSyncedAt(Date.now());
    return data.trip as Trip;
  }, []);

  return {
    syncStatus,
    connectedDevices,
    lastSyncedAt,
    syncError,
    clientId: clientIdRef.current,
    deviceName: deviceLabelRef.current,
    pushTripUpdate,
    joinSyncTripByCode,
  };
}
