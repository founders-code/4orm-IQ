/**
 * 4orm IQ - THE PUBLIC REGISTER
 *
 * Two jobs: record a party that carries a finding, and read the list back.
 *
 * The rule that governs everything in this file is that we publish somebody
 * else's record, or we publish a count. We do not publish a conclusion about a
 * named business. An official row prints the authority's name, the authority's
 * own words, the date and a link. A pattern row prints how many platforms and
 * how many reports, and says on the line itself that no authority has acted.
 *
 * A party with nothing against it never reaches this file, so the register
 * cannot become a list of everybody who has ever been looked up.
 *
 * Storage must never be able to break a check. Every path is wrapped and
 * returns a status rather than throwing. With POSTGRES_URL unset it is inert.
 */

let poolPromise = null;
async function pool() {
  if (!process.env.POSTGRES_URL) return null;
  if (!poolPromise) {
    poolPromise = (async () => {
      const { default: pg } = await import('pg');
      return new pg.Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false },
        max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 4000,
      });
    })().catch(() => null);
  }
  return poolPromise;
}

/* How many independent platforms make a pattern. The same number the report
   uses, because a threshold that means one thing on the report and another on
   the register is two products. */
export const PATTERN_PLATFORMS = 3;

/* How long a party has to answer before a pattern entry carries their name.
   Repeating somebody else's accusation is publication in Canada, so on a
   pattern entry we are the publisher, and the defence that carries it weighs
   whether we sought and fairly reported the other side. Until this window has
   passed the party is counted and not named. */
export const REPLY_DAYS = 14;

/* The recent window, in days. A count that never resets cannot show movement:
   a party checked four hundred times last year and never since would sit at the
   top of a list of what is happening now. */
export const RECENT_DAYS = 7;

/* One key per party, so the same firm reached by name and by domain is one row
   rather than two. Domain first, because it is the thing that does not vary. */
export function partyKey(name, domain) {
  const d = String(domain || '').toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
  if (d) return d;
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 80) || null;
}

/**
 * Record a check.
 *
 * entry.tier is 'official', 'pattern' or 'none'. On 'none' an existing row is
 * cleared rather than updated, because a party that no longer carries a finding
 * must come off the list on its own, without anybody having to ask.
 */
export async function recordRegister(entry) {
  const p = await pool();
  if (!p) return { ok: false, reason: 'no_database' };
  const key = partyKey(entry?.name, entry?.domain);
  if (!key) return { ok: false, reason: 'no_key' };
  const tier = entry?.tier;

  try {
    if (tier !== 'official' && tier !== 'pattern') {
      /* Nothing against them. Clear a row if one exists, create none if it
         does not. This is the delisting path and it runs on every clean check. */
      const r = await p.query(
        `update ops_register set cleared_at = now(), last_seen = now()
           where party_key = $1 and cleared_at is null`, [key]);
      return { ok: true, tier: 'none', cleared: r.rowCount > 0 };
    }

    const r = await p.query(
      `insert into ops_register
         (party_key, display_name, domain, tier, authority, authority_url,
          finding, found_at, platforms, reports, named_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               case when $4 = 'official' then now() else null end)
       on conflict (party_key) do update set
         display_name  = excluded.display_name,
         domain        = coalesce(excluded.domain, ops_register.domain),
         tier          = excluded.tier,
         authority     = excluded.authority,
         authority_url = excluded.authority_url,
         finding       = excluded.finding,
         found_at      = excluded.found_at,
         platforms     = excluded.platforms,
         reports       = excluded.reports,
         searches      = ops_register.searches + 1,
         /* the recent counter rolls rather than accumulating, so the list can
            show what is moving now rather than what moved once */
         recent        = case when ops_register.recent_from < current_date - $11::int
                              then 1 else ops_register.recent + 1 end,
         recent_from   = case when ops_register.recent_from < current_date - $11::int
                              then current_date else ops_register.recent_from end,
         last_seen     = now(),
         cleared_at    = null,
         /* An official finding is named at once, because the authority already
            named them and we are pointing at their record. A pattern finding is
            named only by nameRegister, after the reply window. A party that
            moves from pattern to official is named on the spot. */
         named_at      = case when excluded.tier = 'official'
                              then coalesce(ops_register.named_at, now())
                              else ops_register.named_at end
       returning searches, recent, first_seen, named_at`,
      [key,
       String(entry.name || '').slice(0, 160),
       entry.domain ? String(entry.domain).slice(0, 160) : null,
       tier,
       entry.authority ? String(entry.authority).slice(0, 160) : null,
       entry.authorityUrl ? String(entry.authorityUrl).slice(0, 500) : null,
       entry.finding ? String(entry.finding).slice(0, 400) : null,
       entry.foundAt || null,
       Number(entry.platforms) || 0,
       Number(entry.reports) || 0,
       RECENT_DAYS]);
    const row = r.rows[0] || {};
    return { ok: true, tier, searches: Number(row.searches) || 1,
             named: !!row.named_at };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 120) };
  }
}

/**
 * Read the register back. Public, so it returns only what may be published.
 */
