/**
 * 4orm - Know Before You Send
 * POST /api/check   { "q": "<identifier>" }  ->  the console's render payload
 *
 * Three tiers, in this order:
 *
 *   0  CONNECTORS  free, certain, milliseconds. RDAP and mail configuration.
 *                  When one returns you know you reached it, so coverage is
 *                  counted rather than estimated.
 *   1  EXA         broad semantic retrieval, pinned to register domains.
 *   2  PARALLEL    objective-driven multi-query research with cited excerpts,
 *                  for the questions no single page answers.
 *   3  CLAUDE      the contradiction engine. No search tool. It reads what the
 *                  first three tiers found, cross-examines it, and emits the
 *                  payload against a forced schema.
 *
 * Retrieval is cheap and parallel. Judgment is the only expensive call, and it
 * happens once.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SEARCH_CUE, OUTPUT_INSTRUCTION } from './_cue.js';
import { PAYLOAD_SCHEMA } from './_schema.js';
import { runConnectors, siblingCheck } from './_connectors.js';
import { exa, parallel, plan, planRound2, extractSeeds, REVIEW_HOSTS, ALL_CATS } from './_retrieval.js';
import { retrievedSources, reachedBoard, searchedBoard, applicabilityBoard, overlayBoard, reviewLedger } from './_registers.js';
import { classify, jurisdictions } from './_classify.js';
import { applicable, TOTAL_SOURCES, BY_NAME } from './_catalogue.js';
import { recordRun } from './_store.js';
/* Two write sides, and the difference between them is the whole architecture.
   _store.js holds entity-level identifiers so the operator graph can say
   "seen before". _ops.js holds the shape of the run and nothing that names a
   party, and it is chained so the counter can be proved. Neither one may grow
   into the other. */
import { recordRun as recordOps, recordSource, recordPolicy } from './_ops.js';
import { recordRegister, classifyForRegister } from './_register.js';
import { POLICY } from './_policy.js';

/* The version of the rules a run cites. It lives in _policy.js beside the rules
   themselves, so the row and the rule record can never disagree about which
   rules governed a check. A log that cannot answer "what were the rules that
   day" is a log nobody can audit. */
const OPS_POLICY_VERSION = POLICY.version;

/* The rule record is written once per cold start, not once per check. Writing
   the same version with the same rules is not a change and makes no row, so
   this is idempotent by design rather than by us remembering. A deploy that
   changed no rule leaves no trace here, which is what makes the rows that do
   exist worth reading. */
let policyRecorded = null;
function ensurePolicyRecorded() {
  if (!policyRecorded) {
    policyRecorded = recordPolicy(POLICY).catch(e => ({ ok: false, reason: String(e && e.message || e) }));
  }
  return policyRecorded;
}

/* The SHAPE of the identifier, never the identifier. This is the only thing
   about the query that reaches the operations log, and the four values are the
   four the box accepts. */
function opsInputType(q, domain) {
  const v = String(q || '').trim();
  if (/^(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{20,}|T[A-Za-z0-9]{33})$/.test(v))
    return 'WALLET';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'EMAIL';
  if (domain || /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v)) return 'WEBSITE';
  return 'COMPANY';
}

export const config = { maxDuration: 300 };

const MODEL     = process.env.KBYS_MODEL || 'claude-sonnet-5';
/* Written by tools/stamp.mjs. Returned on every response so the function's
   build can be compared with the page's. */
const BUILD = '20260905.0623';
const MAX_INPUT = 200;
/* The plan is now routed, so a crypto fund builds a longer sweep than a
   plumber. The clamp had to move with it, and the plan is priority ordered so
   that when the clamp does bite it drops the open sweeps rather than the
   specialist register the whole routing exists to reach. */
const MAX_SEARCHES  = Math.max(3, Math.min(34, Number(process.env.KBYS_MAX_SEARCHES) || 22));
/* Round two is seeded by round one. Capped separately so a subject that surfaces
   many names cannot run the bill up without a deliberate change. */
const MAX_ROUND2    = Math.max(0, Math.min(10, Number(process.env.KBYS_MAX_ROUND2) || 6));
const WINDOW_MS = 60_000;
const PER_WINDOW = 5;

/* In-memory, per-instance, resets on cold start. Stops a stuck tab, not a
   determined person. Move to Vercel KV before this URL is public. */
const HITS = new Map();
function overLimit(ip) {
  const now = Date.now();
  const hits = (HITS.get(ip) || []).filter(t => now - t < WINDOW_MS);
  hits.push(now); HITS.set(ip, hits);
  if (HITS.size > 5000) HITS.clear();
  return hits.length > PER_WINDOW;
}

const isDomain = v => /^([\w-]+\.)+[a-z]{2,}$/i.test(v);
const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);

