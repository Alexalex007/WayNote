# Waynote Security Specification

## 1. Data Invariants
1. **Strict Private Account Isolation**: Every `/users/{userId}` document and `/users/{userId}/trips/{tripId}` subcollection document is strictly private to `request.auth.uid == userId`. No other signed-in user or anonymous client can `get`, `list`, `create`, `update`, or `delete` another user's trips or profile.
2. **Verified Identity Mandate**: Write and private read operations require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Master Gate Parent Integrity**: A `/users/{userId}/trips/{tripId}` document cannot be created unless the parent `/users/{userId}` profile document exists and `incoming().ownerId == request.auth.uid`.
4. **Immutability & Temporal Integrity**: `uid`, `ownerId`, `id`, and `createdAt` are immutable after creation; `createdAt` (create) and `updatedAt` (create/update) must strictly equal `request.time`.
5. **Strict Key Allowlisting & Volumetric Bounds**: No unvalidated shadow keys (`hasOnly`), strict regex on IDs/dates/sync codes, and bounded sizes on all strings and lists.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/list** on `/users/uidA/trips`.
2. **Cross-user get/list** where `auth.uid == 'uidB'` queries `/users/uidA/trips`.
3. **Unverified email write** where `auth.token.email_verified == false` attempts to create `/users/uidA`.
4. **Shadow key injection** on create `/users/uidA` with extra `isAdmin: true`.
5. **Owner spoofing** creating `/users/uidA/trips/t1` with `ownerId: 'uidB'`.
6. **ID poisoning** writing `/users/uidA/trips/bad$id..script` failing `^[a-zA-Z0-9_-]+$`.
7. **Orphaned subcollection write** creating `/users/uidA/trips/t1` when parent `/users/uidA` does not exist.
8. **Fake timestamp backdating** creating `/users/uidA/trips/t1` with client Date instead of `request.time`.
9. **Immutable owner overwrite** updating `ownerId` or `createdAt` on `/users/uidA/trips/t1`.
10. **Oversized payload exhaustion** writing `name` longer than 120 chars or `stops.size() > 20`.
11. **Wildcard read attempt** on `/other/collection`.
12. **Type poisoning** writing non-boolean `archived: "yes"` or string `expenses: "[]"`.
