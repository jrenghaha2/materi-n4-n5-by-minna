# Security Specification — Minna Bunpou (JLPT N5 & N4) + 3-Tier RBAC & Live Monitoring

## 1. Role Hierarchy & Identity Primitives
- **Bootstrap Superadmin**: `request.auth.token.email_verified == true && request.auth.token.email.lower() == 'jrenghaha2@gmail.com'`.
- **Superadmin (`isSuperAdmin()`)**: Bootstrap Superadmin OR verified user whose `/users/{request.auth.uid}` document has `role == 'superadmin'`.
- **Admin or Above (`isAdminOrAbove()`)**: `isSuperAdmin()` OR verified user whose `/users/{request.auth.uid}` document has `role == 'admin'`.
- **Learner (`user`)**: Verified authenticated user accessing only their own resources.

## 2. Data Invariants

### A. `/users/{userId}` (`UserProfile`)
1. **Read Access**: `get` allowed for `isOwner(userId)` or `isAdminOrAbove()`. `list` allowed strictly for `isAdminOrAbove()`.
2. **Verified Identity on Writes**: All `create` and `update` operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Closed Schema**: Only `uid`, `displayName`, `email`, `avatarUrl`, `role`, `createdAt`, `updatedAt` are permitted.
4. **Anti-Privilege-Escalation on Create**:
   - Bootstrap Superadmin (`jrenghaha2@gmail.com`) creates with `role == 'superadmin'`.
   - All other users MUST create with `role == 'user'`. Self-assigning `admin` or `superadmin` is strictly denied.
5. **Action-Based Updates & Permanent Bootstrap Protection**:
   - **Action 1a (Owner Profile Edit)**: Owner updates only `['displayName', 'avatarUrl', 'email', 'updatedAt']` without altering `role`.
   - **Action 1b (Owner Legacy Auto-Heal)**: Owner updates `['displayName', 'avatarUrl', 'email', 'role', 'updatedAt']` ONLY if (`isBootstrapSuperAdmin() && incoming().role == 'superadmin'`) OR (`!('role' in existing()) && incoming().role == 'user'`).
   - **Action 2 (Superadmin Role Management)**: `isSuperAdmin()` updates ONLY `['role', 'updatedAt']` on OTHER users (`userId != request.auth.uid`), with `incoming().role in ['user', 'admin', 'superadmin']`, and strictly DENIED if the target document is the Bootstrap Superadmin (`existing().email.lower() == 'jrenghaha2@gmail.com'`).
   - Regular `admin` and `user` are strictly denied from changing any user's `role`.
6. **Immutable Identity & Zero Client Delete**: `uid` and `createdAt` are immutable; `createdAt` (create) and `updatedAt` (create/update) must equal `request.time`; `allow delete: if false;`.

### B. Learner Subcollections under `/users/{userId}`
- `/users/{userId}/bunpouProgress/{bookId}` (`n5`, `n4`)
- `/users/{userId}/kotobaProgress/{bookId}` (`n5`, `n4`)
- `/users/{userId}/quizHistory/{bookId}` (`n5`, `n4`)
- `/users/{userId}/dailyTracker/{trackerId}` (`state`)
1. **Read Access**: `get` allowed for `isOwner(userId)` or `isAdminOrAbove()` (with Master Gate `exists(/databases/$(database)/documents/users/$(userId))`). `list` remains `false`.
2. **Write Access**: Strictly `isVerifiedUser() && isOwner(userId)` (Admins and Superadmins are strictly read-only on learner progress and quiz history).
3. **Existing Schema Invariants Preserved**: Dual-separator full-array validation, mutual exclusion of `mastered` & `hard`, 30-slot V2 quiz tokens, 90-day daily tokens, strict server timestamps.

