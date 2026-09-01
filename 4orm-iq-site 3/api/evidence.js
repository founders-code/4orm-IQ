/**
 * 4orm IQ - CHAIN VERIFICATION
 *
 * GET /api/evidence          the chain head, and the last verification run
 * GET /api/evidence?run=1    walk the chain now and report
 *
 * Admin only. Walking the chain is the expensive operation on this deployment
 * and an open endpoint for it is a way to be knocked over.
 *
 * What this proves and what it does not. It proves the operations log has not
 * been altered since each row was written, so the counter refers to a state
 * somebody can check. It does not establish legal admissibility and it does not
 * prove anything about the checks themselves.
 */

import { requireAdmin } from './_auth.js';
import { verifyChain } from './_ops.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error, reason: auth.reason });
  if (!process.env.POSTGRES_URL) return res.status(503).json({ error: 'no_database_configured' });

  if (req.query.run === '1') {
    const limit = Math.min(500000, Math.max(0, parseInt(req.query.limit, 10) || 0));
    return res.status(200).json(await verifyChain(limit || null));
  }

  let client;
  try {
    const { default: pg } = await import('pg');
    client = new pg.Client({ connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 4000, query_timeout: 6000 });
    await client.connect();
    const head = (await client.query(
      "select height, head_hash, updated_at from ops_chain where name='ops_runs'")).rows[0] || {};
    const last = (await client.query(
      'select at, height, head_hash, intact, broken_at, ms from ops_verify order by at desc limit 5')).rows;
    return res.status(200).json({ head, verifications: last });
  } catch (e) {
    return res.status(500).json({ error: 'query_failed', detail: String(e.message || e).slice(0, 200) });
  } finally {
    if (client) { try { await client.end(); } catch {} }
  }
}
