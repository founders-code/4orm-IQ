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

    /* Tier 3. One call. No search tool. Reasoning only. */
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
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
        seeds:    { people: seeds.people, case_numbers: seeds.caseNumbers,
                    related_entities: seeds.relatedEntities, domains: seeds.domains },
        parallel: { calls: parOut.length, ok: parOut.filter(b => b.status === 'found').length,
                    results: parOut.reduce((n, b) => n + b.results.length, 0) },
        claude:   { model: MODEL,
                    input_tokens: msg.usage?.input_tokens,
                    output_tokens: msg.usage?.output_tokens },
        ms: { retrieval: tRetrieval, exa: tExa, total: Date.now() - t0 }
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

    const ops = await recordOps(req, {
      input_type: opsInputType(q, domain),
      province: null,                       /* set when the purpose gate lands */
      purpose: 'TRANSACTION',
      outcome: 'COMPLETED',
      sources_planned: sources?.length ?? 0,
      sources_ok: call.input?.scores?.sources_checked ?? 0,
      sources_failed: call.input?.scores?.sources_not_reached ?? 0,
      sources_out_of_scope: payload.pipeline?.outOfScope ?? 0,
      critical_failed: payload.pipeline?.criticalFailed ?? 0,
      incomplete: (call.input?.scores?.sources_not_reached ?? 0) > 0,
      suppressed_items: payload.pipeline?.suppressed ?? 0,
      barred_items: payload.pipeline?.barred ?? 0,
      duration_ms: Date.now() - t0,
      policy_version: OPS_POLICY_VERSION,
      manifest_generated: POLICY.manifest_generated,
      enforcement_on: POLICY.enforcement_on,
      sector: call.input?.sector || null,
    }).catch(e => ({ ok: false, reason: e?.message || 'ops threw' }));
    payload.pipeline.ops = {
      ok: ops.ok, seq: ops.seq, reason: ops.reason, schema: ops.schema,
      policy_version: OPS_POLICY_VERSION,
      policy_effective: POLICY.effective_from,
      registers_in_scope: POLICY.sources_enabled,
      manifest_generated: POLICY.manifest_generated,
      policy_recorded: !!(pol && pol.ok),
    };

    /* Per register, rolled into the day. Fire and forget: a health counter must
       never be able to hold up a response. */
    try {
      for (const s of (ledger || [])) {
        recordSource(s.id || s.name, s.ok ? 'ok' : (s.timedOut ? 'timed_out' : 'failed'), s.ms);
      }
    } catch {}

    if (stream) { emit('result', payload); try { res.end(); } catch {} return; }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(payload);

  } catch (err) {
    const status = err?.status || 500;
    return fail(status >= 400 && status < 600 ? status : 500, {
      error: 'upstream_error', message: err?.message || 'The check could not be completed.'
    });
  }
}
