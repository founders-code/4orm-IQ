/* ====================== THE SCHEDULED DOOR, PROVED
   Retention is the one job that runs with nobody at a keyboard, and the one
   job that deletes. Every test here fails if the door is opened, weakened, or
   made replayable. */
import fs from 'fs';
import crypto from 'crypto';
import { requireSchedule, sign, WINDOW_S } from '../api/_scheduled.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

const SECRET = 'k'.repeat(48);
const now = () => Math.floor(Date.now() / 1000);
const nonce = () => crypto.randomBytes(12).toString('hex');
const req = (over = {}, ts = now(), n = nonce(), secret = SECRET, body = '') => {
  const r = { method: 'POST', url: '/api/retain', headers: {} };
  r.headers['x-4orm-timestamp'] = String(ts);
  r.headers['x-4orm-nonce'] = n;
  r.headers['x-4orm-signature'] = sign(secret, r.method, '/api/retain', ts, n, body);
  Object.assign(r.headers, over);
  return r;
};

/* ---- 1. No secret, no door -------------------------------------------- */
{
  delete process.env.KBYS_SCHEDULE_SECRET;
  const r = await requireSchedule(req(), '');
  ok(!r.ok && r.status === 503,
     'with no secret configured the scheduled door is open rather than absent');
  /* A short secret is not a secret. */
  process.env.KBYS_SCHEDULE_SECRET = 'short';
  const s = await requireSchedule(req({}, now(), nonce(), 'short'), '');
  ok(!s.ok, 'a secret under 32 characters was accepted');
}

process.env.KBYS_SCHEDULE_SECRET = SECRET;

/* ---- 2. Unsigned is refused ------------------------------------------- */
for (const drop of ['x-4orm-timestamp', 'x-4orm-nonce', 'x-4orm-signature']) {
  const r = req(); delete r.headers[drop];
  const out = await requireSchedule(r, '');
  ok(!out.ok && out.status === 401, 'a call with no ' + drop + ' was accepted');
}
{
  const out = await requireSchedule({ method: 'POST', url: '/api/retain', headers: {} }, '');
  ok(!out.ok, 'a call with no headers at all was accepted');
}

/* ---- 3. A wrong signature is refused, and compared in constant time --- */
{
  const out = await requireSchedule(req({ 'x-4orm-signature': 'sha256=' + '0'.repeat(64) }), '');
  ok(!out.ok && out.error === 'bad_signature', 'a forged signature was accepted');
  const other = await requireSchedule(req({}, now(), nonce(), 'j'.repeat(48)), '');
  ok(!other.ok, 'a signature minted with a different secret was accepted');

  const src = fs.readFileSync('api/_scheduled.js', 'utf8');
  ok(/timingSafeEqual/.test(src),
     'the signature is compared with a function that returns early, which leaks '
   + 'how many leading characters were right');
  ok(/createHash\('sha256'\)[\s\S]{0,200}timingSafeEqual/.test(src),
     'the constant-time compare is fed raw strings, so it still leaks the length');
}

/* ---- 4. The signature covers the request, not just the secret --------- */
{
  const ts = now(), n = nonce();
  const r = { method: 'POST', url: '/api/retain', headers: {
    'x-4orm-timestamp': String(ts), 'x-4orm-nonce': n,
    'x-4orm-signature': sign(SECRET, 'POST', '/api/some-other-route', ts, n, '') } };
  const out = await requireSchedule(r, '');
  ok(!out.ok, 'a signature minted for another path was accepted on this one');

  const r2 = req({}, ts, nonce(), SECRET, '');
  const out2 = await requireSchedule(r2, '{"purge":"everything"}');
  ok(!out2.ok, 'the signature does not cover the body, so a body can be swapped');
}

/* ---- 5. Stale, both directions ---------------------------------------- */
{
  const old = await requireSchedule(req({}, now() - (WINDOW_S + 60)), '');
  ok(!old.ok && old.error === 'stale', 'a signature from outside the window was accepted');
  const future = await requireSchedule(req({}, now() + (WINDOW_S + 60)), '');
  ok(!future.ok && future.error === 'stale',
     'a signature dated into the future was accepted, so one can be minted now and kept');
}

/* ---- 6. Once, and only once ------------------------------------------- */
{
  const r = req();
  const first = await requireSchedule(r, '');
  ok(first.ok, 'a correctly signed call was refused: ' + JSON.stringify(first));
  const again = await requireSchedule(r, '');
  ok(!again.ok && again.status === 409,
     'the same signed call ran twice, so anything that sees it once can replay it');
  const third = await requireSchedule(r, '');
  ok(!third.ok, 'a replay was refused once and allowed on the next attempt');
}

/* ---- 7. The route uses it, and still refuses an unsigned caller ------- */
{
  const src = fs.readFileSync('api/retain.js', 'utf8');
  ok(/requireSchedule\(/.test(src), 'api/retain.js no longer checks a scheduled signature');
  ok(/requireAdmin\(/.test(src), 'api/retain.js no longer accepts a signed-in operator');
  const gate = src.slice(src.indexOf('let auth'), src.indexOf('POSTGRES_URL'));
  ok(/if \(!sched\.ok\) return res\.status/.test(gate),
     'a failed schedule check does not stop the request');
  ok(/if \(!auth\.ok\) return res\.status/.test(gate),
     'a failed operator check does not stop the request');
  ok(!/purge_expired/.test(gate),
     'the route deletes before it has decided who is calling');
}

/* ---- 8. The ledger survives a database that has no table -------------- */
{
  const src = fs.readFileSync('api/_scheduled.js', 'utf8');
  ok(/on conflict do nothing/.test(src),
     'the replay ledger reads then writes, so two calls arriving together both pass');
  ok(/return null;\s*\/\* table missing/.test(src),
     'the replay ledger no longer falls back when its table is absent');
  ok(/seenPg === null \? memSeen/.test(src),
     'a database that cannot answer waves the call through instead of refusing it');
  ok(fs.readFileSync('db/spend.sql', 'utf8').includes('schedule_nonce'),
     'the replay ledger table is not in the migration');
}

if (fails.length) { console.error('schedcheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('schedcheck ok  signed, windowed ' + WINDOW_S + 's, single use, refuses on every failure');
