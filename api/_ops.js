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

/* ------------------------------------------------------------------ *
 * THE CANONICAL STRING, AND WHY IT IS VERSIONED
 *
 * A row's hash is taken over a fixed list of its fields in a fixed order.
 * Reorder that list, or add a field to it, and every hash ever written stops
 * matching, which is indistinguishable from somebody having altered the log.
 *
 * That is a trap, because the recorded fields have to be able to grow. So each
 * row carries the name of the canonical function that produced its hash, and
 * the verifier picks the function by what the row says rather than by what the
 * current code happens to do. A row written under v1 verifies under v1 forever.
 *
 * The rules:
 *   - An existing version is FROZEN. Never edit one. Not to fix a typo.
 *   - A new field means a new version, appended, and HASH_SCHEMA moves to it.
 *   - Nothing is ever removed from CANON.
 *
 * This is also why a rule change does not touch a hash. A row commits to WHICH
 * policy governed it, by version string, and never to what that policy said.
 * The policy's own contents live in ops_policy, chained separately, so rules
 * can change as often as they need to without disturbing a single run.
 * ------------------------------------------------------------------ */

const CANON = {
  /* v1: the original eighteen fields, 2026-08-31. Frozen. */
  v1: r => [
    r.at, r.visitor_day || '', r.input_type, r.province || '', r.purpose, r.outcome,
    r.sources_planned, r.sources_ok, r.sources_failed, r.sources_out_of_scope,
    r.critical_failed, r.incomplete ? '1' : '0', r.suppressed_items, r.barred_items,
    r.duration_ms == null ? '' : r.duration_ms,
    r.policy_version || '', r.manifest_generated || '', r.enforcement_on ? '1' : '0',
  ].join('|'),

  /* v2: adds the sector a check was run under, appended so v1 stays intact. */
  v2: r => [
    r.at, r.visitor_day || '', r.input_type, r.province || '', r.purpose, r.outcome,
    r.sources_planned, r.sources_ok, r.sources_failed, r.sources_out_of_scope,
    r.critical_failed, r.incomplete ? '1' : '0', r.suppressed_items, r.barred_items,
    r.duration_ms == null ? '' : r.duration_ms,
    r.policy_version || '', r.manifest_generated || '', r.enforcement_on ? '1' : '0',
    r.sector || '',
  ].join('|'),
};

/** The version new rows are written under. Moving this is a deliberate act. */
export const HASH_SCHEMA = 'v2';

export function rowHash(prevHash, r, schema) {
  const fn = CANON[schema || HASH_SCHEMA];
  /* An unknown marker must not fall back to the current version, because that
     would silently re-hash an old row under new rules and report the log as
     broken. It is a verification failure, and it says so. */
  if (!fn) throw new Error('unknown hash schema: ' + String(schema));
  return crypto.createHash('sha256').update(prevHash + '|' + fn(r)).digest('hex');
}