/* ---------------- assemble the evidence brief for Claude ---------------- */
function brief(q, domain, conn, exaOut, parOut, siblings) {
  const L = [];
  L.push(`IDENTIFIER: ${q}`);
  if (domain) L.push(`DOMAIN: ${domain}`);
  L.push(`DATE: ${new Date().toISOString().slice(0, 10)}`);
  L.push('');
  L.push('================ TIER 0 - DIRECT REGISTRY RECORDS ================');
  L.push('These were retrieved directly. Treat them as Tier A and quote them verbatim.');
  L.push('');

  const r = conn.records.rdap;
  if (r?.status === 'found') {
    L.push(`[ICANN RDAP] ${r.url}`);
    L.push(`  created: ${r.created}  (${r.age_days} days old at the time of this check)`);
    L.push(`  registrar: ${r.registrar}`);
    L.push(`  nameservers: ${(r.nameservers || []).join(', ')}`);
    L.push(`  status: ${(r.statuses || []).join(', ')}`);
    L.push(`  VERBATIM: ${r.raw_excerpt}`);
  } else {
    L.push(`[ICANN RDAP] ${r?.status || 'not run'} - report this in coverage_gaps.`);
  }
  L.push('');

  const m = conn.records.mail;
  if (m?.status === 'found') {
    L.push(`[Mail configuration] VERBATIM: ${m.raw_excerpt}`);
    L.push(`  ${m.note}`);
  } else {
    L.push(`[Mail configuration] ${m?.status || 'not run'}`);
  }
  L.push('');

  if (siblings?.length) {
    L.push('[4orm infrastructure cluster] Domains sharing nameservers or registrar with the subject:');
    siblings.forEach(s => {
      L.push(`  ${s.domain} - shared nameservers: ${s.shared_nameservers.join(', ') || 'none'}` +
             `; same registrar: ${s.same_registrar}`);
      L.push(`  VERBATIM: ${s.raw_excerpt}`);
    });
    L.push('');
  }

  L.push('================ TIER 1 - EXA, PINNED TO REGISTER DOMAINS ================');
  exaOut.forEach(b => {
    L.push(`--- ${b.label} [${b.status}] ---`);
    if (!b.results.length) { L.push('  nothing returned'); return; }
    b.results.forEach(x => {
      L.push(`  URL: ${x.url}`);
      L.push(`  TITLE: ${x.title || ''}${x.date ? '  (' + x.date + ')' : ''}`);
      if (x.highlights?.length) L.push(`  HIGHLIGHT: ${x.highlights.join(' | ').slice(0, 700)}`);
      if (x.text) L.push(`  TEXT: ${x.text.slice(0, 1600)}`);
      L.push('');
    });
  });

  L.push('================ TIER 2 - PARALLEL, CITED EXCERPTS ================');
  parOut.forEach(b => {
    L.push(`--- ${b.label} [${b.status}] ---`);
    if (!b.results.length) { L.push('  nothing returned'); return; }
    b.results.forEach(x => {
      L.push(`  URL: ${x.url}`);
      L.push(`  TITLE: ${x.title || ''}${x.date ? '  (' + x.date + ')' : ''}`);
      (x.excerpts || []).forEach(e => L.push(`  EXCERPT: ${e.slice(0, 1200)}`));
      L.push('');
    });
  });

  return L.join('\n');
}

