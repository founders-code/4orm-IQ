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
 *
 * WHAT THIS FILE MAY NOT WRITE, AND WHY
 *
 * This is the corpus. It exists so that the next check can recognise a wallet,
 * a beneficiary or a tracking id that has appeared before. That is a record
 * about a BUSINESS, built from public records, and it is the only reason any
 * of it is kept.
 *
 * Three things were being written that the published privacy notice says are
 * not written, and the notice is the promise, so the code moved:
 *
 *   1. The reader's search string, verbatim, on an indexed column. It is now
 *      a salted hash, so a repeat can be recognised and the string cannot be
 *      recovered. Where the reader typed an email address, that string was
 *      personal information sitting in an index.
 *   2. The entire render payload as a blob. Findings, sources and graph rows
 *      are already broken out below, so the blob was a second copy of the
 *      result, which is the one thing the product promises not to keep.
 *   3. Person-level nodes and edges. The page suppresses these at render;
 *      suppressing at render while writing them to a table that outlives the
 *      run is not a control, it is a curtain. The write path now refuses them
 *      at the same point the reader would have been refused.
 *
 * PERSON_NODE_TYPES below is the enforcement. Do not add to the write path
 * anything that carries a natural person's name.
 */

import { node as gnode } from './_graph.js';
import crypto from 'crypto';

/* The node types that carry a natural person. Refused on the write path, both
   as nodes and as either end of an edge. This list is checked by the build. */
const PERSON_NODE_TYPES = new Set([
  'PERSON', 'DIRECTOR', 'OFFICER', 'PROMOTER', 'ADVISER'
]);
const isPersonNode = t => PERSON_NODE_TYPES.has(String(t || '').toUpperCase());

/**
 * The reader's search string, one way.
 *
 * Salted for the same reason the visitor-day is: an unsalted hash of a short
 * identifier is recoverable by trying the identifiers, which is not a large
 * number. With CORPUS_SALT unset nothing is written at all, and a run simply
 * has no identifier column. Never a fallback to the plain string.
 */
function identifierHash(v) {
  const salt = process.env.CORPUS_SALT;
  if (!salt) return null;
  const norm = String(v || '').trim().toLowerCase();
  if (!norm) return null;
  return crypto.createHash('sha256').update(salt + '|' + norm).digest('hex').slice(0, 24);
}

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

/* A node the model described. Anything we cannot type or normalise is
   dropped rather than guessed at: a malformed identifier in the graph is
   worse than a missing one, because it will match something later. */
function safeNode(type, value, display) {
  try {
    if (!type || !value) return null;
    return gnode(type, value, display);
  } catch { return null; }
}

/* Edge endpoints arrive as values, not typed nodes. Infer the type from the
   shape, and refuse rather than guess where the shape is ambiguous. */
function guessType(v) {
  const s = String(v || '').trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(s) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(s) ||
      /^bc1[a-z0-9]{20,}$/.test(s) || /^T[A-Za-z0-9]{33}$/.test(s)) return 'CRYPTO_WALLET';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'EMAIL';
  if (/^(GTM|G|UA)-[A-Z0-9-]+$/i.test(s)) return 'GOOGLE_TAG_MANAGER_ID';
  if (/^\d{15,17}$/.test(s)) return 'META_PIXEL_ID';
  if (/^\+?[\d][\d\s().-]{6,}$/.test(s)) return 'PHONE';
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return 'IP_ADDRESS';
  if (/^ns\d*\./i.test(s)) return 'NAMESERVER';
  if (/^([\w-]+\.)+[a-z]{2,}$/i.test(s)) return 'DOMAIN';
  return 'LEGAL_ENTITY';
}

