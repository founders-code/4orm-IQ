/**
 * 4orm IQ - THE SPEND CEILING
 *
 * One place decides whether a request is allowed to spend money, and it decides
 * BEFORE the first vendor call, not after. Every route that reaches Exa,
 * Parallel or Claude calls reserve() first and settle() after.
 *
 * Three things are counted, per client and per window:
 *   runs   - how many checks a client started
 *   usd    - what those checks are estimated to cost before they run
 *   strikes- how many times the client was refused
 *
 * Volume alone throttles. Repeat behaviour blocks. A client that hits the
 * ceiling once waits for the window. A client that keeps arriving at the
 * ceiling after being told to wait is blocked for a period that doubles each
 * time, because that is a script rather than a person with a slow finger.
 *
 * Storage must never be able to break a check, and must never be able to let
 * one through either. Postgres is the ledger where it is configured; where it
 * is not, or where it fails, the in-memory ledger carries the same rules on a
 * single instance and the refusal still fires. It never falls open.
 */

import crypto from 'crypto';

/* ------------------------------------------------------------------ *
 * THE THRESHOLDS
 *
 * Every one is an environment variable with a stated default. The defaults
 * are set for a product that is not yet public: they are deliberately tight,
 * and they are the numbers the page was tested against.
 * ------------------------------------------------------------------ */
const num = (k, d) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v >= 0 ? v : d;
};

export const LIMITS = {
  windowS:      num('KBYS_BUDGET_WINDOW_S',        60),
  maxRuns:      num('KBYS_BUDGET_MAX_RUNS',         5),
  maxUsdWindow: num('KBYS_BUDGET_MAX_USD_WINDOW',   3.75),
  maxUsdDay:    num('KBYS_BUDGET_MAX_USD_DAY',     12.00),
  maxUsdAllDay: num('KBYS_BUDGET_MAX_USD_ALL_DAY', 120.00),
  strikeWindowS:num('KBYS_BUDGET_STRIKE_WINDOW_S', 900),
  strikesToBlock:num('KBYS_BUDGET_STRIKES',          3),
  blockS:       num('KBYS_BUDGET_BLOCK_S',         900),
  blockMaxS:    num('KBYS_BUDGET_BLOCK_MAX_S',   21600),
};

/* ------------------------------------------------------------------ *
 * THE RATE CARD
 *
 * Exa and Parallel are the published list rates, recorded in .env.example.
 * The Claude rates are the per-million figures for the configured model and
 * MUST be set from the vendor invoice before this is relied on for money.
 * They are used only to size the estimate; the enforced ceiling is in dollars,
 * so a wrong rate makes the gate tighter or looser, never absent.
 * ------------------------------------------------------------------ */
export const RATES = {
  exaSearch:   num('KBYS_RATE_EXA_SEARCH',   0.007),   /* per request        */
  exaPage:     num('KBYS_RATE_EXA_PAGE',     0.001),   /* per page of text   */
  parallelRun: num('KBYS_RATE_PARALLEL',     0.005),   /* per objective      */
  claudeInM:   num('KBYS_RATE_CLAUDE_IN_M',  3.00),    /* per million input  */
  claudeOutM:  num('KBYS_RATE_CLAUDE_OUT_M', 15.00),   /* per million output */
};

/**
 * What one check is expected to cost, before it runs.
 *
 * searches   pinned Exa searches in the plan
 * pages      how many of those ask for full text
 * objectives Parallel objectives in the plan
 * inTok/outTok  the Claude call, sized from the ceiling not the average,
 *               because the ceiling is what has to be affordable.
 */
export function estimateUsd({ searches = 0, pages = 0, objectives = 0,
                              inTok = 0, outTok = 0 } = {}) {
  return round5(
      searches   * RATES.exaSearch
    + pages      * RATES.exaPage
    + objectives * RATES.parallelRun
    + (inTok  / 1e6) * RATES.claudeInM
    + (outTok / 1e6) * RATES.claudeOutM
  );
}

