/**
 * 4orm IQ - PUBLIC COUNTERS
 *
 * GET /api/stats
 *
 * The only thing the read side serves, and it serves one number: how many
 * checks this engine has actually run.
 *
 * The rule that governs this file is the same one that governs everything
 * else. If the number is not real, there is no number. With POSTGRES_URL
 * unset, with the table missing, or with the query failing, this returns
 * `available: false` and the page renders nothing at all. It never falls
 * back to an estimate, a seed value, or a figure that climbs on a timer.
 * A counter that invents its own number is Rule Zero with a nicer font.
 */

let cache = { at: 0, body: null };
const TTL = 60_000;   /* one minute. A live count does not need to be to the second. */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (cache.body && Date.now() - cache.at < TTL) return res.status(200).json(cache.body);

  const out = await read();
  cache = { at: Date.now(), body: out };
  return res.status(200).json(out);
}

async function read() {
  if (!process.env.POSTGRES_URL) {
    return { available: false, reason: 'no_database_configured' };
  }
  try {
    const { default: pg } = await import('pg');
    const client = new pg.Client({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
      query_timeout: 4000
    });
    await client.connect();
    try {
      const r = await client.query(
        `select count(*)::int as runs,
                count(distinct coalesce(domain, identifier))::int as parties,
                min(created_at) as since
           from runs`
      );
      const row = r.rows[0] || {};
      /* A count of zero is a real answer and it is published as one. */
      return {
        available: true,
        runs: row.runs ?? 0,
        parties: row.parties ?? 0,
        since: row.since ? new Date(row.since).toISOString().slice(0, 10) : null
      };
    } finally {
      try { await client.end(); } catch {}
    }
  } catch (e) {
    /* Unreachable, wrong credentials, table not migrated. All the same answer:
       we do not have a real number, so we do not show one. */
    return { available: false, reason: 'unavailable' };
  }
}
