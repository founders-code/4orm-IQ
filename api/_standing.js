/**
 * 4orm IQ - THE POSITIVE SIDE, AND WHY IT IS RANKED THE WAY IT IS
 *
 * Until now this product only ever went looking for what was wrong. That is
 * defensible on its own terms, because a one star review costs the writer
 * something and a five star review can be bought for the price of a weekend.
 * It is also how a good company gets stalled: a run on a registered Canadian
 * dealer returned a foreign warning about a different company with a similar
 * name, one unhappy review, and the sentence "we could not confirm this
 * business on a relevant register", while the register that would have cleared
 * them was never asked.
 *
 * So favourable evidence is collected. It is ranked by ONE question, which is
 * the only question that matters here:
 *
 *   How hard is this to buy?
 *
 *   TIER 1  Cannot be bought.
 *           A live registration, a licence in good standing, a regulator's own
 *           record, a filed financial statement, a court record showing a
 *           matter resolved, an exchange listing. These are facts about
 *           standing, not opinions about service. Nobody sells them.
 *
 *   TIER 2  Expensive to fake.
 *           Continuity rather than content. The same legal name across three
 *           registers. On the register since 2018. A domain eight years old.
 *           A filing history without gaps. Nobody buys eight years.
 *
 *   TIER 3  Buyable.
 *           Star ratings, review counts, testimonials, award badges, press
 *           releases, "as featured in" strips. Shown, labelled, and never
 *           counted toward the result.
 *
 * And one rule holds the whole thing up:
 *
 *   FAVOURABLE EVIDENCE NEVER CHANGES THE RESULT.
 *
 * It adds context and nothing else. Register standing and adverse findings set
 * the result, full stop. Once a bought review has nowhere to move the needle,
 * buying reviews stops being an attack on this product. That is a cheaper
 * defence than any detector, and it does not have false positives.
 *
 * The scale of the thing being defended against, from the platforms' own
 * numbers: Trustpilot removed 4.5 million reviews it had detected as fake in
 * 2024, 7.4 per cent of everything submitted that year, and says 90 per cent
 * of those were caught by its own automated detection.
 *   Trustpilot Trust Report 2025
 * Buying positive reviews, writing insider reviews without disclosing the
 * connection, and threatening people into pulling negative ones have all been
 * unlawful in the United States since October 2024.
 *   FTC final rule, 16 CFR Part 465
 */

export const STANDING_TIERS = {
  1: { key: 'cannot_be_bought', label: 'Cannot be bought',
       note: 'A public body published this. It is a fact about their standing, not an opinion about their service.' },
  2: { key: 'hard_to_fake',     label: 'Expensive to fake',
       note: 'This is continuity rather than praise. Nobody buys eight years of filing history.' },
  3: { key: 'buyable',          label: 'Can be bought',
       note: 'Ratings, testimonials and badges can be paid for. We show them and we do not count them.' }
};

/* What each tier is allowed to do. Read by the page and enforced in check.js. */
export const TIER_POWERS = {
  1: { counts: true,  shows: true },
  2: { counts: false, shows: true },
  3: { counts: false, shows: true }
};

const T1_WORDS = [
  'register', 'registry', 'registered', 'registration', 'licence', 'license',
  'licensed', 'authorised', 'authorized', 'good standing', 'exemptive relief',
  'restricted dealer', 'investment dealer', 'exempt market dealer', 'member of',
  'filed', 'filing', 'annual return', 'financial statement', 'audited',
  'prospectus', 'listed on', 'exchange listing', 'court', 'judgment', 'dismissed',
  'resolved', 'settled', 'no enforcement', 'incorporation', 'articles'
];

const T2_WORDS = [
  'since', 'established', 'incorporated in', 'first registered', 'operating since',
  'domain created', 'first archived', 'continuous', 'without interruption',
  'same legal name', 'appears on', 'filing history', 'years'
];

const T3_WORDS = [
  'review', 'reviews', 'rating', 'star', 'stars', 'trustpilot', 'testimonial',
  'testimonials', 'award', 'awards', 'badge', 'best of', 'top rated', 'featured in',
  'press release', 'newswire', 'sponsored', 'partner of the year'
];

const SELF_HOSTS = ['about us', 'our story', 'why choose', 'our team', 'press release', 'newsroom'];

/**
 * Rank one favourable record. Returns { tier, why, counts }.
 * Anything not positively identified as tier 1 or tier 2 falls to tier 3, which
 * is the safe direction: it can still be shown, and it cannot move the result.
 */
export function rankStanding(item = {}) {
  const hay = [item.source, item.src, item.label, item.finding, item.find,
               item.kind, item.quote].filter(Boolean).join(' ').toLowerCase();
  const tier = String(item.tier || '').toUpperCase();

  /* A record served from a public body at source tier A is tier 1 by origin,
     whatever words it happens to use. */
  if (tier === 'A' || T1_WORDS.some(w => hay.includes(w)))
    if (!T3_WORDS.some(w => hay.includes(w)) || tier === 'A')
      return { tier: 1, why: 'published by a public body', counts: true };

  if (T2_WORDS.some(w => hay.includes(w)) && !T3_WORDS.some(w => hay.includes(w)))
    return { tier: 2, why: 'continuity over time rather than praise', counts: false };

  if (T3_WORDS.some(w => hay.includes(w)))
    return { tier: 3, why: 'a rating, testimonial or badge', counts: false };

  return { tier: 3, why: 'not established as a public record', counts: false };
}