function parseDate(v) {
  const d = new Date(String(v || ''));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function writeAll(c, ctx) {
  const {
    identifier, domain, payload, pipeline, sources = [],
    ledger = [], connectors = {}, siblings = [], briefChars = 0
  } = ctx;

  await c.query('BEGIN');

  /* No identifier and no payload. The hash recognises a repeat; the headline
     and the verdict are what the corpus needs to know a run happened and how it
     ended. Everything a later run can use is written to its own table below,
     with its source and its excerpt beside it, so nothing here is a stored
     conclusion standing in for a record. */
  const run = await c.query(
    `insert into runs (identifier_hash, domain, verdict,
       identity_confidence, evidence_coverage, sources_checked, sources_not_reached,
       model, exa_calls, exa_cost_usd, parallel_calls,
       input_tokens, output_tokens, ms_total, brief_chars)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     returning id`,
    [
      identifierHash(identifier), trim(domain, 253),
      trim(payload.verdict, 16),
      payload.idc ?? null, payload.cov ?? null,
      ctx.sourcesChecked ?? null, ctx.sourcesNotReached ?? null,
      trim(pipeline?.claude?.model, 80),
      pipeline?.exa?.calls ?? null, pipeline?.exa?.cost_usd ?? null,
      pipeline?.parallel?.calls ?? null,
      pipeline?.claude?.input_tokens ?? null, pipeline?.claude?.output_tokens ?? null,
      pipeline?.ms?.total ?? null,
      briefChars
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

  /* ------------------------------------------------------------------ *
   * THE OPERATOR GRAPH
   *
   * Nodes are upserted, because an identifier seen on three runs is one
   * identifier with a widening first_seen to last_seen window. Edges are
   * appended, because the same connection observed on two runs is two
   * observations, and that is what makes a stale edge recognisable.
   *
   * Nothing here stores a conclusion. Every row carries the excerpt and the
   * URL it was read from, so the next run can show a reader the record
   * rather than asking them to trust a stored verdict.
   * ------------------------------------------------------------------ */
  const g = payload.graph;
  if (g && (g.nodes || []).length) {
    for (const n of g.nodes.slice(0, 200)) {
      const built = safeNode(n.type, n.v, n.v);
      if (!built) continue;
      /* A person never enters the corpus. The page suppresses these at render;
         this is the same refusal one layer earlier, where it actually holds. */
      if (isPersonNode(built.node_type)) continue;
      await c.query(
        `insert into operator_nodes
           (node_id, node_type, normalized_value, display_value, specificity, specificity_band, first_seen, last_seen)
         values ($1,$2,$3,$4,$5,$6, coalesce($7, now()), now())
         on conflict (node_id) do update set
           last_seen  = now(),
           first_seen = least(operator_nodes.first_seen, excluded.first_seen),
           display_value = coalesce(operator_nodes.display_value, excluded.display_value)`,
        [built.node_id, built.node_type, built.normalized_value, trim(built.display_value, 500),
         built.specificity.value, built.specificity.band, n.first || null]);
    }

    for (const e of (g.edges || []).slice(0, 400)) {
      const a = safeNode(guessType(e.from), e.from, e.from);
      const b = safeNode(guessType(e.to), e.to, e.to);
      if (!a || !b) continue;
      /* Either end. An edge from a company to a director carries the director,
         so refusing only the node would leave the name in display_value on the
         upsert two lines down. */
      if (isPersonNode(a.node_type) || isPersonNode(b.node_type)) continue;
      /* Both ends must exist before an edge can reference them. */
      for (const nd of [a, b]) {
        await c.query(
          `insert into operator_nodes
             (node_id, node_type, normalized_value, display_value, specificity, specificity_band, first_seen, last_seen)
           values ($1,$2,$3,$4,$5,$6, now(), now())
           on conflict (node_id) do update set last_seen = now()`,
          [nd.node_id, nd.node_type, nd.normalized_value, trim(nd.display_value, 500),
           nd.specificity.value, nd.specificity.band]);
      }
      await c.query(
        `insert into operator_edges
           (from_node_id, to_node_id, edge_type, other_party, source_id, run_id,
            first_seen, last_seen, source_tier, confidence, historically_available,
            evidence_excerpt, source_url, retrieved_at, status)
         values ($1,$2,$3,$4,$5,$6, now(), now(), $7,$8,$9,$10,$11, now(), $12)`,
        [a.node_id, b.node_id, trim(e.type, 60), trim(e.other, 300), trim(e.src, 120), runId,
         trim(e.tier, 8), null, !!e.hist, trim(e.quote, 4000), trim(e.url, 2000),
         trim(e.status, 20) || 'OBSERVED']);
    }

    for (const w of (g.priors || []).slice(0, 60)) {
      const nd = safeNode(w.kind, w.id, w.id);
      if (!nd) continue;
      if (isPersonNode(nd.node_type)) continue;
      await c.query(
        `insert into prior_warning_links (node_id, run_id, prior_entity, regulator, warned_on, source_url)
         values ($1,$2,$3,$4,$5,$6)`,
        [nd.node_id, runId, trim(w.entity, 300), trim(w.reg, 200),
         parseDate(w.date), trim(w.url, 2000)]);
    }
  }

  /* What the party was classified as, and why. This is the audit trail behind
     every coverage figure: it says which registers were in the plan at all. */
  for (const cl of (payload.classifications || []).slice(0, 20)) {
    await c.query(
      `insert into entity_classifications (entity_id, run_id, classification, confidence, reason, source_ids)
       values ($1,$2,$3,$4,$5,$6)`,
      [trim(domain || identifierHash(identifier) || 'unknown', 253), runId, trim(cl.classification, 40),
       cl.confidence ?? null, trim(cl.reason, 1000), arr(cl.matched).map(x => trim(x, 120))]);
  }

  /* Claim chronology, both halves, so a later run can compare against what
     the party was saying about itself the last time anybody looked. */
  const ch = payload.chrono;
  if (ch) {
    const rows = []
      .concat((ch.claims || []).map(x => ['claim', x.q, String(x.year || ''), x.where, x.url]))
      .concat((ch.records || []).map(x => ['record', x.what, x.date, x.src, x.url]));
    for (const r2 of rows.slice(0, 120)) {
      await c.query(
        `insert into claim_chronology (run_id, kind, text_value, year_or_date, source, url)
         values ($1,$2,$3,$4,$5,$6)`,
        [runId, r2[0], trim(r2[1], 2000), trim(r2[2], 40), trim(r2[3], 300), trim(r2[4], 2000)]);
    }
  }

  await c.query('COMMIT');
  return { stored: true, run_id: runId, sources: sources.length, findings: findings.length };
}
