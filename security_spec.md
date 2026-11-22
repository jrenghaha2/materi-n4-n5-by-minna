# Security Specification — Minna Bunpou (JLPT N5 & N4) Cloud Sync

## 1. Data Invariants

### A. `/users/{userId}` (`UserProfile`)
1. **Strict Ownership**: Every document in `/users/{userId}` belongs strictly to the authenticated user where `request.auth.uid == userId` and `data.uid == request.auth.uid`. Cross-user `get`, `list`, `create`, `update`, and `delete` are denied.
2. **Verified Identity**: All mutations (`create`, `update`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **Closed Schema & Action-Based Updates**: Only `uid`, `createdAt`, `updatedAt`, and optional `displayName` (`<= 60` chars) / `avatarUrl` (`<= 20,000` chars, strictly `""`, `https://...`, or `data:image/(jpeg|png|webp);base64,...`) are permitted. Updates may only affect `['displayName', 'avatarUrl', 'updatedAt']`. Shadow fields (`role`, `isAdmin`, `email`, etc.) are rejected.
4. **Immutable Identity & Server Timestamps**: `uid` and `createdAt` can never change after creation; `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
5. **Zero Listing & No Client Delete**: `allow list: if false;` prevents user enumeration, and `allow delete: if false;` prevents leaving orphaned `bunpouProgress` / `quizHistory` subcollections.

### B. `/users/{userId}/bunpouProgress/{bookId}` (`BunpouBookProgress`)
1. **Master Gate**: All operations (`get`, `create`, `update`, `delete`) require the parent `/users/{userId}` document to exist (`exists(/databases/$(database)/documents/users/$(userId))`), evaluated after all cheap static checks.
2. **Strict Book Allowlist**: `bookId` path variable and `data.bookId` field must match and be strictly in `['n5', 'n4']`.
3. **Closed Schema & Immutability**: Only `uid`, `bookId`, `mastered`, `hard`, `createdAt`, and `updatedAt` are permitted. Updates may only mutate `['mastered', 'hard', 'updatedAt']`; `uid`, `bookId`, and `createdAt` are immutable.
4. **Per-Book Full-Array Validation**: Every element of `mastered` and `hard` is validated via uniqueness (`toSet()`), mutual exclusivity (`intersection().size() == 0`), size limit (`<= 150` items — covering all 101 N5 and 81 N4 patterns), and dual-separator join (`','` and `'|'`) against exact per-book pattern ID regexes:
   - `n5`: `^n5-bab-([1-9]|1[0-9]|2[0-5])-p[1-9][0-9]?$` (`join(',').size() <= 4000`)
   - `n4`: `^n4-bab-(2[6-9]|[34][0-9]|50)-p[1-9][0-9]?$` (`join(',').size() <= 4000`)
5. **Zero Listing**: `allow list: if false;` — client reads only the 2 known book IDs (`n5`, `n4`) directly.

### C. `/users/{userId}/quizHistory/{bookId}` (`BunpouQuizHistory`)
1. **Master Gate**: All operations (`get`, `create`, `update`, `delete`) require `/users/{userId}` to exist (`exists(...)`), evaluated after all cheap static checks.
2. **Strict Book Allowlist**: `bookId` path variable and `data.bookId` must match and be in `['n5', 'n4']`.
3. **Closed Schema & Immutability**: Only `uid`, `bookId`, `sessions`, `createdAt`, and `updatedAt` are permitted. Updates may only mutate `['sessions', 'updatedAt']`.
4. **Compact Pure-ASCII Element-Wise Token Validation**: `sessions` must be a unique list of `<= 30` compact ASCII tokens (`24..8000` chars each), validated individually across all 30 bounded slots (`arr[0]..arr[29]`) with per-book chapter ranges and `patternId` / `selectedPatternId` prefix matching against strict token grammar:
   `id|completedAt|focus|correct|total|score|scopeCode|answersPacked`
   Zero free-form user text, HTML, or JSON strings are stored; full pattern titles, formulas, and explanations are hydrated client-side from the static Minna Bunpou dataset.
5. **Zero Listing**: `allow list: if false;`.

### D. `/users/{userId}/kotobaProgress/{bookId}` (`KotobaBookProgress`)
1. **Master Gate**: All operations (`get`, `create`, `update`, `delete`) require `/users/{userId}` to exist (`exists(...)`), evaluated after all cheap static checks.
2. **Strict Book Allowlist**: `bookId` path variable and `data.bookId` field must match and be strictly in `['n5', 'n4']`.
3. **Closed Schema & Immutability**: Only `uid`, `bookId`, `mastered`, `hard`, `createdAt`, and `updatedAt` are permitted. Updates may only mutate `['mastered', 'hard', 'updatedAt']`; `uid`, `bookId`, and `createdAt` are immutable.
4. **Per-Book Full-Array Validation**: Every element of `mastered` and `hard` is validated via uniqueness (`toSet()`), mutual exclusivity (`intersection().size() == 0`), size limit (`<= 1000` items — covering all 851 N5 and 430 N4 Kotoba words), and dual-separator join (`','` and `'|'`) against exact per-book word ID regexes (`n5-bab-1..25-w...` / `n4-bab-26..50-w...`, `join(',').size() <= 20000`).
5. **Zero Listing**: `allow list: if false;`.

### E. `/users/{userId}/dailyTracker/{trackerId}` (`DailyStudyTracker`)
1. **Master Gate**: All operations (`get`, `create`, `update`, `delete`) require `/users/{userId}` to exist (`exists(...)`).
2. **Strict Singleton Document ID**: `trackerId` must equal `'state'`.
3. **Closed Schema & Immutability**: Only `uid`, `dailyGoal`, `days`, `createdAt`, and `updatedAt` are permitted. Updates may only mutate `['dailyGoal', 'days', 'updatedAt']`.
4. **Strict Goal & Full-Array Daily Token Validation**: `dailyGoal` must be in `[3, 5, 10, 15]`. `days` is a unique list of `<= 90` compact pure-ASCII daily tokens (`YYYY-MM-DD|quizSessions|id1,id2,...`) validated via dual-separator join (`';'` and `'#'`, max 60,000 chars).
5. **Zero Listing**: `allow list: if false;`.

## 2. The "Dirty Dozen" Adversarial Payloads (`firestore.rules.test.ts`)
1. **Unauthenticated Access**: `auth = null` attempting read/write on `/users/userA` or subcollections -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `email_verified = false` attempting create/update -> `PERMISSION_DENIED`.
3. **Cross-User Access**: `userB` attempting get/create/update/delete on `userA` documents -> `PERMISSION_DENIED`.
4. **Collection Scraping (`list`) & Profile Orphan Delete**: Listing `/users`, `bunpouProgress`, `kotobaProgress`, `quizHistory`, or `dailyTracker`, or deleting `/users/{uid}` -> `PERMISSION_DENIED`.
5. **Identity & BookId/TrackerId Spoofing**: Mismatched `uid`, mismatched `bookId`, unknown `bookId` (`n3`), or non-`'state'` `trackerId` -> `PERMISSION_DENIED`.
6. **Master Gate Bypass**: Accessing any subcollection when `/users/{uid}` does not exist -> `PERMISSION_DENIED`.
7. **Shadow / Ghost Field Injection**: Adding `role: 'admin'` or `isAdmin: true` -> `PERMISSION_DENIED`.
8. **Immortal Field Tampering & Forged Timestamps**: Modifying `uid`, `bookId`, `createdAt`, or sending client timestamp instead of `request.time` -> `PERMISSION_DENIED`.
9. **Full-Array XSS & Separator Smuggling (Index > 0)**: Injecting `<script>` or separator smuggling inside `mastered`, `hard`, `sessions`, or `days` at index > 0 -> `PERMISSION_DENIED`.
10. **Cross-Book Prefix Spoofing & Out-of-Range Chapters**: Writing `n4` IDs inside `n5` or invalid `dailyGoal` (`999`) -> `PERMISSION_DENIED`.
11. **Duplicates & Mastered/Hard Overlap**: Duplicate IDs inside `mastered` or same ID in both `mastered` and `hard` -> `PERMISSION_DENIED`.
12. **Unsafe Avatar URLs**: `javascript:alert(1)` or `data:image/svg+xml;base64,...` -> `PERMISSION_DENIED`.
