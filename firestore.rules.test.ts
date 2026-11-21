// Security Rules Verification Specification for Dirty Dozen Payloads
// Verified against DRAFT_firestore.rules -> firestore.rules

export const DIRTY_DOZEN_SCENARIOS = [
  { id: 1, name: 'Unauthenticated list on /users/uidA/trips or /users/uidA/presence', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Cross-user read on /users/uidA/trips or /users/uidA/files/f1/chunks/c_0 by uidB', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Unverified email token write to /users/uidA', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Shadow field isAdmin=true on /users/uidA or /users/uidA/presence/s1', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Owner spoofing ownerId=uidB in /users/uidA/trips/t1 or /files/f1', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Malformed ID poison bad$id in /users/uidA/trips/{tripId} or /files/{fileId}', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Orphaned subcollection write without parent /users/uidA or /files/f1', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Forged createdAt/updatedAt not matching request.time', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Attempted immutable ownerId or createdAt mutation', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Oversized name (>120 chars), stops (>20 items), fileSize (>22MB), or chunk (>700KB)', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Global safety net deny on /unlisted/doc', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Type poisoning string JSON in list/map/int fields', expected: 'PERMISSION_DENIED' },
] as const;

export function verifyPayloadAgainstSchemaLimits(payload: {
  id: string;
  ownerId: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
}): boolean {
  const idRegex = /^[a-zA-Z0-9_-]+$/;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return (
    idRegex.test(payload.id) &&
    payload.id.length <= 128 &&
    idRegex.test(payload.ownerId) &&
    payload.ownerId.length <= 128 &&
    payload.name.length >= 1 &&
    payload.name.length <= 120 &&
    payload.destination.length >= 1 &&
    payload.destination.length <= 200 &&
    dateRegex.test(payload.startDate) &&
    dateRegex.test(payload.endDate)
  );
}
