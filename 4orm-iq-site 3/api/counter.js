/**
 * 4orm IQ - THE PUBLIC COUNTER
 *
 * GET /api/counter
 *
 * Two numbers, both read off the chained operations log, plus the chain head so
 * anyone can see the count refers to a specific verifiable state rather than a
 * figure we typed.
 *
 *   checks  completed checks. Every one is a row in the chain.
 *   people  distinct visitor-days. Two checks by one person on one day count
 *           once. It is a floor on people helped, never an exact headcount, and
 *           it is null when OPS_SALT is unset because then no visitor-day was
 *           ever written.
 *
 * The rule that governs this file is the rule that governs the whole product.
 * If the number is not real, there is no number. No seeding, no smoothing, no
 * client-side extrapolation, no counting of page views or retries or internal
 * runs. A counter that invents its own number is Rule Zero with a nicer font.
 */

let cache = { at: 0, body: null };
const TTL = 60_000;

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
  if (!process.env.POSTGRES_URL) return { available: false, reason: 'no_database_configured' };
  let client;
  try {
    const { default: pg } = await import('pg');
    client = new pg.Client({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000, query_timeout: 4000,
    });
    await client.connect();
    const r = (await client.query(
      `select count(*) filter (where outcome='COMPLETED')::int      as checks,
              count(distinct visitor_day) filter
                (where outcome='COMPLETED' and visitor_day is not null)::int as people,
              min(at) filter (where outcome='COMPLETED')            as since
         from ops_runs`)).rows[0] || {};
    const h = (await client.query(
      "select height, head_hash, updated_at from ops_chain where name='ops_runs'")).rows[0] || {};
    return {
      available: true,
      checks: r.checks ?? 0,
      people: r.people ? r.people : null,
      since: r.since ? new Date(r.since).toISOString().slice(0, 10) : null,
      chain: { height: Number(h.height || 0),
               head: h.head_hash ? String(h.head_hash).slice(0, 12) : null },
    };
  } catch {
    /* Unreachable, wrong credentials, table not migrated. All the same answer:
       we do not have a real number, so we do not show one. */
    return { available: false, reason: 'unavailable' };
  } finally {
    if (client) { try { await client.end(); } catch {} }
  }
}
