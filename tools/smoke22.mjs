/* The hash schema and the rule chain, proved without a database.
 *
 * The property that matters is not "hashing works". It is that a row written
 * last year still verifies after the recorded fields have grown, because the
 * alternative is a log that reports itself as tampered with every time the
 * product learns something new. That is what this measures. */
import { rowHash, hashSchemas, HASH_SCHEMA, policyHash, sourceDigest } from '../api/_ops.js';

const fails = [];
const ZERO = '0'.repeat(64);

const base = {
  at: '2026-08-31T12:00:00.000Z', visitor_day: 'abc123def456',
  input_type: 'COMPANY', province: null, purpose: 'TRANSACTION', outcome: 'COMPLETED',
  sources_planned: 40, sources_ok: 34, sources_failed: 6, sources_out_of_scope: 2,
  critical_failed: 0, incomplete: true, suppressed_items: 3, barred_items: 1,
  duration_ms: 91400, policy_version: '2026-08-31', manifest_generated: '2026-08-29',
  enforcement_on: true,
};

/* 1. v1 is FROZEN. This is a recorded constant, not a computed one: if the v1
      field list is ever edited, this value changes and every row written under
      v1 in the live database stops verifying. That is the failure this whole
      mechanism exists to prevent, so it is pinned here in the open. */
const V1_PINNED = rowHash(ZERO, base, 'v1');
console.log('v1 of the reference row:', V1_PINNED);
if (V1_PINNED !== '2a04aa0ec0df3970f346324695e3e1e5a4afbb923d41cbb75350a29a332d6976')
  fails.push('the v1 canonical field list changed, so every row already written under v1 '
    + 'now fails verification and the log reports itself as tampered with');

/* 2. A row with a new field, hashed under v1, is unaffected by that field.
      That is what makes appending safe. */
const withSector = Object.assign({}, base, { sector: 'MORTGAGE' });
if (rowHash(ZERO, withSector, 'v1') !== V1_PINNED)
  fails.push('adding a field changed the v1 hash, so appending is not safe after all');

/* 3. v2 sees the field, so the field is actually committed to. A version that
      ignores what it claims to record would be worse than no version. */
if (rowHash(ZERO, withSector, 'v2') === rowHash(ZERO, base, 'v2'))
  fails.push('v2 does not commit to the sector it exists to record');

/* 4. Every schema in the table is reachable, and the current one is real. */
const schemas = hashSchemas();
console.log('schemas:', schemas.join(', '), '| current:', HASH_SCHEMA);
if (!schemas.includes('v1')) fails.push('v1 has been removed, orphaning every row written under it');
if (!schemas.includes(HASH_SCHEMA)) fails.push('the current schema is not in the table');

/* 5. An unknown marker must FAIL, never fall back. A silent fallback re-hashes
      an old row under new rules and reports an intact log as broken. */
let threw = false;
try { rowHash(ZERO, base, 'v99'); } catch { threw = true; }
if (!threw) fails.push('an unknown hash schema falls back instead of failing, so a row can be '
  + 'verified under rules it was never written under');

/* 6. A chain is order dependent. Swap two rows and it must break. */
const rows = [base, Object.assign({}, base, { at: '2026-08-31T12:00:01.000Z' })];
const chain = (list) => list.reduce((prev, r) => rowHash(prev, r, 'v1'), ZERO);
if (chain(rows) === chain([rows[1], rows[0]]))
  fails.push('the chain is not order dependent, so rows can be reordered undetected');

/* 7. The source digest ignores order and catches content. A reordered register
      is not a rule change; a changed one always is. */
if (sourceDigest(['b', 'a']) !== sourceDigest(['a', 'b']))
  fails.push('reordering the register reads as a rule change');
if (sourceDigest(['a', 'b']) === sourceDigest(['a', 'b', 'c']))
  fails.push('adding a register does not read as a rule change');

/* 8. The rule chain is a chain. */
const p1 = { at: '2026-08-29T00:00:00.000Z', version: '2026-08-29', effective_from: '2026-08-29',
  manifest_generated: '2026-08-29', sources_total: 153, sources_enabled: 170,
  source_digest: sourceDigest(['a']), enforcement_on: true, change_kind: 'INITIAL',
  summary: 'first', reason: null, evidence_url: null, author: '4orm Finance' };
const h1 = policyHash(ZERO, p1);
const p2 = Object.assign({}, p1, { version: '2026-09-01', summary: 'second' });
if (policyHash(h1, p2) === policyHash(ZERO, p2))
  fails.push('a rule change does not commit to the rule change before it');
if (policyHash(ZERO, p1) === policyHash(ZERO, Object.assign({}, p1, { evidence_url: 'https://x' })))
  fails.push('the evidence behind a rule change is not covered by its hash, so it can be '
    + 'altered after the fact');

console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
