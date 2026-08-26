/**
 * 4orm - Know Before You Send
 * The write side.
 *
 * Records every run. Reads nothing back. Storage must never be able to break
 * a check, so every path here is wrapped, bounded by a timeout, and returns a
 * status rather than throwing. If the database is missing, misconfigured or
 * slow, the check still returns and the payload says storage was skipped.
 *
 * Set POSTGRES_URL on the project. With it unset this file is inert.
 */

let poolPromise = null;

async function pool() {
  if (!process.env.POSTGRES_URL) return null;
  if (!poolPromise) {
    poolPromise = (async () => {
      const { default: pg } = await import('pg');
      return new pg.Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false },
        max: 2,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 4_000
      });
    })().catch(() => null);
  }
  return poolPromise;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))
  ]);
}

const arr = v => (Array.isArray(v) ? v : v ? [v] : []);
const trim = (v, n) => (v == null ? null : String(v).slice(0, n));

/**
 * Write one run and everything under it.
 * Returns { stored: true, run_id } or { stored: false, reason }.
 */
export async function recordRun(ctx) {
  const p = await pool();
  if (!p) return { stored: false, reason: 'no_database' };

  let client;
  try {
    client = await withTimeout(p.connect(), 4000, 'connect');
  } catch (e) {
    return { stored: false, reason: e.message };
  }

  try {
    return await withTimeout(writeAll(client, ctx), 8000, 'write');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* already gone */ }
    return { stored: false, reason: e.message };
  } finally {
    client.release();
  }
}

async function writeAll(c, ctx) {
  const {
    identifier, domain, payload, pipeline, sources = [],
    ledger = [], connectors = {}, siblings = [], briefChars = 0
  } = ctx;

  await c.query('BEGIN');

  const run = await c.query(
    `insert into runs (identifier, domain, verdict, headline,
       identity_confidence, evidence_coverage, sources_checked, sources_not_reached,
       model, exa_calls, exa_cost_usd, parallel_calls,
       input_tokens, output_tokens, ms_total, payload, brief_chars)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     returning id`,
    [
      trim(identifier, 200), trim(domain, 253),
      trim(payload.verdict, 16), trim(payload.headline, 300),
      payload.idc ?? null, payload.cov ?? null,
      ctx.sourcesChecked ?? null, ctx.sourcesNotReached ?? null,
      trim(pipeline?.claude?.model, 80),
      pipeline?.exa?.calls ?? null, pipeline?.exa?.cost_usd ?? null,
      pipeline?.parallel?.calls ?? null,
      pipeline?.claude?.input_tokens ?? null, pipeline?.claude?.output_tokens ?? null,
      pipeline?.ms?.total ?? null,
      JSON.stringify(payload), briefChars
    ]
  );
  const runId = run.rows[0].id;

  /* Retrieved sources. One insert, many rows. */
  if (sources.length) {
    const vals = [], params = [];
    sources.slice(0, 400).forEach((s, i) => {
      const b = i * 8;
      vals.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`);
      params.push(runId, trim(s.tier, 20), trim(s.label, 200),
        trim(s.registers?.[0] || null, 80), trim(s.host, 253),
        trim(s.url, 2000), trim(s.title, 500), trim(s.snippet, 1200));
    });
    await c.query(
      `insert into run_sources (run_id, tier, label, register, host, url, title, snippet)
       values ${vals.join(',')}`, params);
  }

  /* Review sweep ledger. */
  if (ledger.length) {
    const vals = [], params = [];
    ledger.forEach((r, i) => {
      const b = i * 5;
      vals.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5})`);
      params.push(runId, trim(r.platform, 120), trim(r.host, 253), !!r.searched, r.pages || 0);
    });
    await c.query(
      `insert into review_sweep (run_id, platform, host, searched, pages)
       values ${vals.join(',')}`, params);
  }

  /* Findings, kept out of the blob so an adverse result survives on its own. */
  const findings = [];
  (payload.issues || []).forEach(i => findings.push(
    ['issue', null, i.t, i.x, i.sev, i.tier, null, null, null]));
  (payload.claims || []).forEach(cl => findings.push(
    ['claim', null, cl.q, cl.r, null, null, cl.v, cl.s, null]));
  if (findings.length) {
    const vals = [], params = [];
    findings.slice(0, 200).forEach((f, i) => {
      const b = i * 10;
      vals.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`);
      params.push(runId, f[0], trim(f[1], 40), trim(f[2], 500), trim(f[3], 4000),
        trim(f[4], 20), trim(f[5], 4), trim(f[6], 16), trim(f[7], 300), trim(f[8], 2000));
    });
    await c.query(
      `insert into findings (run_id, kind, category, title, detail, severity, tier, result, source, url)
       values ${vals.join(',')}`, params);
  }

  /* Domain facts. Upsert: creation dates do not change, so the first write
     is the authoritative one and later runs only move last_seen. */
  const r = connectors.records?.rdap;
  const m = connectors.records?.mail;
  if (domain && r?.status === 'found') {
    await c.query(
      `insert into domain_facts (domain, created_date, age_days, registrar, nameservers, mx, spf, raw)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (domain) do update set
         last_seen   = now(),
         registrar   = coalesce(domain_facts.registrar, excluded.registrar),
         nameservers = excluded.nameservers,
         mx          = excluded.mx,
         spf         = coalesce(excluded.spf, domain_facts.spf)`,
      [domain, trim(r.created, 40), r.age_days ?? null, trim(r.registrar, 300),
       arr(r.nameservers).map(x => trim(x, 253)),
       arr(m?.mx).map(x => trim(x, 253)), trim(m?.spf, 500),
       JSON.stringify({ rdap: r, mail: m })]
    );
  }

  /* The infrastructure graph. Undirected, so store one canonical direction. */
  for (const s of siblings.slice(0, 20)) {
    if (!domain || !s.domain) continue;
    const [a, b] = [domain, s.domain].sort();
    await c.query(
      `insert into infra_edges (domain_a, domain_b, shared_nameservers, same_registrar)
       values ($1,$2,$3,$4)
       on conflict (domain_a, domain_b) do update set
         last_seen = now(),
         shared_nameservers = excluded.shared_nameservers,
         same_registrar = excluded.same_registrar`,
      [a, b, arr(s.shared_nameservers).map(x => trim(x, 253)), !!s.same_registrar]
    );
  }

  await c.query('COMMIT');
  return { stored: true, run_id: runId, sources: sources.length, findings: findings.length };
}
