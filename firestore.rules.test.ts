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

  // N5 (Bab 1-25) & N4 (Bab 26-50) book scoping & 30-slot detailed quiz history validation
  assert.ok(rules.includes("bookId == 'n5'"), 'Missing n5 bookId scoping');
  assert.ok(rules.includes("bookId == 'n4'"), 'Missing n4 bookId scoping');
  assert.ok(rules.includes('isValidBunpouList'), 'Missing dual-separator full-array validation');
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
