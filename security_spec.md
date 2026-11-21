# Waynote Security Specification

## 1. Data Invariants
1. **Strict Private Account Isolation**: Every `/users/{userId}` document and its subcollections (`trips`, `presence`, `files`, and `files/{fileId}/chunks`) are strictly private to `request.auth.uid == userId`. No other signed-in user or anonymous client can `get`, `list`, `create`, `update`, or `delete` another user's trips, live presence sessions, or uploaded travel documents.
2. **Verified Identity Mandate**: Write and private read operations require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Master Gate Parent Integrity**: A `/users/{userId}/trips/{tripId}`, `/users/{userId}/presence/{sessionId}`, or `/users/{userId}/files/{fileId}` document cannot be created unless the parent `/users/{userId}` profile document exists and `incoming().ownerId == request.auth.uid`. File chunks under `/users/{userId}/files/{fileId}/chunks/{chunkId}` require `get()` verification of the parent `/files/{fileId}` manifest owner.
4. **Immutability & Temporal Integrity**: `uid`, `ownerId`, `id`, `fileId`, and `createdAt` are immutable after creation; `createdAt` (create) and `updatedAt` (create/update) must strictly equal `request.time`.
5. **Strict Key Allowlisting & Volumetric Bounds**: No unvalidated shadow keys (`hasOnly`), strict regex on IDs/dates/sync codes, and bounded sizes on all strings (including 700 KB chunk limit and 22 MB file limit) and lists.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/list** on `/users/uidA/trips` or `/users/uidA/presence`.
2. **Cross-user get/list** where `auth.uid == 'uidB'` queries `/users/uidA/trips` or `/users/uidA/files/f1/chunks/c_0`.
3. **Unverified email write** where `auth.token.email_verified == false` attempts to create `/users/uidA`.
4. **Shadow key injection** on create `/users/uidA` with extra `isAdmin: true` or on `/users/uidA/presence/s1` with extra `role: 'admin'`.
5. **Owner spoofing** creating `/users/uidA/trips/t1` or `/users/uidA/files/f1` with `ownerId: 'uidB'`.
6. **ID poisoning** writing `/users/uidA/trips/bad$id..script` or `/users/uidA/files/bad$file` failing `^[a-zA-Z0-9_-]+$`.
7. **Orphaned subcollection write** creating `/users/uidA/trips/t1` when parent `/users/uidA` does not exist, or `/users/uidA/files/f1/chunks/c_0` without parent `/files/f1`.
8. **Fake timestamp backdating** creating `/users/uidA/trips/t1` or `/users/uidA/presence/s1` with client Date instead of `request.time`.
9. **Immutable owner overwrite** updating `ownerId` or `createdAt` on `/users/uidA/trips/t1`.
10. **Oversized payload exhaustion** writing `name > 120 chars`, `stops.size() > 20`, `fileSize > 22MB`, or `chunk.data > 700KB`.
11. **Wildcard read attempt** on `/other/collection`.
12. **Type poisoning** writing non-boolean `archived: "yes"`, string `expenses: "[]"`, or string `chunkCount: "3"`.
