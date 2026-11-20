import type { Trip, Activity, Expense, PackingItem, DocumentItem, HotelBooking } from '../types.ts';

export function generateUniqueId(prefix = 'id'): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SKY-${block(4)}-${block(4)}`;
}

export function normalizeSyncCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

type SyncableEntity = { id: string; updatedAt?: number };

function mergeTombstones(
  a?: Record<string, number>,
  b?: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...(a || {}) };
  if (b) {
    for (const [id, ts] of Object.entries(b)) {
      if (!merged[id] || ts > merged[id]) {
        merged[id] = ts;
      }
    }
  }
  return merged;
}

function mergeEntityArray<T extends SyncableEntity>(
  baseList: T[],
  incomingList: T[],
  tombstones: Record<string, number>,
  preferredOrderIds?: string[]
): T[] {
  const map = new Map<string, T>();

  const consider = (item: T) => {
    if (!item || !item.id) return;
    const itemTs = item.updatedAt || 0;
    const deletedTs = tombstones[item.id] || 0;
    if (deletedTs > itemTs) {
      map.delete(item.id);
      return;
    }
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const existingTs = existing.updatedAt || 0;
      if (itemTs >= existingTs) {
        map.set(item.id, item);
      }
    }
  };

  for (const item of baseList || []) consider(item);
  for (const item of incomingList || []) consider(item);

  // Deduplicated and ordered
  if (preferredOrderIds && preferredOrderIds.length > 0) {
    const result: T[] = [];
    const used = new Set<string>();
    for (const id of preferredOrderIds) {
      const item = map.get(id);
      if (item && !used.has(id)) {
        result.push(item);
        used.add(id);
      }
    }
    for (const [id, item] of map.entries()) {
      if (!used.has(id)) {
        result.push(item);
        used.add(id);
      }
    }
    return result;
  }

  return Array.from(map.values());
}

/**
 * Deterministic, idempotent, duplicate-free merge of two Trip snapshots.
 * Safe across simultaneous phone + desktop edits, offline queues, and reconnects.
 */
export function mergeTrips(base: Trip, incoming: Trip): Trip {
  const tombstones = mergeTombstones(base.tombstones, incoming.tombstones);

  const baseMetaTs = base.metaUpdatedAt ?? base.updatedAt ?? 0;
  const incomingMetaTs = incoming.metaUpdatedAt ?? incoming.updatedAt ?? 0;
  const useIncomingMeta = incomingMetaTs >= baseMetaTs;

  const baseBudgetTs = base.budgetUpdatedAt ?? base.budget?.updatedAt ?? base.updatedAt ?? 0;
  const incomingBudgetTs = incoming.budgetUpdatedAt ?? incoming.budget?.updatedAt ?? incoming.updatedAt ?? 0;
  const useIncomingBudget = incomingBudgetTs >= baseBudgetTs;

  // Merge activities per date
  const allDates = new Set<string>([
    ...Object.keys(base.activities || {}),
    ...Object.keys(incoming.activities || {}),
  ]);
  const mergedActivities: Record<string, Activity[]> = {};
  const mergedOrderTimestamps: Record<string, number> = {
    ...(base.activitiesOrderUpdatedAt || {}),
  };

  for (const dateKey of allDates) {
    const baseDay = base.activities?.[dateKey] || [];
    const incomingDay = incoming.activities?.[dateKey] || [];
    const baseOrderTs = base.activitiesOrderUpdatedAt?.[dateKey] ?? base.updatedAt ?? 0;
    const incomingOrderTs = incoming.activitiesOrderUpdatedAt?.[dateKey] ?? incoming.updatedAt ?? 0;

    const preferredIds =
      incomingOrderTs >= baseOrderTs
        ? incomingDay.map((a) => a.id)
        : baseDay.map((a) => a.id);

    mergedOrderTimestamps[dateKey] = Math.max(baseOrderTs, incomingOrderTs);
    mergedActivities[dateKey] = mergeEntityArray<Activity>(
      baseDay,
      incomingDay,
      tombstones,
      preferredIds
    );
  }

  // Merge daily themes per date
  const allThemeDates = new Set<string>([
    ...Object.keys(base.themes || {}),
    ...Object.keys(incoming.themes || {}),
  ]);
  const mergedThemes: Record<string, string> = {};
  const mergedThemesUpdatedAt: Record<string, number> = {};

  for (const dateKey of allThemeDates) {
    const baseTs = base.themesUpdatedAt?.[dateKey] ?? base.updatedAt ?? 0;
    const incTs = incoming.themesUpdatedAt?.[dateKey] ?? incoming.updatedAt ?? 0;
    if (incTs >= baseTs) {
      if (incoming.themes?.[dateKey] !== undefined) {
        mergedThemes[dateKey] = incoming.themes[dateKey];
      } else if (base.themes?.[dateKey] !== undefined) {
        mergedThemes[dateKey] = base.themes[dateKey];
      }
      mergedThemesUpdatedAt[dateKey] = incTs;
    } else {
      if (base.themes?.[dateKey] !== undefined) {
        mergedThemes[dateKey] = base.themes[dateKey];
      }
      mergedThemesUpdatedAt[dateKey] = baseTs;
    }
  }

  // Merge expenses, packingList, documents
  const baseExpenseOrder = (base.expenses || []).map((e) => e.id);
  const incExpenseOrder = (incoming.expenses || []).map((e) => e.id);
  const mergedExpenses = mergeEntityArray<Expense>(
    base.expenses || [],
    incoming.expenses || [],
    tombstones,
    (incoming.updatedAt || 0) >= (base.updatedAt || 0)
      ? [...incExpenseOrder, ...baseExpenseOrder]
      : [...baseExpenseOrder, ...incExpenseOrder]
  );

  const basePackOrder = (base.packingList || []).map((p) => p.id);
  const incPackOrder = (incoming.packingList || []).map((p) => p.id);
  const mergedPacking = mergeEntityArray<PackingItem>(
    base.packingList || [],
    incoming.packingList || [],
    tombstones,
    (incoming.updatedAt || 0) >= (base.updatedAt || 0)
      ? [...incPackOrder, ...basePackOrder]
      : [...basePackOrder, ...incPackOrder]
  );

  const baseDocOrder = (base.documents || []).map((d) => d.id);
  const incDocOrder = (incoming.documents || []).map((d) => d.id);
  const mergedDocs = mergeEntityArray<DocumentItem>(
    base.documents || [],
    incoming.documents || [],
    tombstones,
    (incoming.updatedAt || 0) >= (base.updatedAt || 0)
      ? [...incDocOrder, ...baseDocOrder]
      : [...baseDocOrder, ...incDocOrder]
  );

  const baseHotelOrder = (base.hotels || []).map((h) => h.id);
  const incHotelOrder = (incoming.hotels || []).map((h) => h.id);
  const mergedHotels = mergeEntityArray<HotelBooking>(
    base.hotels || [],
    incoming.hotels || [],
    tombstones,
    (incoming.updatedAt || 0) >= (base.updatedAt || 0)
      ? [...incHotelOrder, ...baseHotelOrder]
      : [...baseHotelOrder, ...incHotelOrder]
  );

  const now = Date.now();
  const maxUpdated = Math.max(base.updatedAt || 0, incoming.updatedAt || 0, now);

  return {
    id: base.id || incoming.id,
    syncId: incoming.syncId || base.syncId,
    revision: Math.max(base.revision || 0, incoming.revision || 0),
    updatedAt: maxUpdated,
    metaUpdatedAt: Math.max(baseMetaTs, incomingMetaTs),
    budgetUpdatedAt: Math.max(baseBudgetTs, incomingBudgetTs),
    activitiesOrderUpdatedAt: mergedOrderTimestamps,
    themesUpdatedAt: mergedThemesUpdatedAt,
    tombstones,
    name: useIncomingMeta ? incoming.name : base.name,
    destination: useIncomingMeta ? incoming.destination : base.destination,
    startDate: useIncomingMeta ? incoming.startDate : base.startDate,
    endDate: useIncomingMeta ? incoming.endDate : base.endDate,
    type: useIncomingMeta ? incoming.type : base.type,
    stops: useIncomingMeta ? incoming.stops : base.stops,
    hotels: mergedHotels,
    budget: useIncomingBudget ? (incoming.budget ?? base.budget) : (base.budget ?? incoming.budget),
    activities: mergedActivities,
    themes: mergedThemes,
    expenses: mergedExpenses,
    packingList: mergedPacking,
    documents: mergedDocs,
  };
}
