/**
 * 4orm IQ - RETENTION
 *
 * POST /api/retain
 * Authorization: Bearer <Clerk session token>
 *
 * Runs purge_expired() and records that it ran. The periods live in
 * db/retention.neon.sql beside the reason for each one, not here: a retention
 * period argued in application code is a period that changes whenever somebody
 * is in a hurry.
 *
 * Why this exists as a route rather than a cron. There is no scheduler in this
 * deployment, and a retention policy that depends on a job nobody can see run
 * is the same as no policy. This can be called by a platform scheduler, by a
 * cron elsewhere, or by hand, and every call writes a row to ops_retention, so
 * the fact that retention ran is evidence rather than an assurance. If it has
 * not run, the absence of rows says so.
 *
 * GET returns when it last ran and what it removed, without running anything.
 *
 * With Clerk unconfigured this route is disabled rather than left open, the
 * same direction as every other privileged route here.
 */

import { requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error, reason: auth.reason });

  if (!process.env.POSTGRES_URL)
    return res.status(503).json({ error: 'no_database_configured' });

  let client;
  try {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      max: 1, connectionTimeoutMillis: 5000
    });
    client = await pool.connect();
  } catch (e) {
    return res.status(503).json({ error: 'no_connection', reason: String(e.message || e).slice(0, 160) });
  }

  try {
    if (req.method === 'GET') {
      const last = await client.query(
        `select ran_at, ran_by, total_rows, result
           from ops_retention order by ran_at desc limit 12`);
      return res.status(200).json({
        ok: true,
        last_run: last.rows[0]?.ran_at || null,
        never_run: last.rows.length === 0,
        history: last.rows
      });
    }

    /* The purge itself. One function, one transaction, and it reports what it
       removed table by table so a run that deleted nothing is distinguishable
       from a run that did not happen. */
    const out = await client.query('select * from purge_expired()');
    const result = out.rows.map(r => ({ table: r.table_name, rows: Number(r.rows_deleted) }));
    const total = result.reduce((a, b) => a + b.rows, 0);

    await client.query(
      `insert into ops_retention (ran_by, result, total_rows) values ($1,$2,$3)`,
      [String(auth.email || auth.subject || 'admin').slice(0, 200), JSON.stringify(result), total]);

    return res.status(200).json({ ok: true, total_rows: total, result });
  } catch (e) {
    return res.status(500).json({ error: 'purge_failed', reason: String(e.message || e).slice(0, 200) });
  } finally {
    try { client.release(); } catch (e) { }
  }
}
