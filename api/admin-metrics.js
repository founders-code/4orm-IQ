/**
 * 4orm IQ - OPERATIONS METRICS
 *
 * GET /api/admin-metrics?days=30
 * Authorization: Bearer <Clerk session token>
 *
 * Serves the OPS-001 s.51 metric list. Aggregates only.
 *
 * There is no endpoint here, and there will not be one, that returns what was
 * searched or who a check was about. The tables it reads do not carry that
 * data. If somebody asks for a "search history" screen, the answer is that the
 * column does not exist, and the reason is written at the top of
 * db/telemetry.sql.
 *
 * With Clerk unconfigured this route is disabled outright rather than left open.
 */

import { requireAdmin } from './_auth.js';
import { CATALOGUE } from './_catalogue.js';
import { DOCUMENTS, DOCS, DOCS_SUPPORTING, DOCS_POSTURE } from './_documents.js';

/* The build this API was deployed from. The page sends its own stamp on the
   query string and the two are compared here, because guessing which build is
   live has cost this project hours. */
const BUILD = '20260907.1015';

/* Amber is not a fault and must never be drawn as one. The rule below has no
   time threshold in it on purpose: a part is DOWN only when we asked it and it
   never answered, and QUIET when we had no cause to ask. A register nobody
   called is not a register that is down, and calling it down would be the same
   lie the whole product exists to refuse. */
