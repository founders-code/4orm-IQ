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

    const [runs, byOutcome, byInput, byDay, srcWorst, srcTotals, rights, del, ppl, chain, lastVerify, inc] = await Promise.all([
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
    ]);

    const r = runs[0] || {};
    const s = srcTotals[0] || {};
    return res.status(200).json({
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
        worst: srcWorst,
      },
      rights: rights,
      deletion: del[0] || {},
      people: (ppl[0] || {}).people ?? null,
      chain: Object.assign({}, chain[0] || {}, { last_verify: lastVerify[0] || null }),
      incidents: inc[0] || {},
    });
  } catch (e) {
    return res.status(500).json({ error: 'query_failed', detail: String(e.message || e).slice(0, 200) });
  } finally {
    if (client) { try { await client.end(); } catch {} }
  }
}