export async function readRegister(limit = 60) {
  const p = await pool();
  if (!p) return { ok: false, reason: 'no_database', items: [], counts: null };
  const n = Math.max(1, Math.min(200, Number(limit) || 60));
  try {
    const r = await p.query(
      `select party_key, display_name, domain, tier, authority, authority_url,
              finding, found_at, platforms, reports, searches, recent,
              first_seen, last_seen, named_at, contacted_at, reply, reply_at
         from ops_register
        where cleared_at is null
        order by (tier = 'official') desc, recent desc, searches desc
        limit $1`, [n]);

    const c = await p.query(
      `select count(*)::int as parties,
              count(*) filter (where tier = 'official')::int as official,
              count(*) filter (where tier = 'pattern')::int  as pattern,
              count(*) filter (where first_seen > now() - interval '7 days')::int as fresh,
              count(*) filter (where named_at is null)::int as unnamed
         from ops_register where cleared_at is null`);

    const now = Date.now();
    const items = r.rows.map(x => {
      const firstMs = new Date(x.first_seen).getTime();
      const days = (now - firstMs) / 86400000;
      /* THE GATE, ENFORCED HERE AND NOWHERE ELSE.
         One place decides whether a name leaves this server. A row that has not
         been named yet goes out with its counts and no name at all, so a bug in
         the page cannot publish one: there is nothing to publish. */
      const named = !!x.named_at;
      return {
        name: named ? x.display_name : null,
        domain: named ? x.domain : null,
        named,
        awaitingReply: !named,
        contacted: !!x.contacted_at,
        reply: named && x.reply ? String(x.reply) : null,
        replyAt: named && x.reply_at ? new Date(x.reply_at).toISOString().slice(0, 10) : null,
        tier: x.tier,
        authority: x.authority,
        authorityUrl: x.authority_url,
        finding: x.finding,
        foundAt: x.found_at ? String(x.found_at).slice(0, 10) : null,
        platforms: Number(x.platforms) || 0,
        reports: Number(x.reports) || 0,
        searches: Number(x.searches) || 0,
        recent: Number(x.recent) || 0,
        firstSeen: new Date(x.first_seen).toISOString().slice(0, 10),
        lastSeen: new Date(x.last_seen).toISOString().slice(0, 10),
        /* new means new to this register, not new to the world, and rising
           means more than half its checks landed in the last week. Neither is
           a judgement about the party. */
        isNew: days <= RECENT_DAYS,
        rising: (Number(x.searches) || 0) >= 4 &&
                (Number(x.recent) || 0) * 2 >= (Number(x.searches) || 0),
      };
    });
    return { ok: true, items, counts: c.rows[0] || null };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 120), items: [], counts: null };
  }
}

/**
 * Name a pattern entry, or record a reply.
 *
 * Both are deliberate acts by a person, not something a check does. Naming
 * happens after the party has been contacted and the reply window has passed;
 * a reply is printed beside the entry whether or not it changes anything.
 */
export async function nameRegister(key, opts) {
  const p = await pool();
  if (!p) return { ok: false, reason: 'no_database' };
  if (!key) return { ok: false, reason: 'no_key' };
  try {
    if (opts && opts.contacted) {
      await p.query('update ops_register set contacted_at = now() where party_key = $1', [key]);
    }
    if (opts && typeof opts.reply === 'string') {
      await p.query(
        'update ops_register set reply = $2, reply_at = now() where party_key = $1',
        [key, opts.reply.slice(0, 2000)]);
    }
    if (opts && opts.name) {
      /* Refuses to name a party nobody has written to. The window is not a
         formality: it is the thing the defence turns on. */
      const r = await p.query(
        `update ops_register set named_at = now()
           where party_key = $1 and named_at is null
             and contacted_at is not null
             and contacted_at < now() - ($2::int * interval '1 day')
         returning party_key`, [key, REPLY_DAYS]);
      if (!r.rowCount) return { ok: false, reason: 'not_contacted_or_too_soon' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 120) };
  }
}

/* ------------------------------------------------------------------ *
 * WHAT A RUN EARNS
 *
 * The same ladder the report uses, computed from the same payload, so a party
 * the report called an official finding cannot appear on the register as a
 * pattern, or the other way round. One ladder, two readers.
 *
 * official  a tier A source, which means a regulator, court, registry or
 *           government body, carries an adverse record. The authority's name,
 *           its own words and its link come out of the evidence, never out of
 *           us. If we cannot produce all three, it is not an official entry.
 * pattern   no authority has acted, and the same kind of report appears on
 *           three or more independent platforms.
 * none      everything else, including a single bad review, a hundred bad
 *           reviews on one platform, and a check that did not finish.
 * ------------------------------------------------------------------ */
function evHost(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

export function classifyForRegister(payload) {
  const p = payload || {};
  const cats = p.cats || {};
  const out = { tier: 'none', name: p.name || '', domain: p.domain || '' };
  if (!out.name && !out.domain) return out;

  /* An authority has acted. The first tier A record inside an adverse category
     is the one we publish, because it is the one the report led on. */
  for (const k of Object.keys(cats)) {
    const c = cats[k] || {};
    if (c.state !== 'RED') continue;
    for (const e of (c.ev || [])) {
      if (e.t !== 'A') continue;
      if (!e.src || !e.find) continue;
      return {
        ...out,
        tier: 'official',
        authority: e.src,
        authorityUrl: e.url || null,
        finding: e.find,
        foundAt: e.when || p.asOf || null,
      };
    }
  }

  /* Nobody has acted. Count the independent platforms carrying something, and
     count platforms, not posts: a hundred reports on one board is one board. */
  const hosts = new Set();
  let reports = 0;
  for (const k of Object.keys(cats)) {
    for (const e of ((cats[k] || {}).ev || [])) {
      if (e.t !== 'C' && e.t !== 'D') continue;
      const h = evHost(e.url);
      if (h) hosts.add(h);
      reports += 1;
    }
  }
  if (hosts.size >= PATTERN_PLATFORMS) {
    return { ...out, tier: 'pattern', platforms: hosts.size, reports };
  }
  return out;
}