function health(asked, answered) {
  if (!asked) return 'warn';
  return answered > 0 ? 'ok' : 'bad';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  /* Clerk verifies identity; the allowlist decides access. Both live in
     _auth.js, and with Clerk unconfigured this returns 503 rather than opening. */
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error, reason: auth.reason });

  if (!process.env.POSTGRES_URL)
    return res.status(503).json({ error: 'no_database_configured' });

  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

  let client;
  try {
    const { default: pg } = await import('pg');
    client = new pg.Client({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      query_timeout: 8000,
    });
    await client.connect();

    const q = (sql, p = []) => client.query(sql, p).then(r => r.rows);
    const since = `now() - interval '${days} days'`;

    const [runs, byOutcome, byInput, byDay, srcWorst, srcEach, srcTotals, rights, del, ppl, chain,
           lastVerify, inc, policyChain, policyRows, schemas, bySector, pulse] = await Promise.all([
      q(`select
           count(*)::int                                            as attempted,
           count(*) filter (where outcome='COMPLETED')::int          as completed,
           count(*) filter (where incomplete)::int                   as incomplete,
           coalesce(sum(suppressed_items),0)::int                    as suppressed,
           coalesce(sum(barred_items),0)::int                        as barred,
           coalesce(round(avg(duration_ms))::int,0)                  as avg_ms,
           count(*) filter (where not enforcement_on)::int           as ran_unenforced
         from ops_runs where at > ${since}`),
      q(`select outcome, count(*)::int as n from ops_runs
         where at > ${since} group by outcome order by n desc`),
      q(`select input_type, count(*)::int as n from ops_runs
         where at > ${since} group by input_type order by n desc`),
      q(`select date_trunc('day', at)::date as day,
                count(*)::int as attempted,
                count(*) filter (where outcome='COMPLETED')::int as completed
         from ops_runs where at > ${since} group by 1 order by 1`),
      q(`select source_id,
                sum(attempts)::int as attempts, sum(ok)::int as ok, sum(failed)::int as failed,
                case when sum(attempts)=0 then null
                     else round(100.0*sum(ok)/sum(attempts),1) end as ok_pct
         from ops_source_day where day > current_date - $1::int
         group by source_id having sum(attempts) > 0
         order by ok_pct asc nulls last limit 15`, [days]),
      q(`select source_id, sum(attempts)::int as attempts, sum(ok)::int as ok
         from ops_source_day where day > current_date - $1::int group by source_id`, [days]),
      q(`select coalesce(sum(attempts),0)::int as attempts,
                coalesce(sum(ok),0)::int as ok,
                coalesce(sum(failed),0)::int as failed,
                coalesce(sum(out_of_scope),0)::int as out_of_scope
         from ops_source_day where day > current_date - $1::int`, [days]),
      q(`select kind,
                count(*)::int as opened,
                count(*) filter (where closed_at is not null)::int as closed,
                round(avg(extract(epoch from (closed_at-opened_at))/86400)::numeric,1) as avg_days
         from ops_rights where opened_at > ${since} group by kind`),
      q(`select count(*)::int as days_run,
                count(*) filter (where not ok)::int as days_failed,
                coalesce(sum(records_deleted),0)::int as deleted
         from ops_deletion where day > current_date - $1::int`, [days]),
      q(`select count(distinct visitor_day) filter (where visitor_day is not null)::int as people
         from ops_runs where at > ${since} and outcome='COMPLETED'`),
      q("select height, head_hash, updated_at from ops_chain where name='ops_runs'"),
      q('select at, height, intact, broken_at, ms from ops_verify order by at desc limit 1'),
      q(`select count(*)::int as total,
                count(*) filter (where pi_involved)::int as pi,
                count(*) filter (where rrosh)::int as rrosh,
                count(*) filter (where reported)::int as reported
         from ops_incident where at > ${since}`),
      q("select height, head_hash, updated_at from ops_chain where name='ops_policy'"),
      q(`select seq, at, version, effective_from, change_kind, summary, reason, evidence_url,
                author, sources_enabled, sources_total, enforcement_on, manifest_generated
           from ops_policy order by seq desc limit 10`),
      q('select hash_schema, count(*)::int as n from ops_runs group by hash_schema order by hash_schema'),
      q(`select coalesce(sector,'UNDECLARED') as sector, count(*)::int as n
           from ops_runs where at > ${since} group by 1 order by n desc`),
      /* THE PULSE. Read from the corpus store, which has no visitor column, so
         nothing here can be turned back into a person. A row is readable only
         where the tally crossed the bar and a name was written; every other row
         reports its count against an unreadable hash, which is the honest way
         to show that something is moving without naming it. */
      q(`select identifier_hash, input_type, max(label) as label,
                coalesce(sum(n) filter (where day = current_date),0)::int          as n,
                coalesce(sum(n) filter (where day < current_date
                          and day >= current_date - 7),0)::int                     as was,
                coalesce(sum(adverse)    filter (where day = current_date),0)::int as adverse,
                coalesce(sum(clean)      filter (where day = current_date),0)::int as clean,
                coalesce(sum(incomplete) filter (where day = current_date),0)::int as incomplete,
                min(first_seen) as first_seen
           from search_pulse
          where day > current_date - $1::int
          group by identifier_hash, input_type
         having coalesce(sum(n) filter (where day = current_date),0) > 0
          order by n desc limit 40`, [days]).catch(function(){ return []; }),
    ]);

    const r = runs[0] || {};
    const s = srcTotals[0] || {};

    /* ------------------------------------------------ registers, per check
       A source we asked and never got an answer from is down. A source with no
       row at all was not called, which for a register that applies only to
       certain sectors is the normal state and reads amber, never green. */
    const seen = Object.fromEntries(srcEach.map(x => [x.source_id, x]));
    const registers = { down: {}, quiet: {} };
    CATALOGUE.filter(x => x.enabled).forEach(src => {
      const ci = (parseInt(src.category, 10) || 1) - 1;
      const row = seen[src.source_id];
      if (!row || !row.attempts) registers.quiet[ci] = (registers.quiet[ci] || 0) + 1;
      else if (!row.ok)          registers.down[ci]  = (registers.down[ci]  || 0) + 1;
    });

    /* --------------------------------------------------- is it running
       Read off the record of what already happened rather than probed. A probe
       would spend money on every page load and would tell you the probe failed,
       not that the product is broken. */
    const byTransport = t => {
      const ids = CATALOGUE.filter(x => x.enabled && x.transport === t).map(x => x.source_id);
      let asked = 0, answered = 0;
      ids.forEach(id => { const x = seen[id]; if (x) { asked += x.attempts; answered += x.ok; } });
      return health(asked, answered);
    };
    /* Two different numbers that were being shown as one. HOW MANY REGISTERS
       we put a question to is a coverage number, out of the catalogue. HOW
       MANY TIMES we asked and got an answer back is a reliability number, out
       of the attempts. A board that prints "40.5% of 126" leaves a reader
       working out which of the two it is, and 126 is neither the catalogue nor
       a percentage of anything they can see. */
    const enabled = CATALOGUE.filter(x => x.enabled);
    const reach = {
      catalogue: enabled.length,
      asked:     enabled.filter(x => (seen[x.source_id] || {}).attempts > 0).length,
      answered:  enabled.filter(x => (seen[x.source_id] || {}).ok > 0).length
    };
    const rdapRow = seen.ICANN_RDAP || seen.RDAP_DATE || null;
    const dl = del[0] || {};
    const systems = {
      search:     health(s.attempts || 0, s.ok || 0),
      reason:     health(r.attempted || 0, r.completed || 0),
      connectors: byTransport('connector'),
      rdap:       health(rdapRow ? rdapRow.attempts : 0, rdapRow ? rdapRow.ok : 0),
      /* This query answered, so the database answered. */
      db:         'ok',
      chain:      (chain[0] && chain[0].height)
                    ? ((lastVerify[0] && lastVerify[0].intact === false) ? 'bad' : 'ok')
                    : 'warn',
      policy:     policyChain[0] ? 'ok' : 'warn',
      retention:  dl.days_failed ? 'bad' : (dl.days_run ? 'ok' : 'warn'),
      /* This request carried a session the allowlist accepted, so the front
         door works. There is nothing else to check that this has not proved. */
      auth:       'ok',
      deploy:     req.query.build ? (req.query.build === BUILD ? 'ok' : 'bad') : 'warn'
    };

    return res.status(200).json({
      build: { api: BUILD, page: req.query.build || null,
               match: req.query.build ? req.query.build === BUILD : null },
      systems: systems,
      registers: registers,
      documents: DOCUMENTS,
      /* The registry the board opens. Sent whole rather than as ten words, so
         the drawer and the lamp cannot say different things about the same
         document. */
      registry: { docs: DOCS, supporting: DOCS_SUPPORTING, posture: DOCS_POSTURE },
      reach: reach,
      window_days: days,
      generated: new Date().toISOString(),
      runs: r,
      completion_pct: r.attempted ? +(100 * r.completed / r.attempted).toFixed(1) : null,
      incomplete_pct: r.attempted ? +(100 * r.incomplete / r.attempted).toFixed(1) : null,
      by_outcome: byOutcome,
      by_input: byInput,
      by_day: byDay,
      sources: {
        attempts: s.attempts || 0,
        ok: s.ok || 0,
        failed: s.failed || 0,
        out_of_scope: s.out_of_scope || 0,
        success_pct: s.attempts ? +(100 * s.ok / s.attempts).toFixed(1) : null,
        /* The id is what the log stores. The name is what a person reads, and
           the catalogue is the only place that knows both. */
        worst: srcWorst.map(function(w){
          var c = CATALOGUE.find(function(x){ return x.source_id === w.source_id; });
          return Object.assign({}, w, { display_name: (c && c.display_name) || w.source_id });
        }),
      },
      rights: rights,
      deletion: del[0] || {},
      people: (ppl[0] || {}).people ?? null,
      chain: Object.assign({}, chain[0] || {}, {
        last_verify: lastVerify[0] || null,
        schemas: schemas,
      }),
      /* The rule history. A run row cites a version; this is what that version
         was. Without it the version string on every row points at nothing. */
      policy: { head: policyChain[0] || null, history: policyRows },
      by_sector: bySector,
      /* Named rows first, because those are the ones that can be acted on, then
         the loudest unreadable ones so a surge is visible before it is named. */
      pulse: {
        label_at: Math.max(5, Number(process.env.KBYS_PULSE_LABEL_AT) || 25),
        rows: pulse || []
      },
      incidents: inc[0] || {},
    });
  } catch (e) {
    return res.status(500).json({ error: 'query_failed', detail: String(e.message || e).slice(0, 200) });
  } finally {
    if (client) { try { await client.end(); } catch {} }
  }
}