export function hashSchemas() { return Object.keys(CANON); }

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
      sector: run.sector || null,
    };
    const hash = rowHash(prev, r, HASH_SCHEMA);

    const ins = await client.query(
      `insert into ops_runs
        (at, prev_hash, row_hash, hash_schema, visitor_day, input_type, province, purpose, outcome,
         sources_planned, sources_ok, sources_failed, sources_out_of_scope, critical_failed,
         incomplete, suppressed_items, barred_items, duration_ms,
         policy_version, manifest_generated, enforcement_on, sector)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       returning seq`,
      [r.at, prev, hash, HASH_SCHEMA, r.visitor_day, r.input_type, r.province, r.purpose, r.outcome,
       r.sources_planned, r.sources_ok, r.sources_failed, r.sources_out_of_scope,
       r.critical_failed, r.incomplete, r.suppressed_items, r.barred_items, r.duration_ms,
       r.policy_version, r.manifest_generated, r.enforcement_on, r.sector]);

    await client.query(
      "update ops_chain set height=height+1, head_hash=$1, updated_at=now() where name='ops_runs'",
      [hash]);
    await client.query('commit');
    return { ok: true, seq: Number(ins.rows[0].seq), hash, schema: HASH_SCHEMA };
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
        `select seq, at, prev_hash, row_hash, hash_schema, visitor_day, input_type, province,
                purpose, outcome,
                sources_planned, sources_ok, sources_failed, sources_out_of_scope, critical_failed,
                incomplete, suppressed_items, barred_items, duration_ms,
                policy_version, manifest_generated, enforcement_on, sector
           from ops_runs where seq > $1 order by seq asc limit $2`, [after, page])).rows;
      if (!rows.length) break;
      for (const row of rows) {
        const r = Object.assign({}, row, {
          at: new Date(row.at).toISOString(),
          manifest_generated: row.manifest_generated
            ? new Date(row.manifest_generated).toISOString().slice(0, 10) : null,
        });
        /* Verify the row under the schema the row itself names. Rows written
           before the marker existed are v1, which is what they were. */
        let want;
        try { want = rowHash(prev, r, row.hash_schema || 'v1'); }
        catch (e) { brokenAt = Number(row.seq); break; }
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

/* ==================================================================== *
 * THE POLICY RECORD
 *
 * Every run row commits to a policy VERSION, never to what that policy said.
 * That separation is what lets a rule change without disturbing a single hash
 * already written. It also leaves the version string pointing at nothing
 * unless the policy itself is recorded, which is what this is.
 *
 * One chained row per rule change. What changed, why, when it took effect, a
 * digest of the enabled source list at that moment, and the evidence for the
 * change. Chained on the same pattern as the runs, in its own chain, so the
 * two can be verified and retired independently.
 *
 * A regulator asking "under what rules was this check run, and who decided
 * that" is answered by one row here plus the version on the run.
 * ==================================================================== */

/** The digest of a source list. Order independent, so a reordered register is
 *  not reported as a rule change and a genuinely changed one always is. */
export function sourceDigest(names) {
  const list = (Array.isArray(names) ? names : []).map(String).sort();
  return crypto.createHash('sha256').update(list.join('\n')).digest('hex');
}

function policyCanonical(r) {
  return [
    r.at, r.version, r.effective_from || '', r.manifest_generated || '',
    r.sources_total, r.sources_enabled, r.source_digest,
    r.enforcement_on ? '1' : '0', r.change_kind, r.summary || '',
    r.reason || '', r.evidence_url || '', r.author || '',
  ].join('|');
}

export function policyHash(prevHash, r) {
  return crypto.createHash('sha256')
    .update(prevHash + '|' + policyCanonical(r)).digest('hex');
}

/**
 * Record one rule change. Returns {ok, seq, hash} or {ok:false, reason}.
 *
 * Writing the same version twice with the same content is not an error and not
 * a new row: a deploy that changed no rule must not manufacture a rule change,
 * or the history stops meaning anything. Same version with DIFFERENT content is
 * refused outright, because a version that quietly changed underneath a run
 * that cites it is the one failure this table exists to make impossible.
 */
export async function recordPolicy(policy) {
  const p = await pool();
  if (!p) return { ok: false, reason: 'no_database' };
  let client;
  try {
    client = await p.connect();
    await client.query('begin');
    const head = await client.query(
      "select height, head_hash from ops_chain where name='ops_policy' for update");
    if (!head.rows.length) { await client.query('rollback'); return { ok: false, reason: 'no_chain' }; }
    const prev = head.rows[0].head_hash;

    const digest = policy.source_digest || sourceDigest(policy.sources || []);
    const existing = await client.query(
      'select seq, source_digest, enforcement_on, row_hash from ops_policy where version=$1 order by seq desc limit 1',
      [String(policy.version || '')]);
    if (existing.rows.length) {
      const e = existing.rows[0];
      const same = e.source_digest === digest
                && !!e.enforcement_on === (policy.enforcement_on !== false);
      await client.query('rollback');
      return same
        ? { ok: true, seq: Number(e.seq), hash: e.row_hash, unchanged: true }
        : { ok: false, reason: 'version_reused_with_different_rules' };
    }

    const r = {
      at: new Date().toISOString(),
      version: String(policy.version || ''),
      effective_from: policy.effective_from || new Date().toISOString().slice(0, 10),
      manifest_generated: policy.manifest_generated || null,
      sources_total: policy.sources_total | 0,
      sources_enabled: policy.sources_enabled | 0,
      source_digest: digest,
      enforcement_on: policy.enforcement_on !== false,
      change_kind: String(policy.change_kind || 'UPDATE'),
      summary: policy.summary || null,
      reason: policy.reason || null,
      evidence_url: policy.evidence_url || null,
      author: policy.author || null,
    };
    if (!r.version) { await client.query('rollback'); return { ok: false, reason: 'no_version' }; }
    const hash = policyHash(prev, r);

    const ins = await client.query(
      `insert into ops_policy
        (at, prev_hash, row_hash, version, effective_from, manifest_generated,
         sources_total, sources_enabled, source_digest, enforcement_on,
         change_kind, summary, reason, evidence_url, author)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning seq`,
      [r.at, prev, hash, r.version, r.effective_from, r.manifest_generated,
       r.sources_total, r.sources_enabled, r.source_digest, r.enforcement_on,
       r.change_kind, r.summary, r.reason, r.evidence_url, r.author]);

    await client.query(
      "update ops_chain set height=height+1, head_hash=$1, updated_at=now() where name='ops_policy'",
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

/** The rule history, newest first. What a reader needs to answer "which rule
 *  was in force when you looked, and what changed since". */
export async function policyHistory(limit) {
  const p = await pool();
  if (!p) return { ok: false, reason: 'no_database' };
  try {
    const rows = (await p.query(
      `select seq, at, version, effective_from, manifest_generated, sources_total,
              sources_enabled, source_digest, enforcement_on, change_kind,
              summary, reason, evidence_url, author, row_hash
         from ops_policy order by seq desc limit $1`, [Math.min(limit || 50, 200)])).rows;
    const h = (await p.query(
      "select height, head_hash from ops_chain where name='ops_policy'")).rows[0] || {};
    return { ok: true, height: Number(h.height || 0), head: h.head_hash || null, rows };
  } catch (e) { return { ok: false, reason: String(e.message || e).slice(0, 120) }; }
}

/** Walk the policy chain. Same contract as verifyChain, its own chain. */
export async function verifyPolicyChain() {
  const p = await pool();
  if (!p) return { ok: false, reason: 'no_database' };
  const t0 = Date.now();
  try {
    const head = await p.query("select height, head_hash from ops_chain where name='ops_policy'");
    const rows = (await p.query(
      `select seq, at, prev_hash, row_hash, version, effective_from, manifest_generated,
              sources_total, sources_enabled, source_digest, enforcement_on,
              change_kind, summary, reason, evidence_url, author
         from ops_policy order by seq asc`)).rows;
    let prev = '0'.repeat(64), checked = 0, brokenAt = null, last = prev;
    for (const row of rows) {
      const r = Object.assign({}, row, {
        at: new Date(row.at).toISOString(),
        effective_from: row.effective_from
          ? new Date(row.effective_from).toISOString().slice(0, 10) : null,
        manifest_generated: row.manifest_generated
          ? new Date(row.manifest_generated).toISOString().slice(0, 10) : null,
      });
      const want = policyHash(prev, r);
      if (row.prev_hash !== prev || row.row_hash !== want) { brokenAt = Number(row.seq); break; }
      prev = row.row_hash; last = prev; checked++;
    }
    const h = head.rows[0] || {};
    return {
      ok: true, intact: brokenAt === null, checked, broken_at: brokenAt,
      height: Number(h.height || 0), head_hash: h.head_hash || null,
      computed_head: last, head_matches: !brokenAt && h.head_hash === last,
      ms: Date.now() - t0,
    };
  } catch (e) { return { ok: false, reason: String(e.message || e).slice(0, 120) }; }
}