### C. `/liveActivity/{userId}` (`LiveActivity`)
1. **Read Access**: `get` allowed for `isOwner(userId)` or `isAdminOrAbove()`. `list` allowed strictly for `isAdminOrAbove()`.
2. **Write Access**: `create` and `update` allowed strictly for `isVerifiedUser() && isOwner(userId)` with Master Gate `exists(/databases/$(database)/documents/users/$(userId))`, strict closed schema (`uid`, `displayName`, `email`, `avatarUrl`, `role`, `status`, `activeTab`, `activeBookId`, `moduleLabel`, `quizInProgress`, `quizMode`, `quizBookId`, `quizCurrentQuestion`, `quizTotalQuestions`, `quizCorrectCount`, `totalMasteredBunpou`, `totalMasteredKotoba`, `totalMastered`, `totalQuizSessions`, `lastQuizScore`, `lastQuizSummary`, `currentStreak`, `updatedAt`), bounded sizes/ranges, and `updatedAt == request.time`.
3. **No Client Delete**: `allow delete: if false;`.

### D. `/activityEvents/{eventId}` (`ActivityEvent`)
1. **Read Access**: `get` allowed for `isAdminOrAbove()` or event owner (`existing().uid == request.auth.uid`). `list` allowed strictly for `isAdminOrAbove()`.
2. **Create Only (Append-Only Audit Feed)**: `create` allowed strictly for `isVerifiedUser()` with `isValidId(eventId)`, `incoming().uid == request.auth.uid`, Master Gate `exists(/databases/$(database)/documents/users/$(request.auth.uid))`, strict closed schema (`uid`, `displayName`, `email`, `type`, `bookId`, `title`, `detail`, `score`, `correctCount`, `totalQuestions`, `createdAt`), and `createdAt == request.time`.
3. **Immutable**: `allow update, delete: if false;`.

## 3. The "Dirty Dozen" Adversarial Payloads (`firestore.rules.test.ts`)
1. **Unauthenticated Access**: `auth = null` attempting read/write on `/users`, `/liveActivity`, `/activityEvents`, or subcollections -> `PERMISSION_DENIED`.
2. **Unverified Bootstrap Email Spoof**: `email = 'jrenghaha2@gmail.com'` with `email_verified = false` -> `PERMISSION_DENIED`.
3. **Self-Privilege Escalation on Create**: Regular user creating `/users/{uid}` with `role: 'admin'` or `'superadmin'` -> `PERMISSION_DENIED`.
4. **Self-Privilege Escalation on Update**: Regular user updating own `role` to `'admin'` or `'superadmin'` -> `PERMISSION_DENIED`.
5. **Admin Role Mutation**: `admin` attempting to change any user's `role` -> `PERMISSION_DENIED`.
6. **Superadmin Self-Demotion**: `superadmin` attempting to change their own `role` (`targetUid == request.auth.uid`) -> `PERMISSION_DENIED`.
7. **Bootstrap Superadmin Demotion Attack**: Another `superadmin` attempting to change `jrenghaha2@gmail.com`'s `role` -> `PERMISSION_DENIED`.
8. **Superadmin Profile Tampering**: `superadmin` modifying `displayName` or `email` of another user instead of `['role', 'updatedAt']` -> `PERMISSION_DENIED`.
9. **Admin Write to Learner Subcollections**: `admin` or `superadmin` attempting to write/delete a learner's `bunpouProgress`, `kotobaProgress`, `quizHistory`, or `dailyTracker` -> `PERMISSION_DENIED`.
10. **Non-Admin Listing**: Regular `user` attempting `list` on `/users`, `/liveActivity`, or `/activityEvents` -> `PERMISSION_DENIED`.
11. **LiveActivity / Event Identity Spoofing**: User writing `/liveActivity/{otherUid}` or creating `/activityEvents/{id}` with `uid != request.auth.uid` or mutating existing events -> `PERMISSION_DENIED`.
12. **Shadow Field, Invalid Role, & Forged Timestamp Injection**: Adding ghost fields, setting `role: 'owner'`, or omitting `request.time` -> `PERMISSION_DENIED`.
