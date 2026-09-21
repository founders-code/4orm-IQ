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
import { LIMITS, RATES, rateCard } from './_budget.js';
import { logFault } from './_log.js';

/* The build this API was deployed from. The page sends its own stamp on the
   query string and the two are compared here, because guessing which build is
   live has cost this project hours. */
const BUILD = '20260921.0211';

/* Amber is not a fault and must never be drawn as one. The rule below has no
   time threshold in it on purpose: a part is DOWN only when we asked it and it
   never answered, and QUIET when we had no cause to ask. A register nobody
   called is not a register that is down, and calling it down would be the same
   lie the whole product exists to refuse. */
function health(asked, answered) {
  if (!asked) return 'warn';
  return answered > 0 ? 'ok' : 'bad';
}

/* ------------------------------------------------------------------ *
 * WHAT IT COST
 *
 * Two tables, two different questions, and the board must not blur them.
 *
 *   runs         what we actually spent. Tokens and Exa's own billed figure,
 *                written by the run that spent them. This is the measurement.
 *   spend_run    what the ceiling reserved and refused. This is the control.
 *
 * Neither table is required. Where one is absent this returns present:false
 * for that half and the reader says so, rather than drawing a nought and
 * letting somebody read it as a quiet day.
 * ------------------------------------------------------------------ */