/* ---------------- semantic assessment -> console render shape ---------------- */
function toRenderShape(a, meta) {
  const s = a.scores || {};
  const checked = s.sources_checked || 0;
  const missed  = s.sources_not_reached || 0;
  /* The denominator is what could have applied to THIS party, computed by
     routing before the run. Falling back to the model's own arithmetic only
     where routing produced nothing. */
  const universe = (meta.counts && meta.counts.applicable) || (checked + missed);

  const cats = {};
  (a.categories || []).forEach(c => {
    cats[c.id] = {
      state: c.state, sum: c.summary,
      ev: (c.evidence || []).map(e => ({
        t: e.tier, src: e.source, when: e.retrieved,
        find: e.finding, plain: e.plain || '', quote: e.quote || '', url: e.url || ''
      }))
    };
  });

  const issues = a.material_issues || [];
  const claims = a.claims || [];

  return {
    name: a.entity?.display_name || '', domain: a.entity?.domain || '',
    verdict: a.verdict?.state || 'GREY',
    headline: a.verdict?.headline || 'Insufficient information',
    statement: a.verdict?.statement || '',
    idc: s.identity_confidence || 0, cov: s.evidence_coverage || 0,

    reads: [
      [String(checked), 'Sources checked'],
      [String(s.jurisdictions || 0), 'Jurisdictions touched'],
      [String(s.verified_facts || 0), 'Verified facts'],
      [String(s.concerns || 0), 'Concerns']
    ],
    stats: [
      [String(checked), '', 'Sources returning a result', pct(checked, universe), 'a',
        universe ? `of ${universe} that should have applied` : 'nothing applied to this party'],
      [String(s.tier_a_records || 0), '', 'Authoritative records', pct(s.tier_a_records || 0, checked), 'a',
        'government, regulator, court or registry'],
      [String(claims.length), '', 'Claims cross-examined', claims.length ? 100 : 0, 'a',
        claims.length ? `${claims.filter(c => c.result === 'RED').length} contradicted by the record`
                      : 'no claims could be bound to a source'],
      [String(issues.length), '', 'Material issues', issues.length ? 100 : 0, 'c',
        issues.length ? `${issues.filter(i => i.severity === 'critical').length} critical, ${issues.filter(i => i.severity === 'high').length} high`
                      : 'none found in the checks completed'],
      [String(missed), '', 'Sources not reached', pct(missed, universe), 'n',
        missed ? 'every one named further down this page' : 'nothing was left unchecked']
    ],
    /* Plain words, the same ones the reader sees everywhere else. A tier
       letter means nothing to somebody checking who is about to take their
       money, and the console stopped printing them months ago. */
    bars: [
      ['Official records',      s.tier_a_records || 0, 'a'],
      ['Verified data',         s.tier_b_records || 0, 'b'],
      ['Public chatter',        s.tier_d_records || 0, 'c'],
      ['Sources not reached',   missed, 'n'],
      ['Claims cross-examined', claims.length, 'a'],
      ['Material issues',       issues.length, 'a']
    ],
    barFoot: s.evidence_note ||
      `${checked} sources returned a definitive result. ${missed} that should have been reached were not, and every one is named further down this page.`,

    cats,
    claims: claims.map(c => ({ q: c.claim, s: c.adjudicating_source, r: c.record_says, v: c.result })),
    issues: issues.map(i => ({ t: i.title, x: i.explanation, sev: i.severity, tier: i.tier })),
    bys: a.before_you_send || [],
    gaps: (a.coverage_gaps || []).map(g => [g.source, g.reason]),
    unresolved: a.unresolved_questions || [],

    reviews: a.review_narratives ? {
      checked:  a.review_narratives.platforms_checked || 0,
      carrying: a.review_narratives.platforms_carrying_negatives || 0,
      reports:  a.review_narratives.negative_reports_read || 0,
      state:    a.review_narratives.corpus_state || 'absent',
      note:     a.review_narratives.note || '',
      rows: (a.review_narratives.narratives || []).map(n => ({
        id: n.id, label: n.label, pf: n.platforms || 0,
        names: n.platform_names || [], n: n.reports || 0,
        quote: n.quote || '', period: n.period || ''
      }))
    } : null,

    board: meta.board,

    /* Routing. What the party appears to be, which decides which registers
       could ever have applied, which is the denominator coverage is measured
       against. Published so a reader can see why a register is not on the
       list rather than wondering whether we forgot it. */
    classifications: meta.classifications || [],
    applicable: meta.applicable || [],
    notApplicable: meta.notApplicable || [],
    sourceCounts: meta.counts || null,

    /* The operator graph. Identifiers, the connections between them, and the
       prior warnings any of them touch. */
    graph: a.operator_graph ? {
      nodes: (a.operator_graph.nodes || []).map(n => ({
        type: n.node_type, v: n.value, src: n.source, url: n.url || '',
        quote: n.excerpt || '', first: n.first_seen || null
      })),
      edges: (a.operator_graph.edges || []).map(e => ({
        from: e.from, to: e.to, type: e.edge_type, other: e.other_party || '',
        src: e.source, url: e.url || '', quote: e.excerpt || '',
        tier: e.source_tier || 'B', status: e.status || 'OBSERVED',
        hist: !!e.historically_available
      })),
      priors: (a.operator_graph.prior_warnings || []).map(w => ({
        kind: w.identifier_type, id: w.identifier, entity: w.prior_entity,
        reg: w.regulator, date: w.date, src: w.source, url: w.url || ''
      })),
      note: a.operator_graph.note || ''
    } : null,

    /* Claim chronology. What they say, against what the record carries. */
    chrono: a.claim_chronology ? {
      claims: (a.claim_chronology.claims || []).map(c => ({
        q: c.claim, year: c.implies_year, where: c.where, url: c.url || ''
      })),
      records: (a.claim_chronology.record_dates || []).map(r => ({
        what: r.what, date: r.date, src: r.source, url: r.url || ''
      })),
      earliest: a.claim_chronology.earliest_independent_record || null,
      verdict: a.claim_chronology.verdict || 'NOT_ENOUGH_RECORD',
      statement: a.claim_chronology.statement || ''
    } : null,

    /* Everything retrieval actually reached, as served. The report lists these
       so a reader can open each page and check the finding themselves, and so
       an empty section reads as "nothing came back" rather than as silence. */
    retrieved: (meta.sources || []).slice(0, 150).map(x => ({
      tier: x.tier, label: x.label, url: x.url, title: x.title,
      date: x.date, host: x.host, reg: x.registers || [],
      snip: (x.snippet || '').slice(0, 340)
    })),
    ledger: meta.ledger || [],
    checks: meta.checks || null,

    live: true,
    checked_at: new Date().toISOString(),
    pipeline: meta.pipeline
  };
}

