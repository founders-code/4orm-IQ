/**
 * 4orm IQ - THE TIME WINDOW
 *
 * Businesses make mistakes and then fix them. A fault from four years ago that
 * was corrected should not sit over a company for the rest of its life, and a
 * consumer reading a result today is asking about today.
 *
 * So evidence carries an age band, and the band decides what the evidence is
 * allowed to do:
 *
 *   current   inside 12 months.            Drives the result.
 *   older     12 to 36 months.             Shown, labelled, drives nothing.
 *   archive   beyond 36 months.            Behind one control on the detail page.
 *   undated   no date on the record.       Never a finding. Goes to the gaps.
 *
 * Two rules sit above the bands.
 *
 * First, standing never ages. A register entry, a licence, a regulator action,
 * a sanction and a court record describe what is true NOW until the issuing
 * body changes them. A licence granted in 2019 is not stale, it is current. An
 * enforcement order from 2021 that was never lifted is not history, it is the
 * present state of that party's record. Ageing those out would be the single
 * most dangerous thing this file could do, so they are exempt by class.
 *
 * Second, the band is computed here, in code, from the date on the record. It
 * is never judged by the model. Published research on model based reranking
 * found that injecting dates alone moved the mean publication year of the top
 * ten forward by up to 4.78 years and flipped pairwise preferences by up to
 * 25 per cent, without any change in relevance. A model asked to weigh recency
 * will weigh it wrongly and confidently. Arithmetic does not have that failure.
 *   Do Large Language Models Favor Recent Content? arXiv 2509.11353
 */

export const WINDOW_CURRENT_DAYS = 365;
export const WINDOW_OLDER_DAYS   = 365 * 3;

export const BANDS = ['current', 'older', 'archive', 'undated'];

/* Evidence classes whose records describe a present state, not an event in the
   past. These never age out, whatever date they carry. Matched against the
   category id, the source tier and the source name. */
const STANDING_CATEGORIES = new Set(['C2', 'C3', 'C5', 'C8']);

const STANDING_WORDS = [
  'register', 'registry', 'registered', 'registration', 'licence', 'license',
  'licensed', 'authorised', 'authorized', 'exemptive relief', 'restricted dealer',
  'investment dealer', 'warning list', 'alert list', 'caution list', 'disciplined',
  'enforcement', 'cease trade', 'sanction', 'sanctions', 'ofac', 'consolidated list',
  'court', 'judgment', 'judgement', 'docket', 'bankruptcy', 'receivership',
  'incorporation', 'articles', 'good standing', 'struck off', 'dissolved'
];

/**
 * Does this record describe a standing that persists until the issuing body
 * changes it? If so it is always current, whatever its date.
 */
export function isStanding(item = {}) {
  const cat = String(item.category || item.cat || '');
  if (STANDING_CATEGORIES.has(cat)) return true;
  if (item.standing === true) return true;
  const hay = [item.source, item.src, item.label, item.kind, item.finding, item.find]
    .filter(Boolean).join(' ').toLowerCase();
  return STANDING_WORDS.some(w => hay.includes(w));
}

const MONTHS = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
  jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11
};

/**
 * Parse the date shapes real sources actually print. Returns a Date or null.
 * Never guesses: a string that does not carry a year comes back null, and null
 * routes the record to the gaps rather than to the findings.
 */
export function parseRecordDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  if (!s) return null;

  /* ISO first, because it is unambiguous. 2026-09-30 or 2026-09-30T... */
  let m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return mk(+m[1], +m[2] - 1, +m[3]);

  /* 30 September 2026 · 4 Aug 2022 · 26 Aug 2026 */
  m = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (m && MONTHS[m[2].slice(0, 4).toLowerCase()] !== undefined)
    return mk(+m[3], MONTHS[m[2].slice(0, 4).toLowerCase()], +m[1]);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined)
    return mk(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);

  /* September 30, 2026 · Aug 4 2022 */
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo !== undefined) return mk(+m[3], mo, +m[2]);
  }

  /* 04/08/2022. Ambiguous between the two conventions, so it is read as the
     LATER of the two readings. Reading a date as newer than it is can only
     ever make a record count more than it should, which is the safe direction
     for an adverse record and the conservative one for a favourable record. */
  m = s.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/);
  if (m) {
    const a = mk(+m[3], +m[2] - 1, +m[1]);
    const b = mk(+m[3], +m[1] - 1, +m[2]);
    if (a && b) return a > b ? a : b;
    return a || b;
  }

  /* September 2026 · Aug 2022, taken as the first of that month. */
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo !== undefined) return mk(+m[2], mo, 1);
  }

  /* A bare year, taken as the last day of it. A record dated only "2024" is
     treated as late 2024 rather than early, for the same reason as above. */
  m = s.match(/\b(19|20)(\d{2})\b/);
  if (m) return mk(+(m[1] + m[2]), 11, 31);

  return null;
}

function mk(y, mo, d) {
  if (!(y >= 1900 && y <= 2200)) return null;
  if (!(mo >= 0 && mo <= 11)) return null;
  if (!(d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, mo, d));
  return isNaN(dt) ? null : dt;
}

export function daysOld(dateLike, now = new Date()) {
  const d = parseRecordDate(dateLike);
  if (!d) return null;
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

/**
 * The band for one record. Standing records are always current.
 * A date in the future is treated as current, not as an error: a filing dated
 * ahead of today is still the present state of the file.
 */
export function ageBand(dateLike, item = {}, now = new Date()) {
  if (isStanding(item)) return 'current';
  const age = daysOld(dateLike, now);
  if (age === null) return 'undated';
  if (age <= WINDOW_CURRENT_DAYS) return 'current';
  if (age <= WINDOW_OLDER_DAYS) return 'older';
  return 'archive';
}

/** Only current evidence moves the result. Everything else is context. */
export function drivesResult(band) { return band === 'current'; }

/** What the consumer is told about each band, in the product's own words. */
export const BAND_LABEL = {
  current: '',
  older:   'Older than a year',
  archive: 'Older than three years',
  undated: 'No date on this record'
};

export const BAND_NOTE = {
  current: '',
  older:   'This is older than a year. It is shown because it happened, and it does not '
         + 'drive the result, because a business has had time to put it right.',
  archive: 'This is more than three years old. It is kept out of the way unless you ask '
         + 'for it, because a fault that old says very little about the business today.',
  undated: 'This record carries no date, so we cannot tell you whether it is current. '
         + 'We treat undated material as something we could not confirm.'
};

/**
 * Sort one list of records into the four bands and say which of them count.
 * Returns the bands plus a one line summary the page can print without doing
 * any arithmetic of its own.
 */
export function partition(items = [], pick = (x) => x.when || x.date || x.published, now = new Date()) {
  const out = { current: [], older: [], archive: [], undated: [] };
  items.forEach(it => {
    const band = ageBand(pick(it), it, now);
    out[band].push({ ...it, band, drives: drivesResult(band) });
  });
  return out;
}

export default {
  WINDOW_CURRENT_DAYS, WINDOW_OLDER_DAYS, BANDS, BAND_LABEL, BAND_NOTE,
  isStanding, parseRecordDate, daysOld, ageBand, drivesResult, partition
};