async function spendBlock(q, days) {
  const card = rateCard();
  const price = (inTok, outTok, exaUsd, exaCalls, parCalls) => {
    const reasoning = (Number(inTok  || 0) / 1e6) * RATES.claudeInM
                    + (Number(outTok || 0) / 1e6) * RATES.claudeOutM;
    /* Exa bills us and tells us what it billed. Where that figure is missing
       for a run, the list rate stands in, and the reader is told how many runs
       that applies to rather than being handed one blended number. */
    const retrieval = Number(exaUsd || 0)
                    + Number(parCalls || 0) * RATES.parallelRun;
    return { reasoning: +reasoning.toFixed(5), retrieval: +retrieval.toFixed(5),
             total: +(reasoning + retrieval).toFixed(5) };
  };

  let measured = { present: false };
  try {
    const win = await q(
      `select
         count(*)::int                                   as runs,
         coalesce(sum(input_tokens),0)::bigint           as in_tok,
         coalesce(sum(output_tokens),0)::bigint          as out_tok,
         coalesce(sum(exa_cost_usd),0)::numeric          as exa_usd,
         coalesce(sum(exa_calls),0)::int                 as exa_calls,
         coalesce(sum(parallel_calls),0)::int            as par_calls,
         count(*) filter (where exa_cost_usd is null)::int as exa_unbilled,
         coalesce(round(avg(ms_total))::int,0)           as avg_ms
       from runs where at > now() - ($1 || ' days')::interval`, [String(days)]);
    const today = await q(
      `select
         count(*)::int                          as runs,
         coalesce(sum(input_tokens),0)::bigint  as in_tok,
         coalesce(sum(output_tokens),0)::bigint as out_tok,
         coalesce(sum(exa_cost_usd),0)::numeric as exa_usd,
         coalesce(sum(parallel_calls),0)::int   as par_calls
       from runs where at > now() - interval '1 day'`);
    /* Per-run cost, so an average can be read against a spread rather than on
       its own. An average alone hides the run that cost four times the rest. */
    const each = await q(
      `select
         (coalesce(input_tokens,0)::numeric / 1e6) * $2
       + (coalesce(output_tokens,0)::numeric / 1e6) * $3
       + coalesce(exa_cost_usd,0)
       + coalesce(parallel_calls,0) * $4                 as usd
       from runs where at > now() - ($1 || ' days')::interval
       order by usd desc`, [String(days), RATES.claudeInM, RATES.claudeOutM, RATES.parallelRun]);
    const byDay = await q(
      `select to_char(at::date,'YYYY-MM-DD')             as day,
              count(*)::int                              as runs,
              coalesce(sum(input_tokens),0)::bigint      as in_tok,
              coalesce(sum(output_tokens),0)::bigint     as out_tok,
              coalesce(sum(exa_cost_usd),0)::numeric     as exa_usd,
              coalesce(sum(parallel_calls),0)::int       as par_calls
         from runs where at > now() - ($1 || ' days')::interval
        group by 1 order by 1`, [String(days)]);

    const w = win[0] || {}, t = today[0] || {};
    const usd = each.map(r => Number(r.usd)).filter(Number.isFinite);
    const at = p => usd.length ? +usd[Math.min(usd.length - 1,
                  Math.floor((1 - p) * usd.length))].toFixed(4) : null;

    measured = {
      present: true,
      window_days: days,
      window: {
        runs: w.runs || 0,
        in_tok: Number(w.in_tok || 0), out_tok: Number(w.out_tok || 0),
        tok: Number(w.in_tok || 0) + Number(w.out_tok || 0),
        exa_calls: w.exa_calls || 0, parallel_calls: w.par_calls || 0,
        exa_unbilled: w.exa_unbilled || 0,
        avg_ms: w.avg_ms || 0,
        ...price(w.in_tok, w.out_tok, w.exa_usd, w.exa_calls, w.par_calls),
      },
      today: {
        runs: t.runs || 0,
        in_tok: Number(t.in_tok || 0), out_tok: Number(t.out_tok || 0),
        ...price(t.in_tok, t.out_tok, t.exa_usd, 0, t.par_calls),
      },
      per_run: {
        runs: w.runs || 0,
        in_tok:  w.runs ? Math.round(Number(w.in_tok  || 0) / w.runs) : null,
        out_tok: w.runs ? Math.round(Number(w.out_tok || 0) / w.runs) : null,
        usd:     w.runs ? +(price(w.in_tok, w.out_tok, w.exa_usd, w.exa_calls, w.par_calls)
                              .total / w.runs).toFixed(4) : null,
        ms:      w.avg_ms || null,
        median:  at(0.5), p90: at(0.9), worst: usd.length ? +usd[0].toFixed(4) : null,
      },
      by_day: byDay.map(d => ({
        day: d.day, runs: d.runs,
        tok: Number(d.in_tok) + Number(d.out_tok),
        ...price(d.in_tok, d.out_tok, d.exa_usd, 0, d.par_calls),
      })),
    };
  } catch { measured = { present: false }; }

  /* The control side. What the ceiling reserved, what it refused, and why. */
  let ledger = { present: false };
  try {
    const res = await q(
      `select
         count(*)::int                                      as reservations,
         coalesce(sum(est_usd),0)::numeric                  as est_usd,
         coalesce(sum(actual_usd),0)::numeric               as actual_usd,
         count(distinct client_key)::int                    as clients
       from spend_run where at > now() - interval '1 day'`);
    const strikes = await q(
      `select coalesce(reason,'unknown') as reason, count(*)::int as n
         from spend_strike where at > now() - interval '1 day'
        group by 1 order by n desc`);
    const blocked = await q(
      `select count(*)::int as n from spend_client where block_until > now()`);
    const r = res[0] || {};
    ledger = {
      present: true,
      reservations: r.reservations || 0,
      clients: r.clients || 0,
      reserved_usd: +Number(r.est_usd || 0).toFixed(4),
      settled_usd:  +Number(r.actual_usd || 0).toFixed(4),
      refusals: strikes,
      refused_total: strikes.reduce((n, x) => n + x.n, 0),
      clients_blocked: blocked[0]?.n || 0,
    };
  } catch { ledger = { present: false }; }

  /* Headroom. Stated against the house ceiling, and in runs rather than only
     in dollars, because runs is the unit anyone here thinks in. */
  const spentToday = measured.present ? measured.today.total
                   : (ledger.present ? ledger.reserved_usd : 0);
  const perRun = measured.present && measured.per_run.usd ? measured.per_run.usd : null;
  const headroom = {
    house_ceiling_usd: LIMITS.maxUsdAllDay,
    spent_usd: +Number(spentToday || 0).toFixed(4),
    left_usd: +Math.max(0, LIMITS.maxUsdAllDay - (spentToday || 0)).toFixed(4),
    pct: LIMITS.maxUsdAllDay
      ? Math.min(100, Math.round(100 * (spentToday || 0) / LIMITS.maxUsdAllDay)) : null,
    runs_left: perRun
      ? Math.max(0, Math.floor((LIMITS.maxUsdAllDay - (spentToday || 0)) / perRun)) : null,
  };

  return {
    measured, ledger, headroom,
    ceiling: {
      runs_per_window: LIMITS.maxRuns, window_s: LIMITS.windowS,
      usd_per_window: LIMITS.maxUsdWindow, usd_per_client_day: LIMITS.maxUsdDay,
      usd_house_day: LIMITS.maxUsdAllDay,
      strikes_to_block: LIMITS.strikesToBlock, block_s: LIMITS.blockS,
    },
    rate_card: card,
  };
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
    /* THE WINDOW IS A PARAMETER, NOT A PIECE OF SQL.
       It was built by interpolating the day count into the statement. The value
       was already an integer clamped to 1..365, so nothing could be smuggled
       through it today, and that is exactly the kind of reasoning that stops
       being true the first time somebody widens the input. Every query below
       binds it, so there is no argument to have. */
    const SINCE = "now() - ($1::int * interval '1 day')";

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
         from ops_runs where at > ${SINCE}`, [days]),
      q(`select outcome, count(*)::int as n from ops_runs
         where at > ${SINCE} group by outcome order by n desc`, [days]),
      q(`select input_type, count(*)::int as n from ops_runs
         where at > ${SINCE} group by input_type order by n desc`, [days]),
      q(`select date_trunc('day', at)::date as day,
                count(*)::int as attempted,
                count(*) filter (where outcome='COMPLETED')::int as completed
         from ops_runs where at > ${SINCE} group by 1 order by 1`, [days]),
      q(`select source_id,
                sum(attempts)::int as attempts, sum(ok)::int as ok, sum(failed)::int as failed,
                case when sum(attempts)=0 then null
                     else round(100.0*sum(ok)/sum(attempts),1) end as ok_pct
         from ops_source_day where day > current_date - $1::int
         group by source_id having sum(attempts) > 0
         order by ok_pct asc nulls last limit 15`, [days]),
      /* The whole row, not two columns of it. Reached, asked and empty, applied
         and never asked, and ruled out before the run are four different
         things, and the board could only tell the first from everything else
         while this selected attempts and ok alone. */
      q(`select source_id, sum(attempts)::int as attempts, sum(ok)::int as ok,
                coalesce(sum(no_match),0)::int as no_match,
                coalesce(sum(failed),0)::int as failed,
                coalesce(sum(out_of_scope),0)::int as out_of_scope,
                /* THE TWO NEW COLUMNS, READ WITHOUT ASSUMING THEY ARE THERE.
                   The board is deployed before the migration is run more often
                   than anybody admits, and a select that names a column the
                   database does not have yet does not degrade, it throws, and
                   the whole per-register reading goes with it. So they are read
                   out of the row as json, which is absent rather than fatal. */
                coalesce(sum((to_jsonb(ops_source_day.*)->>'not_asked')::int),0)::int as not_asked,
                coalesce(sum((to_jsonb(ops_source_day.*)->>'computed')::int),0)::int as computed
         from ops_source_day where day > current_date - $1::int group by source_id`, [days]),
      /* ASKS, NOT ROWS. Every applicable register gets a row on every run,
         including the ones the plan never included and the connectors that are
         computed rather than asked. Dividing answers by rows measured the
         writing down and not the asking, which is how the board came to read
         forty four per cent on a day when nothing had gone wrong. */
      q(`select coalesce(sum(attempts),0)::int as attempts,
                coalesce(sum(ok),0)::int as ok,
                coalesce(sum(no_match),0)::int as no_match,
                coalesce(sum(failed),0)::int as failed,
                coalesce(sum(timed_out),0)::int as timed_out,
                coalesce(sum(out_of_scope),0)::int as out_of_scope
         from ops_source_day where day > current_date - $1::int`, [days]),
      q(`select kind,
                count(*)::int as opened,
                count(*) filter (where closed_at is not null)::int as closed,
                round(avg(extract(epoch from (closed_at-opened_at))/86400)::numeric,1) as avg_days
         from ops_rights where opened_at > ${SINCE} group by kind`, [days]),
      q(`select count(*)::int as days_run,
                count(*) filter (where not ok)::int as days_failed,
                coalesce(sum(records_deleted),0)::int as deleted
         from ops_deletion where day > current_date - $1::int`, [days]),
      q(`select count(distinct visitor_day) filter (where visitor_day is not null)::int as people
         from ops_runs where at > ${SINCE} and outcome='COMPLETED'`, [days]),
      q("select height, head_hash, updated_at from ops_chain where name='ops_runs'"),
      q('select at, height, intact, broken_at, ms from ops_verify order by at desc limit 1'),
      q(`select count(*)::int as total,
                count(*) filter (where pi_involved)::int as pi,
                count(*) filter (where rrosh)::int as rrosh,
                count(*) filter (where reported)::int as reported
         from ops_incident where at > ${SINCE}`, [days]),
      q("select height, head_hash, updated_at from ops_chain where name='ops_policy'"),
      q(`select seq, at, version, effective_from, change_kind, summary, reason, evidence_url,
                author, sources_enabled, sources_total, enforcement_on, manifest_generated
           from ops_policy order by seq desc limit 10`),
      q('select hash_schema, count(*)::int as n from ops_runs group by hash_schema order by hash_schema'),
      q(`select coalesce(sector,'UNDECLARED') as sector, count(*)::int as n
           from ops_runs where at > ${SINCE} group by 1 order by n desc`, [days]),
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
      /* Never asked is quiet, not down. A register the plan did not include was
         not refusing anybody, and a board that paints it red teaches an
         operator to ignore red. Down means planned, and no answer. */
      const reached = row && ((row.ok || 0) + (row.no_match || 0) + (row.computed || 0));
      const tried   = row && ((row.ok || 0) + (row.no_match || 0) + (row.failed || 0)
                              + (row.computed || 0));
      if (!tried)        registers.quiet[ci] = (registers.quiet[ci] || 0) + 1;
      else if (!reached) registers.down[ci]  = (registers.down[ci]  || 0) + 1;
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
    /* A CONNECTOR IS MEASURED ON WHETHER IT RAN, NOT ON WHETHER IT ANSWERED.
       Reading it the other way lit the direct feeds lamp red on every healthy
       day: a computed check has nobody to answer it, so ok was always nought
       and attempts was always high, which is the exact shape of an outage. */
    const connectorHealth = () => {
      const ids = CATALOGUE.filter(x => x.enabled && x.transport === 'connector')
        .map(x => x.source_id);
      let ran = 0, tried = 0;
      ids.forEach(id => {
        const x = seen[id]; if (!x) return;
        tried += x.attempts || 0;
        ran   += (x.computed || 0) + (x.ok || 0);
      });
      if (!tried) return 'warn';
      return ran > 0 ? 'ok' : 'bad';
    };
    /* Two different numbers that were being shown as one. HOW MANY REGISTERS
       we put a question to is a coverage number, out of the catalogue. HOW
       MANY TIMES we asked and got an answer back is a reliability number, out
       of the attempts. A board that prints "40.5% of 126" leaves a reader
       working out which of the two it is, and 126 is neither the catalogue nor
       a percentage of anything they can see. */
    /* THE DENOMINATOR IS WHAT WE ASK, NEVER THE WHOLE CATALOGUE.
       Fourteen rows are connectors, which are run rather than asked, so a
       coverage figure divided by the whole catalogue could never reach a
       hundred however well the sweep ran, and the missing thirteen points read
       as a hole rather than as the category error they were. */
    const enabled = CATALOGUE.filter(x => x.enabled && x.transport !== 'connector');
    const computedRows = CATALOGUE.filter(x => x.enabled && x.transport === 'connector');
    const reach = {
      catalogue: enabled.length,
      /* ASKED MEANS A QUESTION WENT OUT, NOT THAT A ROW EXISTS.
         Every applicable register got a row on every run, including the ones
         the plan never included, so attempts counted the writing down rather
         than the asking and this read as near total coverage while most of
         those rows said the register was never asked. */
      asked:     enabled.filter(x => { const r = seen[x.source_id] || {};
                   return ((r.ok || 0) + (r.no_match || 0) + (r.failed || 0)) > 0; }).length,
      answered:  enabled.filter(x => (seen[x.source_id] || {}).ok > 0).length,
      /* Asked and it had nothing, which is reached, and applied to the party
         and never got asked, which is a hole. Both used to be a missing row,
         and a missing row also meant routing had ruled the register out, so
         three different things read as one. */
      empty:     enabled.filter(x => ((seen[x.source_id] || {}).no_match || 0) > 0).length,
      missed:    enabled.filter(x => ((seen[x.source_id] || {}).failed || 0) > 0).length,
      /* Applicable, and the plan did not include it. A bound rather than a
         fault, and the first number to look at when coverage reads low. */
      unplanned: enabled.filter(x => ((seen[x.source_id] || {}).not_asked || 0) > 0).length,
      out:       enabled.filter(x => ((seen[x.source_id] || {}).out_of_scope || 0) > 0).length
    };
    /* A FINISHED RUN ALWAYS ASKS SOMETHING.
       So runs in the window with nought registers recorded is not a low number,
       it is an impossible pair, and it means the health table is not being
       written rather than that the sweep asked nothing. Printing the nought as
       though it were a measurement is how this sat unnoticed: the board showed
       nought per cent reached beside a healthy looking fifty nine per cent
       answering, and the two numbers were describing different tables. */
    reach.unwritten = (r.attempted || 0) > 0 && reach.asked === 0;
    /* And the checks we compute, counted apart and measured on whether they
       ran rather than on whether a source answered. */
    reach.computed = {
      total: computedRows.length,
      ran:   computedRows.filter(x => { const r = seen[x.source_id] || {};
               return ((r.computed || 0) + (r.ok || 0)) > 0; }).length
    };
    const rdapRow = seen.ICANN_RDAP || seen.RDAP_DATE || null;
    const dl = del[0] || {};
    const systems = {
      search:     health(s.attempts || 0, s.ok || 0),
      reason:     health(r.attempted || 0, r.completed || 0),
      connectors: connectorHealth(),
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
        /* An ask is a question that went out: it came back with something, it
           came back empty, it was not reached, or it timed out. A register the
           plan never included was not asked, and a connector was not asked
           either, so neither belongs in this denominator. */
        asks: (s.ok || 0) + (s.no_match || 0) + (s.failed || 0) + (s.timed_out || 0),
        empty: s.no_match || 0,
        success_pct: (function(){
          var asks = (s.ok || 0) + (s.no_match || 0) + (s.failed || 0) + (s.timed_out || 0);
          return asks ? +(100 * (s.ok + (s.no_match || 0)) / asks).toFixed(1) : null;
        })(),
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
      /* What it cost, and what the ceiling did about it. */
      spend: await spendBlock(q, days),
    });
  } catch (e) {
    logFault('admin-metrics', e);
    return res.status(500).json({ error: 'query_failed' });
  } finally {
    if (client) { try { await client.end(); } catch {} }
  }
}

