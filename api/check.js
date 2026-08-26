/**
 * 4orm - Know Before You Send
 * POST /api/check   { "q": "<identifier>" }  ->  the console's render payload
 *
 * The model does the sweeping. This file does three things and nothing else:
 * guards the endpoint, runs the call, and translates the semantic assessment
 * into the positional shape the console renders.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SEARCH_CUE, OUTPUT_INSTRUCTION } from './_cue.js';
import { PAYLOAD_SCHEMA } from './_schema.js';

export const config = { maxDuration: 300 };

const MODEL       = process.env.KBYS_MODEL || 'claude-sonnet-4-6';
const MAX_SEARCH  = parseInt(process.env.KBYS_MAX_SEARCHES || '25', 10);
const MAX_INPUT   = 200;

/* ------------------------------------------------------------------ */
/* Rate limit.                                                         */
/* In-memory, so it resets whenever the function cold-starts and is    */
/* per-instance rather than global. It stops a hammering tab, not a    */
/* determined one. Before this faces real traffic, move the counter to */
/* Vercel KV or Upstash - see README, "Before it goes public".         */
/* ------------------------------------------------------------------ */
const HITS = new Map();
const WINDOW_MS = 60_000;
const PER_WINDOW = 5;

function overLimit(ip) {
  const now = Date.now();
  const hits = (HITS.get(ip) || []).filter(t => now - t < WINDOW_MS);
  hits.push(now);
  HITS.set(ip, hits);
  if (HITS.size > 5000) HITS.clear();
  return hits.length > PER_WINDOW;
}

/* ------------------------------------------------------------------ */
/* Transform: semantic assessment -> console render shape              */
/* ------------------------------------------------------------------ */
const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);

function toRenderShape(a) {
  const s   = a.scores || {};
  const checked  = s.sources_checked     || 0;
  const missed   = s.sources_not_reached || 0;
  const universe = checked + missed;

  const cats = {};
  (a.categories || []).forEach(c => {
    cats[c.id] = {
      state: c.state,
      sum:   c.summary,
      ev: (c.evidence || []).map(e => ({
        t:     e.tier,
        src:   e.source,
        when:  e.retrieved,
        find:  e.finding,
        quote: e.quote || '',
        url:   e.url   || ''
      }))
    };
  });

  const issues = a.material_issues || [];
  const claims = a.claims || [];

  return {
    name:      a.entity?.display_name || '',
    domain:    a.entity?.domain || '',
    verdict:   a.verdict?.state || 'GREY',
    headline:  a.verdict?.headline || 'Insufficient information',
    statement: a.verdict?.statement || '',
    idc:       s.identity_confidence || 0,
    cov:       s.evidence_coverage   || 0,

    reads: [
      [String(checked),                 'Sources checked'],
      [String(s.jurisdictions  || 0),   'Jurisdictions touched'],
      [String(s.verified_facts || 0),   'Verified facts'],
      [String(s.concerns       || 0),   'Concerns']
    ],

    stats: [
      [String(checked), '', 'Sources returning a result', pct(checked, universe), 'a',
        universe ? `of ${universe} that should have applied` : 'nothing applied to this party'],
      [String(s.tier_a_records || 0), '', 'Authoritative records', pct(s.tier_a_records || 0, checked), 'a',
        'government, regulator, court or registry'],
      [String(claims.length), '', 'Claims cross-examined', claims.length ? 100 : 0, 'a',
        claims.length ? `${claims.filter(c => c.result === 'RED').length} contradicted by the record` : 'no claims could be bound to a source'],
      [String(issues.length), '', 'Material issues', issues.length ? 100 : 0, 'c',
        issues.length
          ? `${issues.filter(i => i.severity === 'critical').length} critical, ${issues.filter(i => i.severity === 'high').length} high`
          : 'none found in the checks completed'],
      [String(missed), '', 'Sources not reached', pct(missed, universe), 'n',
        missed ? 'every one named further down this page' : 'nothing was left unchecked']
    ],

    bars: [
      ['Tier A, authoritative', s.tier_a_records || 0, 'a'],
      ['Tier B, structured',    s.tier_b_records || 0, 'b'],
      ['Tier D, open web',      s.tier_d_records || 0, 'c'],
      ['Sources not reached',   missed,                'n'],
      ['Claims cross-examined', claims.length,         'a'],
      ['Material issues',       issues.length,         'a']
    ],

    barFoot: s.evidence_note ||
      `${checked} sources returned a definitive result. ${missed} that should have been reached were not, and every one of them is named further down this page.`,

    cats,
    claims: claims.map(c => ({ q: c.claim, s: c.adjudicating_source, r: c.record_says, v: c.result })),
    issues: issues.map(i => ({ t: i.title, x: i.explanation, sev: i.severity, tier: i.tier })),
    bys:    a.before_you_send || [],
    gaps:  (a.coverage_gaps || []).map(g => [g.source, g.reason]),
    unresolved: a.unresolved_questions || [],

    /* The negative-review report card. Positives are cheap to manufacture and
       negatives are not, so the console reads the one-star corpus first and
       reports convergence across platforms rather than volume on any one. */
    reviews: a.review_narratives ? {
      checked:  a.review_narratives.platforms_checked || 0,
      carrying: a.review_narratives.platforms_carrying_negatives || 0,
      reports:  a.review_narratives.negative_reports_read || 0,
      state:    a.review_narratives.corpus_state || 'absent',
      note:     a.review_narratives.note || '',
      rows: (a.review_narratives.narratives || []).map(n => ({
        id:    n.id,
        label: n.label,
        pf:    n.platforms || 0,
        names: n.platform_names || [],
        n:     n.reports || 0,
        quote: n.quote || '',
        period:n.period || ''
      }))
    } : null,

    live: true,
    checked_at: new Date().toISOString()
  };
}

/* ------------------------------------------------------------------ */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'POST only.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'not_configured',
      message: 'Live checking is not switched on. ANTHROPIC_API_KEY is not set on this deployment.'
    });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (overLimit(ip)) {
    return res.status(429).json({ error: 'rate_limited', message: 'Too many checks. Wait a minute and try again.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const q = String(body?.q || '').trim().slice(0, MAX_INPUT);
  if (!q) {
    return res.status(400).json({ error: 'no_input', message: 'Supply an identifier to check.' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SEARCH_CUE + OUTPUT_INSTRUCTION,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCH },
        {
          name: 'emit_assessment',
          description: 'Return the completed Know Before You Send assessment. Call exactly once, after searching.',
          input_schema: PAYLOAD_SCHEMA
        }
      ],
      tool_choice: { type: 'any' },
      messages: [{
        role: 'user',
        content:
          `Run a full Know Before You Send check on this identifier: ${q}\n\n` +
          `Today's date is ${new Date().toISOString().slice(0, 10)}. ` +
          `No document or payment instruction was supplied with this request.`
      }]
    });

    const call = msg.content.find(b => b.type === 'tool_use' && b.name === 'emit_assessment');
    if (!call) {
      return res.status(502).json({
        error: 'no_assessment',
        message: 'The sweep completed but produced no assessment. Nothing has been guessed at.',
        stop_reason: msg.stop_reason
      });
    }

    const payload = toRenderShape(call.input);
    payload.usage = {
      input_tokens:  msg.usage?.input_tokens,
      output_tokens: msg.usage?.output_tokens,
      web_searches:  msg.usage?.server_tool_use?.web_search_requests
    };

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(payload);

  } catch (err) {
    const status = err?.status || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: 'upstream_error',
      message: err?.message || 'The check could not be completed.'
    });
  }
}
