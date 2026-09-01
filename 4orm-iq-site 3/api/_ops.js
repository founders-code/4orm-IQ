/**
 * 4orm IQ - THE OPERATIONS EVIDENCE LAYER
 *
 * Records the shape of every check, and chains the records so the count can be
 * proved rather than asserted.
 *
 * What is recorded: the type of identifier, the province, the declared purpose,
 * how the run ended, how the registers behaved, and a visitor-day.
 *
 * What is NOT recorded, and never will be: the identifier itself, the party a
 * check was about, or the result it returned. Do not add one. The reason is at
 * the top of db/telemetry.sql, and smoke20.mjs fails the build if a column with
 * one of those names appears.
 *
 * Storage must never be able to break a check. Every path here is wrapped and
 * returns a status rather than throwing. With POSTGRES_URL unset it is inert.
 */

import crypto from 'crypto';

let poolPromise = null;
async function pool() {
  if (!process.env.POSTGRES_URL) return null;
  if (!poolPromise) {
    poolPromise = (async () => {
      const { default: pg } = await import('pg');
      return new pg.Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false },
        max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 4000,
      });
    })().catch(() => null);
  }
  return poolPromise;
}

/**
 * A visitor-day. Salted, truncated, and rolled every midnight UTC.
 *
 * The salt is required. Without one, an IP address is recoverable from the hash
 * by trying four billion of them, which is minutes of compute, so an unsalted
 * version of this would be storing the IP with extra steps.
 */
export function visitorDay(req) {
  const salt = process.env.OPS_SALT;
  if (!salt) return null;          /* no salt, no visitor-day. Never a fallback. */
  const ip = String(
    req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || ''
  ).split(',')[0].trim();
  const ua = String(req.headers['user-agent'] || '');
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256')
    .update(day + '|' + salt + '|' + ip + '|' + ua)
    .digest('hex').slice(0, 12);
}

/* The canonical string a row is hashed over. Field order is fixed here and must
   never be reordered, because reordering it invalidates every hash ever written
   and there is no way to tell that apart from tampering. */
function canonical(r) {
  return [
    r.at, r.visitor_day || '', r.input_type, r.province || '', r.purpose, r.outcome,
    r.sources_planned, r.sources_ok, r.sources_failed, r.sources_out_of_scope,
    r.critical_failed, r.incomplete ? '1' : '0', r.suppressed_items, r.barred_items,
    r.duration_ms == null ? '' : r.duration_ms,
    r.policy_version || '', r.manifest_generated || '', r.enforcement_on ? '1' : '0',
  ].join('|');
}

export function rowHash(prevHash, r) {
  return crypto.createHash('sha256').update(prevHash + '|' + canonical(r)).digest('hex');
}

/**
 * Write one run. Returns {ok, seq, hash} or {ok:false, reason}.
 *
 * The chain head is read and advanced inside one transaction with the row
 * insert, and the head row is locked, so two checks landing in the same
 * millisecond cannot both build on the same predecessor and fork the chain.
 */
export async function recordRun(req, run) {
  const p = await pool();
  if (!p) return { ok: false, reason: 'no_database' };
  let client;
  try {
    client = await p.connect();
    await client.query('begin');
    const head = await client.query(
      "select height, head_hash from ops_chain where name='ops_runs' for update");
    if (!head.rows.length) { await client.query('rollback'); return { ok: false, reason: 'no_chain' }; }
    const prev = head.rows[0].head_hash;

    const r = {
      at: new Date().toISOString(),
      visitor_day: visitorDay(req),
      input_type: String(run.input_type || 'UNKNOWN'),
      province: run.province || null,
      purpose: String(run.purpose || 'UNDECLARED'),
      outcome: String(run.outcome || 'ERROR'),
      sources_planned: run.sources_planned | 0,
      sources_ok: run.sources_ok | 0,
      sources_failed: run.sources_failed | 0,
      sources_out_of_scope: run.sources_out_of_scope | 0,
      critical_failed: run.critical_failed | 0,
      incomplete: !!run.incomplete,
      suppressed_items: run.suppressed_items | 0,
      barred_items: run.barred_items | 0,
      duration_ms: run.duration_ms == null ? null : run.duration_ms | 0,
      policy_version: run.policy_version || null,
      manifest_generated: run.manifest_generated || null,
      enforcement_on: run.enforcement_on !== false,
    };
    const hash = rowHash(prev, r);

    const ins = await client.query(
      `insert into ops_runs
        (at, prev_hash, row_hash, visitor_day, input_type, province, purpose, outcome,
         sources_planned, sources_ok, sources_failed, sources_out_of_scope, critical_failed,
         incomplete, suppressed_items, barred_items, duration_ms,
         policy_version, manifest_generated, enforcement_on)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       returning seq`,
      [r.at, prev, hash, r.visitor_day, r.input_type, r.province, r.purpose, r.outcome,
       r.sources_planned, r.sources_ok, r.sources_failed, r.sources_out_of_scope,
       r.critical_failed, r.incomplete, r.suppressed_items, r.barred_items, r.duration_ms,
       r.policy_version, r.manifest_generated, r.enforcement_on]);

    await client.query(
      "update ops_chain set height=height+1, head_hash=$1, updated_at=now() where name='ops_runs'",
      [hash]);
    await client.query('commit');
    return { ok: true, seq: Number(ins.rows[0].seq), hash };
  } catch (e) {
    if (client) { try { await client.query('rollback'); } catch {} }
    return { ok: false, reason: String(e.message || e).slice(0, 120) };
  } finally {
    if (client) client.release();
  }
}

