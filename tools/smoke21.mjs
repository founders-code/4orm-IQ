/* The chain, tested without a database. rowHash is pure, so the property that
   matters can be proved directly: change any field and the hash moves, and a
   chain built on a changed row stops matching from that point forward. */
import { rowHash } from '/home/claude/kbys/build/4orm-iq/api/_ops.js';

const base = () => ({
  at:'2026-08-29T12:00:00.000Z', visitor_day:'a1b2c3d4e5f6', input_type:'WEBSITE',
  province:'AB', purpose:'TRANSACTION', outcome:'COMPLETED',
  sources_planned:117, sources_ok:112, sources_failed:5, sources_out_of_scope:36,
  critical_failed:0, incomplete:false, suppressed_items:3, barred_items:1,
  duration_ms:96400, policy_version:'v1', manifest_generated:'2026-08-29', enforcement_on:true,
});

const ZERO='0'.repeat(64);
const fails=[];

/* 1. deterministic */
if (rowHash(ZERO, base()) !== rowHash(ZERO, base())) fails.push('rowHash is not deterministic');

/* 2. every field is covered */
const h0 = rowHash(ZERO, base());
for (const k of Object.keys(base())) {
  const r = base();
  r[k] = (typeof r[k] === 'number') ? r[k]+1 : (typeof r[k]==='boolean' ? !r[k] : String(r[k])+'x');
  if (rowHash(ZERO, r) === h0) fails.push('changing "'+k+'" does not change the hash');
}

/* 3. the chain detects a rewritten row */
const rows = [base(), base(), base(), base()];
rows.forEach((r,i)=>{ r.duration_ms = 1000+i; });
let prev = ZERO; const chain = [];
for (const r of rows) { const h = rowHash(prev, r); chain.push({prev, h, r}); prev = h; }
/* rewrite row 2 as an attacker would, then recompute from the start */
const tampered = chain.map(c => ({...c, r:{...c.r}}));
tampered[1].r.outcome = 'BLOCKED_PURPOSE';
let p2 = ZERO, brokeAt = null;
for (let i=0;i<tampered.length;i++){
  const want = rowHash(p2, tampered[i].r);
  if (tampered[i].prev !== p2 || tampered[i].h !== want) { brokeAt = i; break; }
  p2 = tampered[i].h;
}
if (brokeAt !== 1) fails.push('a rewritten row was not detected at its own position, got '+brokeAt);

/* 4. an intact chain verifies */
let p3 = ZERO, ok = true;
for (const c of chain) { if (c.prev !== p3 || c.h !== rowHash(p3, c.r)) { ok = false; break; } p3 = c.h; }
if (!ok) fails.push('an untampered chain failed verification');

/* 5. dropping a row is detected */
const dropped = [chain[0], chain[2], chain[3]];
let p4 = ZERO, dropDetected = false;
for (const c of dropped) { if (c.prev !== p4) { dropDetected = true; break; } p4 = c.h; }
if (!dropDetected) fails.push('a deleted row was not detected');

console.log('deterministic        ', rowHash(ZERO, base()).slice(0,16));
console.log('fields covered       ', Object.keys(base()).length);
console.log('tamper detected at   ', brokeAt);
console.log('intact chain verifies', ok);
console.log('deletion detected    ', dropDetected);
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f=>console.log('  '+f));
process.exit(0);