const round5 = n => Math.round(n * 1e5) / 1e5;

/* ------------------------------------------------------------------ *
 * THE CLIENT KEY
 *
 * Hashed with the same salt the operations chain uses, so the ledger cannot
 * be read back into a list of IP addresses. Without a salt the key is the
 * address itself, which is what the in-memory ledger has always held, and it
 * is never written to Postgres in that state.
 * ------------------------------------------------------------------ */
export function clientKey(req) {
  const ip = String(
    req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || ''
  ).split(',')[0].trim() || 'unknown';
  const salt = process.env.OPS_SALT;
  if (!salt) return { key: ip, hashed: false };
  return {
    key: crypto.createHash('sha256').update('budget|' + salt + '|' + ip)
           .digest('hex').slice(0, 24),
    hashed: true,
  };
}

/* ------------------------------------------------------------------ *
 * THE IN-MEMORY LEDGER
 *
 * Per instance, lost on cold start. It is the floor, not the plan.
 * ------------------------------------------------------------------ */
const MEM = new Map();          /* key -> { runs:[t], usd:[[t,n]], strikes:[t], blockUntil, blockLen } */
let MEM_ALL = [];               /* [[t,n]] every client, for the daily house ceiling */

function memRow(key) {
  if (MEM.size > 20000) MEM.clear();
  let r = MEM.get(key);
  if (!r) { r = { runs: [], usd: [], strikes: [], blockUntil: 0, blockLen: 0 }; MEM.set(key, r); }
  return r;
}

const DAY_MS = 86_400_000;
function prune(r, now, winMs) {
  r.runs    = r.runs.filter(t => now - t < winMs);
  r.usd     = r.usd.filter(([t]) => now - t < DAY_MS);
  r.strikes = r.strikes.filter(t => now - t < LIMITS.strikeWindowS * 1000);
}

/* ------------------------------------------------------------------ *
 * THE POSTGRES LEDGER
 *
 * Optional. Shares the pool settings of the operations layer rather than
 * importing it, so that a failure on one side cannot take the other down.
 * ------------------------------------------------------------------ */
let poolPromise = null;
async function pool() {
  if (!process.env.POSTGRES_URL) return null;
  if (process.env.KBYS_BUDGET_STORE === 'memory') return null;
  if (!poolPromise) {
    poolPromise = (async () => {
      const { default: pg } = await import('pg');
      return new pg.Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false },
        max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 3000,
      });
    })().catch(() => null);
  }
  return poolPromise;
}

async function pgReserve(key, estUsd, now) {
  const p = await pool();
  if (!p) return null;
  const winMs = LIMITS.windowS * 1000;
  const c = await p.connect();
  try {
    await c.query('begin');
    await c.query(
      `insert into spend_client (client_key, updated_at) values ($1, now())
       on conflict (client_key) do update set updated_at = now()`, [key]);
    const { rows } = await c.query(
      `select
         coalesce(sum(case when at > now() - ($2 || ' milliseconds')::interval
                           then 1 else 0 end),0)::int             as runs_win,
         coalesce(sum(case when at > now() - ($2 || ' milliseconds')::interval
                           then est_usd else 0 end),0)::numeric   as usd_win,
         coalesce(sum(case when at > now() - interval '1 day'
                           then est_usd else 0 end),0)::numeric   as usd_day
       from spend_run where client_key = $1 and at > now() - interval '1 day'`,
      [key, String(winMs)]);
    const house = await c.query(
      `select coalesce(sum(est_usd),0)::numeric as usd_day
         from spend_run where at > now() - interval '1 day'`);
    const blk = await c.query(
      `select block_until, block_len_s,
              (select count(*) from spend_strike s
                where s.client_key = $1
                  and s.at > now() - ($2 || ' seconds')::interval)::int as strikes
         from spend_client where client_key = $1`,
      [key, String(LIMITS.strikeWindowS)]);
    await c.query('commit');
    return {
      runsWin:  rows[0].runs_win,
      usdWin:   Number(rows[0].usd_win),
      usdDay:   Number(rows[0].usd_day),
      usdAll:   Number(house.rows[0].usd_day),
      strikes:  blk.rows[0]?.strikes || 0,
      blockUntil: blk.rows[0]?.block_until ? new Date(blk.rows[0].block_until).getTime() : 0,
      blockLen:   Number(blk.rows[0]?.block_len_s || 0),
      store: 'postgres',
    };
  } catch {
    try { await c.query('rollback'); } catch {}
    return null;
  } finally { try { c.release(); } catch {} }
}

