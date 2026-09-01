/**
 * 4orm IQ - CHAIN VERIFICATION
 *
 * GET /api/evidence          both chain heads, the rule history, and the last
 *                            verification run
 * GET /api/evidence?run=1    walk both chains now and report
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
import { verifyChain, verifyPolicyChain, policyHistory } from './_ops.js';

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
    /* Both chains, because a runs chain that verifies while the rule history
       has been rewritten underneath it proves the wrong thing. */
    const [runs, policy] = await Promise.all([
      verifyChain(limit || null),
      verifyPolicyChain(),
    ]);
    return res.status(200).json(Object.assign({}, runs, { policy }));
  }

  let client;
  try {
    const { default: pg } = await import('pg');
    client = new pg.Client({ connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 4000, query_timeout: 6000 });
    await client.connect();
    const head = (await client.query(
      "select height, head_hash, updated_at from ops_chain where name='ops_runs'")).rows[0] || {};
    const policyHead = (await client.query(
      "select height, head_hash, updated_at from ops_chain where name='ops_policy'")).rows[0] || {};
    const last = (await client.query(
      'select at, height, head_hash, intact, broken_at, ms from ops_verify order by at desc limit 5')).rows;
    const schemas = (await client.query(
      'select hash_schema, count(*)::int as n from ops_runs group by hash_schema order by hash_schema')).rows;
    const rules = await policyHistory(25);
    return res.status(200).json({
      head, verifications: last, schemas,
      policy: { head: policyHead, history: rules.ok ? rules.rows : [], error: rules.ok ? null : rules.reason },
    });
  } catch (e) {
    return res.status(500).json({ error: 'query_failed', detail: String(e.message || e).slice(0, 200) });
  } finally {
    if (client) { try { await client.end(); } catch {} }
  }
}