/** Roll one register's result into the per-day source health table. */
export async function recordSource(sourceId, status, ms) {
  const p = await pool();
  if (!p) return { ok: false };
  const col = { ok: 'ok', no_match: 'no_match', failed: 'failed',
                timed_out: 'timed_out', out_of_scope: 'out_of_scope' }[status];
  if (!col) return { ok: false, reason: 'bad_status' };
  try {
    await p.query(
      `insert into ops_source_day (day, source_id, attempts, ${col}, p50_ms)
       values (current_date, $1, 1, 1, $2)
       on conflict (day, source_id) do update
         set attempts = ops_source_day.attempts + 1,
             ${col}   = ops_source_day.${col} + 1,
             p50_ms   = coalesce((ops_source_day.p50_ms + excluded.p50_ms)/2, excluded.p50_ms)`,
      [String(sourceId).slice(0, 200), ms == null ? null : ms | 0]);
    return { ok: true };
  } catch { return { ok: false }; }
}

/**
 * Walk the chain and report whether it is intact.
 *
 * Streamed in pages rather than loaded whole, because this has to keep working
 * when the log is large, and a verification that runs out of memory is a
 * verification nobody runs.
 */
export async function verifyChain(limit) {
  const p = await pool();
  if (!p) return { ok: false, reason: 'no_database' };
  const t0 = Date.now();
  try {
    const head = await p.query("select height, head_hash from ops_chain where name='ops_runs'");
    let prev = '0'.repeat(64), checked = 0, brokenAt = null, last = prev;
    const page = 2000;
    let after = 0;
    for (;;) {
      const rows = (await p.query(
        `select seq, at, prev_hash, row_hash, visitor_day, input_type, province, purpose, outcome,
                sources_planned, sources_ok, sources_failed, sources_out_of_scope, critical_failed,
                incomplete, suppressed_items, barred_items, duration_ms,
                policy_version, manifest_generated, enforcement_on
           from ops_runs where seq > $1 order by seq asc limit $2`, [after, page])).rows;
      if (!rows.length) break;
      for (const row of rows) {
        const r = Object.assign({}, row, {
          at: new Date(row.at).toISOString(),
          manifest_generated: row.manifest_generated
            ? new Date(row.manifest_generated).toISOString().slice(0, 10) : null,
        });
        const want = rowHash(prev, r);
        if (row.prev_hash !== prev || row.row_hash !== want) { brokenAt = Number(row.seq); break; }
        prev = row.row_hash; last = prev; checked++;
        after = Number(row.seq);
      }
      if (brokenAt) break;
      if (limit && checked >= limit) break;
    }
    const intact = brokenAt === null;
    const h = head.rows[0] || {};
    const result = {
      ok: true, intact, checked, broken_at: brokenAt,
      height: Number(h.height || 0), head_hash: h.head_hash || null,
      computed_head: last,
      head_matches: !brokenAt && h.head_hash === last,
      ms: Date.now() - t0,
    };
    try {
      await p.query(
        'insert into ops_verify (height, head_hash, intact, broken_at, ms) values ($1,$2,$3,$4,$5)',
        [result.height, result.head_hash || '', intact && result.head_matches, brokenAt, result.ms]);
    } catch {}
    return result;
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 120) };
  }
}