async function pgWriteRun(key, estUsd) {
  const p = await pool(); if (!p) return;
  try {
    await p.query('insert into spend_run (client_key, est_usd) values ($1, $2)',
                  [key, estUsd]);
  } catch {}
}
async function pgWriteStrike(key, blockUntil, blockLen, reason) {
  const p = await pool(); if (!p) return;
  try {
    await p.query('insert into spend_strike (client_key, reason) values ($1, $2)',
                  [key, String(reason || 'unknown').slice(0, 24)]);
    if (blockUntil) {
      await p.query(
        `update spend_client
            set block_until = to_timestamp($2 / 1000.0), block_len_s = $3
          where client_key = $1`, [key, blockUntil, blockLen]);
    }
  } catch {}
}
async function pgSettle(key, actualUsd) {
  const p = await pool(); if (!p) return;
  try {
    await p.query(
      `update spend_run set actual_usd = $2
         where id = (select id from spend_run where client_key = $1
                      order by at desc limit 1)`, [key, actualUsd]);
  } catch {}
}

/* ------------------------------------------------------------------ *
 * RESERVE
 *
 * Called once, before the first vendor call. Returns a decision, and where
 * the decision is to allow, the reservation is already recorded, so a burst
 * of concurrent requests cannot all read the same low count and pass.
 * ------------------------------------------------------------------ */
