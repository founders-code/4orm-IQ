/* ================================ THE SPEND CEILING, PROVED RATHER THAN CLAIMED
   Every test here fails if the ceiling is removed, loosened past its stated
   default, or moved to after the first vendor call. That last one is the point:
   a rate limit that runs after the money is spent is decoration.

   Nothing in this file calls a vendor. It reads the route as text to prove the
   ordering, and exercises the module directly to prove the rules. */
import fs from 'fs';
import { reserve, settle, estimateUsd, LIMITS, RATES } from '../api/_budget.js';

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

/* ---- 1. The reservation happens before the first vendor call ------------ */
{
  const src = fs.readFileSync('api/check.js', 'utf8');
  const at = s => src.indexOf(s);

  ok(at('reserve(') > -1, 'check.js no longer takes a budget reservation at all');

  /* Everything that costs money, and where it first appears. */
  const spend = [
    ['exa(',            'the first Exa search'],
    ['parallel(',       'the first Parallel objective'],
    ['new Anthropic(',  'the Claude client'],
    ['messages.create', 'the Claude call'],
  ].map(([needle, name]) => [at(needle), name]).filter(([i]) => i > -1);

  ok(spend.length >= 3,
     'budgetcheck can no longer find the vendor calls in check.js to order against, '
   + 'so this test would pass vacuously');
  const gate = at('reserve(');
  for (const [i, name] of spend)
    ok(gate > -1 && gate < i,
       `the budget check does not run before ${name} in api/check.js`);

  ok(/if \(!budget\.ok\)/.test(src),
     'check.js takes a reservation but never refuses on it');
  ok(/return res\.status\(429\)/.test(src.slice(at('if (!budget.ok)'), at('if (!budget.ok)') + 600)),
     'a refused reservation no longer returns 429');

  /* No route may reach a vendor without going through the module. */
  for (const f of fs.readdirSync('api').filter(f => f.endsWith('.js'))) {
    const t = fs.readFileSync('api/' + f, 'utf8');
    const paid = /api\.exa\.ai|api\.parallel\.ai|@anthropic-ai\/sdk/.test(t);
    if (!paid) continue;
    if (f === '_retrieval.js' || f === '_budget.js') continue;   /* called by check.js, never a route */
    ok(/_budget\.js/.test(t), `api/${f} reaches a paid vendor without the spend ceiling`);
  }
}

/* ---- 2. The stated defaults are the enforced defaults ------------------- */
{
  const stated = { windowS: 60, maxRuns: 5, maxUsdWindow: 3.75, maxUsdDay: 12,
                   maxUsdAllDay: 120, strikesToBlock: 3, blockS: 900 };
  for (const [k, v] of Object.entries(stated))
    ok(LIMITS[k] === v, `LIMITS.${k} is ${LIMITS[k]}, the documented default is ${v}`);
  ok(RATES.exaSearch === 0.007 && RATES.parallelRun === 0.005,
     'the published Exa and Parallel list rates have drifted from .env.example');
}

/* ---- 3. The estimate is arithmetic, not a guess ------------------------- */
{
  const e = estimateUsd({ searches: 10, pages: 0, objectives: 0, inTok: 0, outTok: 0 });
  ok(Math.abs(e - 0.07) < 1e-9, `ten searches should cost 0.07, the module says ${e}`);
  const t = estimateUsd({ inTok: 1_000_000, outTok: 0 });
  ok(Math.abs(t - RATES.claudeInM) < 1e-9, 'a million input tokens is not priced at the input rate');
  ok(estimateUsd({}) === 0, 'an empty plan is not free');
}

/* ---- 4. Volume throttles ------------------------------------------------ */
const req = ip => ({ headers: { 'x-forwarded-for': ip } });
{
  const ip = '198.51.100.' + Math.floor(Math.random() * 200);
  let allowed = 0, refused = null;
  for (let i = 0; i < LIMITS.maxRuns + 2; i++) {
    const r = await reserve(req(ip), 0.001);
    if (r.ok) allowed++; else refused = refused || r;
  }
  ok(allowed === LIMITS.maxRuns,
     `the per-window ceiling let ${allowed} runs through, the ceiling is ${LIMITS.maxRuns}`);
  ok(refused && refused.reason === 'rate', 'the run over the ceiling was not refused on rate');
  ok(refused && refused.retry_after_s >= 1, 'a refusal carries no retry window');
}

/* ---- 5. Dollars throttle independently of volume ----------------------- */
{
  const ip = '198.51.100.' + (201 + Math.floor(Math.random() * 40));
  const big = LIMITS.maxUsdWindow;                  /* one run eats the window */
  const first  = await reserve(req(ip), big);
  const second = await reserve(req(ip), big);
  ok(first.ok, 'a single run at exactly the window ceiling was refused');
  ok(!second.ok && second.reason === 'window_spend',
     'a second run past the dollar ceiling was allowed on volume alone');
}

/* ---- 6. Repeat behaviour escalates to a block, volume alone does not ---- */
{
  const ip = '203.0.113.' + Math.floor(Math.random() * 250);
  const seen = [];
  for (let i = 0; i < LIMITS.maxRuns + LIMITS.strikesToBlock + 1; i++)
    seen.push(await reserve(req(ip), 0.001));
  const blocked = seen.filter(r => !r.ok && r.reason === 'blocked');
  ok(blocked.length > 0,
     'a client that kept arriving after being refused was never blocked, only throttled');
  ok(blocked.length === 0 || blocked[0].retry_after_s >= LIMITS.blockS,
     'the block is shorter than the stated block period');
  /* And it is behaviour, not size: one enormous request is refused, never blocked. */
  const solo = await reserve(req('203.0.113.251'), LIMITS.maxUsdDay * 10);
  ok(!solo.ok && solo.reason !== 'blocked',
     'one oversized request was blocked rather than refused, so size is escalating instead of behaviour');
}

/* ---- 7. A refusal never falls open ------------------------------------- */
{
  const ip = '192.0.2.77';
  for (let i = 0; i < LIMITS.maxRuns; i++) await reserve(req(ip), 0.001);
  const r = await reserve(req(ip), 0.001);
  ok(r.ok === false, 'the ceiling fell open once the per-instance ledger was warm');
  ok(typeof r.message === 'string' && r.message.length > 0,
     'a refusal carries no message for the reader');
  ok(!/\d+\.\d+\.\d+\.\d+/.test(JSON.stringify(r)),
     'a refusal carries an IP address back to the client');
}

/* ---- 8. Settling never throws and never refuses ------------------------ */
{
  await settle(null, {});
  await settle({ ok: false }, {});
  await settle({ ok: true, hashed: false, key: 'x' }, { searches: 1 });
  ok(true, 'unreachable');
}

if (fails.length) { console.error('budgetcheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('budgetcheck ok  ceiling ' + LIMITS.maxRuns + ' runs and $' +
  LIMITS.maxUsdWindow.toFixed(2) + ' per ' + LIMITS.windowS + 's, $' +
  LIMITS.maxUsdDay.toFixed(2) + ' per client per day, $' +
  LIMITS.maxUsdAllDay.toFixed(2) + ' house per day');
