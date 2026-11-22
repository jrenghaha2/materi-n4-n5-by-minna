import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('firestore.rules enforces default-deny, email_verified, Master Gate, and N5/N4 book bounds', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');

  // Pillar 1: Default-deny and authenticated verified owner
  assert.ok(rules.includes('allow read, write: if false;'), 'Missing global default-deny');
  assert.ok(rules.includes('request.auth.token.email_verified == true'), 'Missing email_verified gate');
  assert.ok(
    rules.includes('exists(/databases/$(database)/documents/users/$(userId))'),
    'Missing Master Gate parent profile exists() check'
  );

  // Closed schema
  assert.ok(rules.includes('keys().hasOnly('), 'Missing closed schema hasOnly check');

  // N5 (Bab 1-25) & N4 (Bab 26-50) book scoping, Kotoba, Daily Tracker & 30-slot detailed quiz history validation
  assert.ok(rules.includes("bookId == 'n5'"), 'Missing n5 bookId scoping');
  assert.ok(rules.includes("bookId == 'n4'"), 'Missing n4 bookId scoping');
  assert.ok(rules.includes('isValidBunpouList'), 'Missing Bunpou dual-separator full-array validation');
  assert.ok(rules.includes('match /kotobaProgress/{bookId}'), 'Missing kotobaProgress subcollection rule');
  assert.ok(rules.includes('isValidKotobaList'), 'Missing Kotoba dual-separator full-array validation');
  assert.ok(rules.includes('match /dailyTracker/{trackerId}'), 'Missing dailyTracker subcollection rule');
  assert.ok(rules.includes("trackerId == 'state'"), 'Missing dailyTracker singleton state ID gate');
  assert.ok(rules.includes('isValidDailyDaysList'), 'Missing dailyTracker dual-separator full-array validation');
  assert.ok(rules.includes('isValidQuizHistorySessions'), 'Missing 30-slot quiz session validation');
  assert.ok(rules.includes('arr.size() <= 30'), 'Expected 30-slot cloud quiz history cap');
  assert.ok(rules.includes('[0-3]'), 'Expected strict exampleIndex [0-3] bound in V2 quiz token');

  // Mutual exclusion & strict server timestamps
  assert.ok(
    rules.includes('data.mastered.toSet().intersection(data.hard.toSet()).size() == 0'),
    'Missing mastered/hard mutual exclusion'
  );
  assert.ok(rules.includes('incoming().updatedAt == request.time'), 'Missing server timestamp check');
});

test('firestore.rules enforces 3-tier RBAC, Bootstrap Superadmin protection, liveActivity, and immutable activityEvents', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');

  // Bootstrap Superadmin identity check with email_verified
  assert.ok(rules.includes('function isBootstrapSuperAdmin()'), 'Missing isBootstrapSuperAdmin helper');
  assert.ok(
    rules.includes("request.auth.token.email.lower() == 'jrenghaha2@gmail.com'"),
    'Missing Bootstrap Superadmin email check'
  );
  assert.ok(rules.includes('function isSuperAdmin()'), 'Missing isSuperAdmin helper');
  assert.ok(rules.includes('function isAdminOrAbove()'), 'Missing isAdminOrAbove helper');

  // Anti-self-escalation on create
  assert.ok(
    rules.includes("(!isBootstrapSuperAdmin() && incoming().role == 'user')"),
    'Missing anti-self-escalation role gate on user creation'
  );

  // Superadmin role mutation restrictions: cannot edit self, cannot edit Bootstrap Superadmin, only ['role', 'updatedAt']
  assert.ok(rules.includes('userId != request.auth.uid'), 'Missing self-demotion protection');
  assert.ok(
    rules.includes('!isTargetBootstrapSuperAdmin(existing())'),
    'Missing permanent Bootstrap Superadmin target protection'
  );
  assert.ok(
    rules.includes("incoming().diff(existing()).affectedKeys().hasOnly(['role', 'updatedAt'])"),
    'Missing strict affectedKeys role-only update gate for Superadmin'
  );
  assert.ok(
    rules.includes("role in ['user', 'admin', 'superadmin']"),
    'Missing 3-tier role enum validation'
  );

  // Admin & Superadmin read access to users, liveActivity, activityEvents, and learner subcollections
  assert.ok(rules.includes('match /liveActivity/{userId}'), 'Missing liveActivity collection rules');
  assert.ok(rules.includes('matchesActualUserRole(incoming().role, userId)'), 'Missing liveActivity role anti-spoof guard');
  assert.ok(rules.includes('match /activityEvents/{eventId}'), 'Missing activityEvents collection rules');
  assert.ok(rules.includes('allow update, delete: if false;'), 'Missing immutable audit lock on activityEvents');
  assert.ok(rules.includes('(isOwner(userId) || isAdminOrAbove())'), 'Missing read-only admin access to learner subcollections');
});
