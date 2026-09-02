/**
 * 4orm IQ - THE PUBLIC REGISTER, READ
 *
 * Public and unauthenticated, because the whole point of it is that anybody can
 * see what is already on the record before they send money.
 *
 * It returns only what may lawfully be published. The naming gate is enforced
 * in _register.js, on the way out of the database, so a party whose reply
 * window has not passed arrives here with no name attached and there is nothing
 * for this file, or the page, to leak.
 */

import { readRegister } from './_register.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const limit = Number(req.query?.limit) || 60;
  const r = await readRegister(limit).catch(e => ({
    ok: false, reason: String(e?.message || e).slice(0, 120), items: [], counts: null
  }));

  /* Two minutes. Long enough that the page is not a load test on the database,
     short enough that a party cleared this morning is off it by lunchtime. */
  res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=120');
  return res.status(200).json({
    ok: r.ok,
    reason: r.ok ? undefined : r.reason,
    asOf: new Date().toISOString().slice(0, 10),
    counts: r.counts,
    items: r.items,
  });
}