/* --------------------------------- handler --------------------------------- */
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'method_not_allowed', message: 'POST only.' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'not_configured',
      message: 'Live checking is not switched on. ANTHROPIC_API_KEY is not set on this deployment.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (overLimit(ip))
    return res.status(429).json({ error: 'rate_limited', message: 'Too many checks. Wait a minute and try again.' });

  /* Streaming. The client asks for it with stream:true and reads newline
     delimited JSON as the work happens. Retrieval takes most of the wall clock
     and produces real, final facts long before the reasoning call returns, so
     those facts are released as they land rather than held back for a single
     response two minutes later. Without it the page sits silent and a user
     reasonably concludes that nothing happened. */
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const q = String(body?.q || '').trim().slice(0, MAX_INPUT);
  if (!q) return res.status(400).json({ error: 'no_input', message: 'Supply an identifier to check.' });

  /* The switch panel. An absent or empty list means every check runs, which is
     how the panel ships. Unknown keys are dropped rather than trusted. */
  const checks = Array.isArray(body?.checks) && body.checks.length
    ? body.checks.map(String).filter(c => ALL_CATS.includes(c))
    : ALL_CATS.slice();
  const on = k => checks.includes(k);

  /* The two optional questions from the console. Both may be absent, and an
     absent answer is absent, never a default that nobody chose. Values are
     matched against a fixed list rather than trusted, because everything here
     reaches the operations log and a free text field on a request body is how
     an identifier ends up in a table that must never hold one. */
  const ONE_OF = (v, allowed) => {
    const x = String(v || '').trim().toUpperCase();
    return allowed.includes(x) ? x : null;
  };
  const ask = {
    sector:  ONE_OF(body?.sector,  ['INVESTMENT', 'MORTGAGE', 'AUTO', 'INSURANCE', 'OTHER']),
    stage:   ONE_OF(body?.stage,   ['BEFORE', 'SENT', 'DILIGENCE']),
    channel: ONE_OF(body?.channel, ['DEALER', 'PRIVATE']),
    /* What the reader asserted in order to run this at all. The console
       refuses an identifier that reads as a person's name; plenty of real
       companies read that way, so the reader can say so and run it anyway.
       Allow-listed like everything else here: a free string from a browser
       never reaches a hashed column. */
    assert:  ONE_OF(body?.assert,  ['NOT_A_PERSON']),
  };
  /* A channel answer only means anything for a vehicle. Carried over from a
     sector somebody switched away from, it would be a fact about the run that
     nobody stated. */
  if (ask.sector !== 'AUTO') ask.channel = null;

  /* Stage rides the purpose field that already exists rather than becoming a
     new hashed column. It describes why somebody is asking, which is what that
     field is for, and it keeps the row shape stable. */
  const OPS_PURPOSE = { BEFORE: 'TRANSACTION', SENT: 'TRANSACTION_DONE',
                        DILIGENCE: 'DILIGENCE' }[ask.stage] || 'TRANSACTION';

  const domain = isDomain(q.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])
    ? q.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
    : null;

  const stream = body?.stream === true || req.query?.stream === '1';
  let sent = false;
  const emit = (t, v) => {
    if (!stream) return;
    if (!sent) {
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive'
      });
      sent = true;
    }
    try { res.write(JSON.stringify({ t, v }) + '\n'); } catch { /* client gone */ }
  };
  const fail = (status, obj) => {
    if (stream) { emit('error', obj); try { res.end(); } catch {} return; }
    return res.status(status).json(obj);
  };

  const t0 = Date.now();

  /* Classify before planning. A crypto hedge fund is four things at once and
     each one opens a different set of registers. Running every specialised
     search against every company is slow, expensive, and fills the report with
     registers that could never have held a record. */
  const cls = classify(q, domain || '');
  const jur = jurisdictions(q, '', domain || '');
  const ctx = {
    verticals: cls.verticals,
    jurisdictions: jur,
    entity_kinds: ['COMPANY', 'WEBSITE'],
    wallet: /^(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{20,}|T[A-Za-z0-9]{33})$/.test(String(q || '').trim()),
    document: false
  };
  const app = applicable(ctx);

  const p = plan(q, domain, checks, ctx);
  emit('phase', { step: 'plan', label: 'Planning the sweep',
                  searches: p.exa.length, objectives: p.par.length, categories: checks.length,
                  classifications: cls.classifications,
                  sources_available: TOTAL_SOURCES,
                  sources_applicable: app.applicable.length });

  try {
    /* Tier 0 and Tier 1 run together. Nothing here depends on anything else. */
    emit('phase', { step: 'retrieve', label: 'Reading the registers' });
    const [conn, exaOut] = await Promise.all([
      on('C6') ? runConnectors(domain) : Promise.resolve({ records:{}, reached:0, unreached:0 }),
      Promise.all(p.exa.slice(0, MAX_SEARCHES).map(s => exa(s.query, s)))
    ]);
    const tExa = Date.now() - t0;
    emit('phase', { step: 'retrieved', label: 'Registers read',
                    ok: exaOut.filter(b => b.status === 'found').length, of: exaOut.length,
                    pages: exaOut.reduce((n, b) => n + b.results.length, 0), ms: tExa });
    if (conn?.records) emit('connectors', conn);

    /* The sibling check needs the subject's RDAP record, so it waits for Tier 0.
       Candidate domains come out of what Exa already surfaced. */
    let siblings = [];
    const subj = conn.records?.rdap;
    if (on('C9') && subj?.status === 'found' && subj.nameservers?.length) {
      const seen = new Set([domain]);
      const cands = exaOut.flatMap(b => b.results.map(r => {
        try { return new URL(r.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
      })).filter(h => h && !seen.has(h) && !h.endsWith('.gov') && !/(reddit|trustpilot|bbb|google)\./.test(h));
      siblings = await siblingCheck(subj, [...new Set(cands)].slice(0, 4));
    }

    /* Round two. Round one searched what the consumer typed. Round two searches
       what round one found: the people named in the records, the case numbers on
       the dockets, the entities alongside the subject and the sibling domains.
       Nothing here is invented; every seed appears verbatim in a round one result.

       This exists because the first real entity anybody checked was a company
       whose chief executive's name was in the results and never searched. */
    let seeds = { people: [], caseNumbers: [], relatedEntities: [], domains: [] };
    let exa2 = [], round2Plan = [];
    if (MAX_ROUND2 > 0) {
      seeds = extractSeeds(exaOut, [], domain, q);
      const r2 = planRound2(q, domain, seeds, checks).slice(0, MAX_ROUND2);
      round2Plan = r2;
      if (r2.length) exa2 = await Promise.all(r2.map(x => exa(x.query, x)));
    }
    const exaAll = exaOut.concat(exa2);
    if (exa2.length) emit('phase', { step: 'round2', label: 'Following what the first pass found',
                                     searches: exa2.length, seeds });

    /* Tier 2. */
    emit('phase', { step: 'research', label: 'Assembling what no single page answers' });
    const parOut = await Promise.all(p.par.map(o => parallel(o.objective, o.queries, o)));
    const tRetrieval = Date.now() - t0;

    /* Board, pass 1. Every URL that came back is attributed to the register it
       belongs to, so a light means retrieval reached that register on this run.
       Pass 2 runs after the assessment and carries adverse states onto it. */
    const sources = retrievedSources(exaAll, parOut);

    /* Every domain that was pinned on a search that actually ran. A register in
       here that still has no result was searched and came back empty, which is
       a finding. A register that is not in here was never asked. The board is
       allowed to say which is which, instead of stamping both "could not reach". */
    const searchedHosts = [];
    const round1Plan = p.exa.slice(0, MAX_SEARCHES);
    const pinIf = (planned, out) => planned.forEach((x, i) => {
      /* status found is the only outcome that means the register was actually
         asked. not_configured, error and unreachable all mean the search never
         happened, and pinning them would manufacture a negative result out of
         an outage. This is the difference between "it came back empty" and
         "our key was missing". */
      if (!out || out[i]?.status !== 'found') return;
      (x.includeDomains || x.domains || []).forEach(h => searchedHosts.push(h));
    });
    pinIf(round1Plan, exaOut);
    pinIf(round2Plan, exa2);
    pinIf(p.par, parOut);

    const board0  = searchedBoard(reachedBoard(sources, conn, siblings), searchedHosts);
    const ledger  = reviewLedger(sources, REVIEW_HOSTS);

    /* ============ A DEAD SEARCH PROVIDER IS NOT A CLEAN RECORD ============
       exa() and parallel() never throw. Every failure - no key, a 401, an
       exhausted quota, a timeout - comes back as {status:'error'|'unreachable'|
       'not_configured', results:[]}, which is the same shape as a search that
       ran properly and found nothing. So a provider outage walked straight
       through retrieval, produced a board where every register reads unreached,
       and handed the reasoning call an empty brief. The assessment that came
       back said nothing was found.

       On a product whose first promise is that coverage is COUNTED from the
       retrieval log rather than asserted, that is the worst failure available:
       it is indistinguishable, on screen, from having checked and found a clean
       record. A reader about to send money cannot tell "we asked 121 registers
       and none held anything" from "we never managed to ask".

       It also has a tell, which is the clock. A real sweep takes minutes. A
       sweep where every call is refused at the door takes seconds.

       So the calls are counted, and a sweep where nothing answered stops here
       rather than going on to have an empty brief assessed. A search that ran
       and legitimately returned no pages is NOT this: that call's status is
       'found', and it passes. */
    {
      const calls  = [...exaAll, ...parOut];
      const answered = calls.filter(b => b.status === 'found').length;
      const configured = !calls.some(b => b.status === 'not_configured');
      if (calls.length && answered === 0) {
        const why = !configured
          ? 'the search provider is not configured on this deployment'
          : 'the search provider refused or could not be reached on every one of the '
            + calls.length + ' searches this check made';
        const detail = calls.slice(0, 6)
          .map(b => b.source + ':' + b.status + (b.http ? ' ' + b.http : '')).join(', ');
        try { console.error('[check] retrieval dark', why, detail); } catch {}
        return fail(503, {
          error: 'retrieval_unavailable', build: BUILD,
          message: 'The check could not read any register. This is a fault on our side and '
                 + 'not a finding about this party: no register was reached, so nothing here '
                 + 'says anything about them, in either direction. Please try again shortly.',
          operator: { status: 503, detail: why + ' [' + detail + ']' }
        });
      }
    }

    /* Everything above is retrieval, and it is final. The board, the ledger and
       the page list do not change when the reasoning call returns, so they go to
       the client now rather than in two minutes. */
    emit('partial', {
      board: board0, ledger,
      retrieved: sources.slice(0, 150).map(x => ({
        tier: x.tier, label: x.label, url: x.url, title: x.title,
        date: x.date, host: x.host, reg: x.registers || [], snip: (x.snippet || '').slice(0, 340)
      })),
      counts: {
        /* The same test the console uses. searched and na are dark states: a
           register that came back empty was not reached. */
        registers_reached: Object.values(board0)
          .filter(v => v === 'clear' || v === 'caution' || v === 'adverse').length,
        pages: sources.length,
        platforms_searched: ledger.filter(r => r.searched).length,
        platforms_returning: ledger.filter(r => r.pages > 0).length
      },
      ms: Date.now() - t0
    });
    emit('phase', { step: 'reason', label: 'Cross-examining the evidence' });

    /* A HEARTBEAT, and the reason it exists.
       The reasoning call below is one await that can run for minutes on a
       heavily written-about party. During it nothing was written to the
       response, and a response that sends no bytes is dropped as idle by the
       platform in front of us. The reader saw three minutes of progress bar
       and then "the stream ended before a result was produced", which is the
       client honestly reporting a connection that died under it.
       A line every eight seconds keeps the response alive and tells the reader
       the wait is still ours rather than theirs. */
    let beat = null;
    const startBeat = () => {
      const at = Date.now();
      beat = setInterval(() => {
        emit('tick', { ms: Date.now() - at, label: 'Cross-examining the evidence' });
      }, 8000);
      if (beat.unref) beat.unref();
    };
    const stopBeat = () => { if (beat) { clearInterval(beat); beat = null; } };

    /* Tier 3. One call. No search tool. Reasoning only. */
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    startBeat();
    let msg;
    try {
      msg = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SEARCH_CUE + OUTPUT_INSTRUCTION,
      tools: [{
        name: 'emit_assessment',
        description: 'Return the completed Know Before You Send assessment. Call exactly once.',
        input_schema: PAYLOAD_SCHEMA
      }],
      tool_choice: { type: 'tool', name: 'emit_assessment' },
      messages: [{
        role: 'user',
        content:
          `Run a full Know Before You Send assessment on: ${q}\n\n` +
          `You have no search tool on this call. Everything retrievable has already been ` +
          `retrieved and is below. Work only from it. Where a source is absent from this ` +
          `brief, it was not reached, and it belongs in coverage_gaps as such - never as a ` +
          `clean result. Every quote field must be verbatim text that appears below.\n\n` +
          `No document or payment instruction was supplied, so C8 is GREY.\n\n` +
          (checks.length < ALL_CATS.length
            ? `THE OPERATOR SWITCHED OFF THESE CHECKS BEFORE THE RUN: ` +
              ALL_CATS.filter(c => !checks.includes(c)).join(', ') + `. No retrieval was ` +
              `performed for them. Report each one as GREY with a coverage_gaps entry reading ` +
              `"switched off before this run", and never as a clean result. Evidence coverage ` +
              `must reflect that they were not attempted.\n\n`
            : '') +
          brief(q, domain, conn, exaAll, parOut, siblings) +
          '\n\n================ REVIEW PLATFORM LEDGER (COUNTED, NOT JUDGED) ================\n' +
          'This ledger is counted from the retrieval above, not estimated. Your\n' +
          'review_narratives block must agree with it. platforms_checked is the number\n' +
          'marked searched. platforms_carrying_negatives can never exceed the number\n' +
          'with pages returned, and a platform with zero pages was not read.\n' +
          ledger.map(r => `  ${r.platform} (${r.host}): searched=${r.searched} pages_returned=${r.pages}`).join('\n')
        }]
      });
    } finally {
      /* Stopped whether the call returned, threw, or was aborted. A heartbeat
         that outlives its request writes to a closed response forever. */
      stopBeat();
    }

    const call = msg.content.find(b => b.type === 'tool_use' && b.name === 'emit_assessment');
    if (!call) return fail(502, { error: 'no_assessment',
      message: 'Retrieval completed but no assessment was produced. Nothing has been guessed at.',
      stop_reason: msg.stop_reason });

    const exaCost = exaAll.reduce((n, b) => n + (b.cost || 0), 0);
    /* Routing already decided which sources could hold a record here. Carry
       that onto the board so a register that was never going to apply reads as
       "does not apply here" rather than as a hole in our coverage. */
    const naFromRouting = {};
    app.notApplicable.forEach(x => { naFromRouting[x.source.display_name] = x.reason; });
    const board1 = { ...board0 };
    Object.keys(naFromRouting).forEach(nm => {
      if (!board1[nm] || board1[nm] === 'searched' || board1[nm] === 'unreached') board1[nm] = 'na';
    });
    const board = overlayBoard(applicabilityBoard(board1, call.input), call.input);
    const payload = toRenderShape(call.input, {
      board,
      sources,
      ledger,
      checks,
      classifications: cls.classifications,
      applicable: app.applicable.map(x => x.display_name),
      notApplicable: app.notApplicable.map(x => ({ source: x.source.display_name, reason: x.reason })),
      counts: { available: TOTAL_SOURCES, applicable: app.applicable.length },
      pipeline: {
        connectors: { reached: conn.reached, unreached: conn.unreached, siblings: siblings.length },
        exa:      { calls: exaAll.length, round1: exaOut.length, round2: exa2.length,
                    ok: exaAll.filter(b => b.status === 'found').length,
                    results: exaAll.reduce((n, b) => n + b.results.length, 0), cost_usd: exaCost || null },
        /* THE COUNT, NOT THE NAMES.
           This wrote the extracted person names into the payload that goes to
           the browser, so individuals' names travelled to the client inside the
           audit panel on a product that tells its readers it keeps no person
           level record. The other three are identifiers of things rather than
           of people and stay as they were. */
        seeds:    { people: (seeds.people || []).length, case_numbers: seeds.caseNumbers,
                    related_entities: seeds.relatedEntities, domains: seeds.domains },
        parallel: { calls: parOut.length, ok: parOut.filter(b => b.status === 'found').length,
                    results: parOut.reduce((n, b) => n + b.results.length, 0) },
        claude:   { model: MODEL,
                    input_tokens: msg.usage?.input_tokens,
                    output_tokens: msg.usage?.output_tokens },
        ms: { retrieval: tRetrieval, exa: tExa, total: Date.now() - t0 },
        build: BUILD
      }
    });

    /* The write side. Storage can never break a check: recordRun swallows its
       own failures and reports them, and the payload carries what happened. */
    const stored = await recordRun({
      identifier: q, domain, payload, pipeline: payload.pipeline,
      sources, ledger, connectors: conn, siblings,
      sourcesChecked: call.input?.scores?.sources_checked ?? null,
      sourcesNotReached: call.input?.scores?.sources_not_reached ?? null,
      briefChars: 0
    }).catch(e => ({ stored: false, reason: e?.message || 'store threw' }));
    payload.pipeline.store = stored;

    /* The operations log. Chained, and carrying no identifier: the shape of the
       run, never its subject. This is what the counter on the landing page and
       the back office read, and it is deliberately a separate write from the
       one above so that retiring either leaves the other intact. */
    /* Awaited, and before the run is recorded. A row citing a policy version
       whose record does not exist yet is precisely the gap this closes, so the
       ordering is the guarantee, not an optimisation. */
    const pol = await ensurePolicyRecorded();

    /* OUT OF SCOPE, AND CRITICAL FAILURES, MEASURED RATHER THAN ASSUMED.
       Out of scope is what the register does not clear us to ask: applicable to
       this party, and not on the enabled list. Critical failed is a source
       SR-001 marks CRITICAL that we planned and did not reach. Both are read
       off the manifest, so they move when the register moves and never when
       somebody edits a number here. */
    const enabledSet = new Set(POLICY.sources || []);
    const criticalSet = new Set(POLICY.critical || []);
    const outOfScope = enabledSet.size
      ? app.applicable.filter(x => !enabledSet.has(x.display_name)).length : 0;
    const criticalFailed = criticalSet.size
      ? (sources || []).filter(s => s.status !== 'found' && criticalSet.has(s.board || s.label)).length : 0;

    const ops = await recordOps(req, {
      input_type: opsInputType(q, domain),
      province: null,                       /* set when the purpose gate lands */
      purpose: OPS_PURPOSE,
      outcome: 'COMPLETED',
      sources_planned: sources?.length ?? 0,
      sources_ok: call.input?.scores?.sources_checked ?? 0,
      sources_failed: call.input?.scores?.sources_not_reached ?? 0,
      /* THESE WERE ALWAYS ZERO, AND THE BACK OFFICE REPORTED THE ZEROS.
         They read payload.pipeline.outOfScope and .criticalFailed, and nothing
         in api/ ever set either key, so four columns on every row since the
         chain began carry a number that was never measured. Two of them are
         answerable here and are now computed; two are not, and say so. */
      sources_out_of_scope: outOfScope,
      critical_failed: criticalFailed,
      incomplete: (call.input?.scores?.sources_not_reached ?? 0) > 0,
      /* Suppression and barring happen in the browser, after this row is
         written, so the server cannot count them without the page telling it
         and the page telling it would mean a second write keyed to a run. Null
         is the honest value: not measured, rather than none occurred. The
         column is nullable and the canonical string treats null as empty, so
         existing rows are unaffected. */
      suppressed_items: null,
      barred_items: null,
      duration_ms: Date.now() - t0,
      policy_version: OPS_POLICY_VERSION,
      manifest_generated: POLICY.manifest_generated,
      enforcement_on: POLICY.enforcement_on,
      sector: ask.sector,
      user_assert: ask.assert,
    }).catch(e => ({ ok: false, reason: e?.message || 'ops threw' }));
    payload.pipeline.ops = {
      /* The row hash goes back to the page. The report card prints it beside
         the reference, because a reference somebody can quote is worth more
         when the thing it points at can be checked against the chain. */
      ok: ops.ok, seq: ops.seq, hash: ops.hash, reason: ops.reason, schema: ops.schema,
      policy_version: OPS_POLICY_VERSION,
      policy_effective: POLICY.effective_from,
      registers_in_scope: POLICY.sources_enabled,
      manifest_generated: POLICY.manifest_generated,
      policy_recorded: !!(pol && pol.ok),
    };
    /* Echoed back so the report can say what it was laid out for, and so the
       audit panel can show it. Absent answers stay absent.

       Note what this does NOT do yet: the declared sector does not narrow the
       search plan, because the provincial dealer, mortgage and insurance
       registers are not on SR-001 yet and routing to a vertical no source
       claims would return a coverage figure of zero. It reaches the log and
       the layout today, and it will reach routing the day those registers are
       classified. */
    payload.pipeline.context = ask;

    /* THE PUBLIC REGISTER.
       A party earns a row only where an authority has acted, or where the same
       kind of report appears on three or more independent platforms. Everything
       else clears an existing row rather than creating one, which is how a
       party whose alert was withdrawn comes off the list without anybody having
       to ask. Fire and forget, and never able to hold up a response. */
    try {
      const reg = classifyForRegister(payload);
      recordRegister(reg).then(r => { payload.pipeline.register = r; }).catch(() => {});
    } catch (e) { }

    /* Per register, rolled into the day. Fire and forget: a health counter must
       never be able to hold up a response.

       This read s.id, s.name, s.ok, s.timedOut and s.ms off rows that
       reviewLedger returns as { platform, host, board, searched, pages, urls }.
       Every one of those was undefined, so every row was written as source
       "undefined" with status failed and no latency, and the per-register
       health table in the back office was measuring nothing. It now writes the
       platform under its board name, and searched-with-no-pages is recorded as
       reached rather than as a failure, because that is what it is. */
    try {
      for (const s of (ledger || [])) {
        const id = s.board || s.platform || s.host;
        if (!id) continue;
        recordSource(id, s.searched ? 'ok' : 'failed', null);
      }
    } catch {}

    if (stream) { emit('result', payload); try { res.end(); } catch {} return; }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(payload);

  } catch (err) {
    /* NOTHING A PROVIDER SAYS REACHES A READER.
       This returned err.message straight through, and the console printed it
       under "in our own words". A reader checking a company before sending
       money was shown a raw four hundred, a request id, and an instruction to
       go and buy credits: a message about OUR account, in our voice, on a page
       about somebody else's company. It also named the vendor, which no screen
       here may do.

       So the reader gets a sentence about what happened to their check, chosen
       by what kind of failure it was, and the technical text goes to the server
       log and to the operator field, which only the audit panel reads. */
    const status = err?.status || 500;
    const raw = String(err?.message || '');
    const low = raw.toLowerCase();

    let message;
    if (/credit balance|quota|billing|payment required/.test(low) || status === 402)
      message = 'The check could not run: this service is temporarily unable to reach one of '
              + 'the systems it depends on. Nothing was assessed, and nothing here is a '
              + 'finding about this party. Please try again shortly.';
    else if (status === 401 || status === 403 || /api key|unauthor|forbidden/.test(low))
      message = 'The check could not run: this service is not currently able to reach one of '
              + 'the systems it depends on. Nothing was assessed. Please try again shortly.';
    else if (status === 429 || /rate limit|overloaded|too many/.test(low))
      message = 'The check could not run: the service is busy. Nothing was assessed. Please '
              + 'try again in a few minutes.';
    else if (status === 504 || /timed? ?out|timeout|aborted/.test(low))
      message = 'The check ran past the time limit and did not finish. Nothing was assessed, '
              + 'and a partial sweep is never reported as a result.';
    else
      message = 'The check could not be completed. Nothing was assessed, and nothing here is '
              + 'a finding about this party.';

    /* The real text, for us. Never sent to the page as prose. */
    try { console.error('[check] upstream failure', status, raw.slice(0, 400)); } catch {}

    return fail(status >= 400 && status < 600 ? status : 500, {
      error: 'upstream_error',
      message,
      /* Read by the audit panel and the back office, never rendered as the
         assessment. Truncated, because a provider payload is not evidence. */
      operator: { status, detail: raw.slice(0, 300) }
    });
  }
}