export async function reserve(req, estUsd, opts = {}) {
  const now = Date.now();
  const { key, hashed } = clientKey(req);
  const est = round5(Math.max(0, Number(estUsd) || 0));
  const winMs = LIMITS.windowS * 1000;

  /* Postgres where it is configured and healthy, memory where it is not.
     Both read the same counters and apply the same rules below. */
  let state = hashed ? await pgReserve(key, est, now) : null;
  const row = memRow(key);
  prune(row, now, winMs);
  MEM_ALL = MEM_ALL.filter(([t]) => now - t < DAY_MS);

  if (!state) {
    state = {
      runsWin: row.runs.length,
      usdWin:  row.usd.filter(([t]) => now - t < winMs).reduce((n, [, v]) => n + v, 0),
      usdDay:  row.usd.reduce((n, [, v]) => n + v, 0),
      usdAll:  MEM_ALL.reduce((n, [, v]) => n + v, 0),
      strikes: row.strikes.length,
      blockUntil: row.blockUntil,
      blockLen:   row.blockLen,
      store: 'memory',
    };
  } else {
    /* the block state lives in memory too, so a Postgres blip cannot lift it */
    state.blockUntil = Math.max(state.blockUntil, row.blockUntil);
    state.blockLen   = Math.max(state.blockLen,   row.blockLen);
    state.strikes    = Math.max(state.strikes,    row.strikes.length);
  }

  const decided = (verdict, reason, message, retryAfterS) => ({
    ok: verdict, reason, message,
    retry_after_s: Math.max(1, Math.ceil(retryAfterS || LIMITS.windowS)),
    est_usd: est, store: state.store,
    ceiling: { runs_per_window: LIMITS.maxRuns, window_s: LIMITS.windowS,
               usd_per_window: LIMITS.maxUsdWindow, usd_per_day: LIMITS.maxUsdDay },
    spent: { runs_window: state.runsWin, usd_window: round5(state.usdWin),
             usd_day: round5(state.usdDay) },
  });

  /* 1. an existing block outranks everything */
  if (state.blockUntil > now) {
    return decided(false, 'blocked',
      'This connection is paused. Checks will run again shortly.',
      (state.blockUntil - now) / 1000);
  }

  /* 2. the house ceiling. Nothing personal, and it never escalates, because a
        client that arrives on the day the house ceiling is reached has done
        nothing wrong. */
  if (state.usdAll + est > LIMITS.maxUsdAllDay) {
    return decided(false, 'house_ceiling',
      'Checking is paused for today. Nothing you did caused this.', 600);
  }

  /* 3. the per-client ceilings. Any one of the three refuses. */
  let why = null;
  if (state.runsWin + 1 > LIMITS.maxRuns)                     why = 'rate';
  else if (state.usdWin + est > LIMITS.maxUsdWindow)          why = 'window_spend';
  else if (state.usdDay + est > LIMITS.maxUsdDay)             why = 'day_spend';

  if (why) {
    /* A strike, and the escalation that follows from repeat behaviour rather
       than from the size of this one request. */
    row.strikes.push(now);
    const strikes = Math.max(state.strikes + 1, row.strikes.length);
    let blockUntil = 0, blockLen = 0;
    if (strikes >= LIMITS.strikesToBlock) {
      blockLen = Math.min(LIMITS.blockMaxS,
                          (row.blockLen ? row.blockLen * 2 : LIMITS.blockS));
      blockUntil = now + blockLen * 1000;
      row.blockUntil = blockUntil; row.blockLen = blockLen;
      row.strikes = [];
    }
    if (hashed) pgWriteStrike(key, blockUntil, blockLen, why).catch(() => {});
    if (blockUntil) {
      return decided(false, 'blocked',
        'This connection is paused. Checks will run again shortly.', blockLen);
    }
    const msg = why === 'rate'
      ? 'Too many checks. Wait a minute and try again.'
      : 'That is as much checking as this connection can run right now. Try again shortly.';
    return decided(false, why, msg,
      why === 'day_spend' ? 3600 : LIMITS.windowS);
  }

  /* 4. allowed. Record the reservation before returning, both sides. */
  row.runs.push(now);
  row.usd.push([now, est]);
  MEM_ALL.push([now, est]);
  if (hashed) pgWriteRun(key, est).catch(() => {});

  const out = decided(true, 'ok', null, LIMITS.windowS);
  out.key = key;
  out.hashed = hashed;
  return out;
}

/**
 * Settle the reservation against what the run actually cost. Never refuses
 * anything: the money is already spent by the time this is called. It exists
 * so the estimate can be checked against the invoice.
 */
export async function settle(reservation, actual = {}) {
  if (!reservation || !reservation.ok || !reservation.hashed) return;
  const usd = estimateUsd(actual);
  const measured = Number.isFinite(Number(actual.exaCostUsd))
    ? round5(usd - (actual.searches || 0) * RATES.exaSearch
                 - (actual.pages || 0) * RATES.exaPage
                 + Number(actual.exaCostUsd))
    : usd;
  await pgSettle(reservation.key, measured).catch(() => {});
}

/**
 * Whether the rate card is measured or still sitting on its defaults. The
 * control room prints this beside every dollar figure, because a dollar figure
 * built on a placeholder rate is an estimate wearing the clothes of a
 * measurement, and nothing in this product is allowed to do that.
 */
export function rateCard() {
  const set = k => typeof process.env[k] === 'string' && process.env[k].trim() !== '';
  return {
    rates: { ...RATES },
    exa_parallel: 'published list rate',
    claude_confirmed: set('KBYS_RATE_CLAUDE_IN_M') && set('KBYS_RATE_CLAUDE_OUT_M'),
    note: (set('KBYS_RATE_CLAUDE_IN_M') && set('KBYS_RATE_CLAUDE_OUT_M'))
      ? 'Claude priced from the rates set on this deployment.'
      : 'Claude is priced from a default, not from the invoice. '
      + 'Set KBYS_RATE_CLAUDE_IN_M and KBYS_RATE_CLAUDE_OUT_M before relying on these dollars.',
  };
}
