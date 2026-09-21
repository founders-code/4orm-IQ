/**
 * 4orm IQ - THE DOOR A SCHEDULER COMES IN BY
 *
 * Retention is the one job that has to run whether or not a person is at a
 * keyboard, and it is the one job that deletes. Those two facts together are
 * why this file is careful.
 *
 * The door is not a shared secret in a header. A bearer secret is replayable
 * by anything that ever sees it: a proxy log, a crash report, a screenshot of
 * a scheduler's configuration. What is accepted here is a SIGNATURE over the
 * request, valid for a few minutes, and usable once.
 *
 * The caller sends:
 *   X-4orm-Timestamp   seconds since the epoch
 *   X-4orm-Nonce       16 or more characters, unique per call
 *   X-4orm-Signature   sha256=<hex> of HMAC(secret, method + '\n' + path +
 *                      '\n' + timestamp + '\n' + nonce + '\n' + sha256(body))
 *
 * Four things are checked, and every one of them refuses on its own.
 *
 *   The secret is configured. Without KBYS_SCHEDULE_SECRET this door does not
 *   exist, rather than standing open.
 *
 *   The signature matches, compared in constant time. A comparison that
 *   returns early tells a caller how many leading characters were right, and
 *   enough calls turn that into the secret.
 *
 *   The timestamp is inside the window. A signature captured last week is not
 *   a signature for today.
 *
 *   The nonce has not been seen. Inside the window a signature is otherwise
 *   replayable as many times as the caller likes, and this route deletes.
 */

import crypto from 'crypto';

export const WINDOW_S = Math.max(30, Math.min(900,
  Number(process.env.KBYS_SCHEDULE_WINDOW_S) || 300));

/* Constant time, and it must not leak the length either: comparing digests
   rather than the raw strings makes both sides 32 bytes whatever arrived. */
function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a || '')).digest();
  const hb = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function sign(secret, method, path, ts, nonce, body) {
  const bodyHash = crypto.createHash('sha256')
    .update(typeof body === 'string' ? body : JSON.stringify(body || '')).digest('hex');
  const base = [String(method).toUpperCase(), String(path), String(ts),
                String(nonce), bodyHash].join('\n');
  return 'sha256=' + crypto.createHmac('sha256', String(secret)).update(base).digest('hex');
}

/* ------------------------------------------------------------------ *
 * THE REPLAY LEDGER
 *
 * Postgres where it is configured, memory where it is not. A nonce is kept
 * for twice the window and no longer: outside the window the timestamp check
 * has already refused the call, so keeping it is storage with no job.
 * ------------------------------------------------------------------ */
const MEM = new Map();
function memSeen(nonce, now) {
  for (const [k, t] of MEM) if (now - t > WINDOW_S * 2000) MEM.delete(k);
  if (MEM.has(nonce)) return true;
  MEM.set(nonce, now);
  return false;
}

async function pgSeen(nonce) {
  if (!process.env.POSTGRES_URL) return null;
  let client;
  try {
    const { default: pg } = await import('pg');
    client = new pg.Client({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000, query_timeout: 3000,
    });
    await client.connect();
    await client.query(
      `delete from schedule_nonce where at < now() - ($1::int * interval '1 second')`,
      [WINDOW_S * 2]);
    /* The unique constraint decides, not a read followed by a write: two
       calls arriving together would both read nothing and both proceed. */
    const r = await client.query(
      'insert into schedule_nonce (nonce) values ($1) on conflict do nothing returning nonce',
      [String(nonce).slice(0, 128)]);
    return r.rowCount === 0;
  } catch {
    return null;                       /* table missing or database down */
  } finally { if (client) { try { await client.end(); } catch {} } }
}

/**
 * Decide whether this request came from the scheduler.
 *
 * Returns { ok:true } or { ok:false, status, error }. It never throws, and it
 * never returns ok on a path it could not check.
 */
export async function requireSchedule(req, rawBody) {
  const secret = process.env.KBYS_SCHEDULE_SECRET;
  if (!secret || String(secret).length < 32)
    return { ok: false, status: 503, error: 'schedule_disabled' };

  const h = k => String(req.headers[k] || req.headers[k.toLowerCase()] || '').trim();
  const ts = Number(h('x-4orm-timestamp'));
  const nonce = h('x-4orm-nonce');
  const sig = h('x-4orm-signature');
  if (!ts || !nonce || !sig) return { ok: false, status: 401, error: 'not_signed' };
  if (nonce.length < 16 || nonce.length > 128)
    return { ok: false, status: 401, error: 'bad_nonce' };

  /* The window, both ways. A clock ahead of ours is as much a problem as a
     clock behind it, and a signature valid into the future is a signature
     somebody can mint now and keep. */
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > WINDOW_S)
    return { ok: false, status: 401, error: 'stale' };

  const path = String(req.url || '').split('?')[0];
  const want = sign(secret, req.method, path, ts, nonce, rawBody == null ? '' : rawBody);
  let matched = false;
  try { matched = sameSecret(sig, want); } catch { matched = false; }
  if (!matched) return { ok: false, status: 401, error: 'bad_signature' };

  /* Used once. Postgres decides where it can; where it cannot, the in-memory
     ledger decides on this instance, which is narrower than we would like and
     is still a refusal rather than a wave through. */
  const seenPg = await pgSeen(nonce);
  const seen = seenPg === null ? memSeen(nonce, Date.now()) : seenPg;
  if (seen) return { ok: false, status: 409, error: 'replayed' };

  return { ok: true, by: 'schedule', ledger: seenPg === null ? 'memory' : 'postgres' };
}