/** A party's own words about itself are never evidence about that party. */
export function isSelfDescribed(item = {}, domain = '') {
  const url = String(item.url || '').toLowerCase();
  const src = String(item.source || item.src || '').toLowerCase();
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (d && url.includes('//' + d)) return true;
  if (d && url.includes('.' + d)) return true;
  if (/their (own )?(site|website|page)|the (company|business|firm)'?s own/.test(src)) return true;
  return SELF_HOSTS.some(w => src.includes(w));
}

/* ------------------------------------------------------------------------ *
 * THE SHAPE OF A BOUGHT CORPUS
 *
 * We never call a review fake and we never call a reviewer a liar. We do not
 * know, and saying so would be the same mistake in the other direction. What
 * we can do is describe the SHAPE of the pile, which is a fact about the pile
 * and not an accusation against anybody in it.
 *
 * Four shapes are worth reporting, and each of them is arithmetic:
 *   burst      a large share of the favourable reviews landed in a few days
 *   generic    the favourable text is short and says nothing specific
 *   bimodal    only fives and only ones, with nothing in between
 *   one_off    most favourable reviewers have written exactly one review ever
 *
 * A real business accumulates reviews the way it accumulates customers, which
 * is unevenly but continuously, and its customers say specific things. None of
 * these four on its own proves anything. Two or more together is worth putting
 * in front of a consumer, phrased as what it is.
 * ------------------------------------------------------------------------ */

export const SHAPE_RULES = {
  burst:   { threshold: 0.40, window_days: 7,
             say: 'A large share of the favourable reviews were posted within a few days of each other.' },
  generic: { threshold: 0.60, max_words: 12,
             say: 'Most of the favourable reviews are very short and do not describe anything specific.' },
  bimodal: { threshold: 0.85,
             say: 'The ratings are almost all top marks or bottom marks, with very little in between.' },
  one_off: { threshold: 0.70,
             say: 'Most of the favourable reviews come from accounts that have written only one review.' }
};

/**
 * shapeSignals(reviews)
 *   reviews  [{ stars, date, text, author_review_count }]
 *
 * Returns { signals:[{id, say, value}], flagged:boolean, note }.
 * flagged is true only at two or more signals, because one on its own is noise.
 */
export function shapeSignals(reviews = []) {
  const rows = (reviews || []).filter(r => r && typeof r === 'object');
  const signals = [];
  if (rows.length < 8) {
    return { signals: [], flagged: false, sample: rows.length,
             note: 'There were too few reviews to say anything about the shape of them.' };
  }

  const pos = rows.filter(r => Number(r.stars) >= 4);
  const share = (n, d) => (d > 0 ? n / d : 0);

  /* burst: the biggest 7 day cluster of favourable reviews */
  const dated = pos.map(r => +new Date(r.date)).filter(t => !isNaN(t)).sort((a, b) => a - b);
  if (dated.length >= 5) {
    let best = 0;
    for (let i = 0; i < dated.length; i++) {
      let j = i;
      while (j < dated.length && dated[j] - dated[i] <= SHAPE_RULES.burst.window_days * 86400000) j++;
      best = Math.max(best, j - i);
    }
    const v = share(best, dated.length);
    if (v >= SHAPE_RULES.burst.threshold)
      signals.push({ id: 'burst', say: SHAPE_RULES.burst.say, value: Number(v.toFixed(2)) });
  }

  /* generic: short favourable text */
  const words = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
  if (pos.length >= 5) {
    const v = share(pos.filter(r => words(r.text) > 0 && words(r.text) <= SHAPE_RULES.generic.max_words).length, pos.length);
    if (v >= SHAPE_RULES.generic.threshold)
      signals.push({ id: 'generic', say: SHAPE_RULES.generic.say, value: Number(v.toFixed(2)) });
  }

  /* bimodal: only the extremes */
  const ends = rows.filter(r => Number(r.stars) >= 5 || Number(r.stars) <= 1).length;
  const vb = share(ends, rows.length);
  if (vb >= SHAPE_RULES.bimodal.threshold)
    signals.push({ id: 'bimodal', say: SHAPE_RULES.bimodal.say, value: Number(vb.toFixed(2)) });

  /* one_off: single review accounts */
  const known = pos.filter(r => Number.isFinite(Number(r.author_review_count)));
  if (known.length >= 5) {
    const v = share(known.filter(r => Number(r.author_review_count) <= 1).length, known.length);
    if (v >= SHAPE_RULES.one_off.threshold)
      signals.push({ id: 'one_off', say: SHAPE_RULES.one_off.say, value: Number(v.toFixed(2)) });
  }

  const flagged = signals.length >= 2;
  return {
    signals, flagged, sample: rows.length,
    note: flagged
      ? 'The favourable reviews for this business do not have the shape a real customer base usually '
      + 'leaves behind. We are not saying any single review is false. We are telling you what the pile '
      + 'looks like, so you can decide how much of it to lean on.'
      : 'Nothing about the shape of these reviews stood out.'
  };
}

export default { STANDING_TIERS, TIER_POWERS, SHAPE_RULES, rankStanding, isSelfDescribed, shapeSignals };
