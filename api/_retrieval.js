/**
 * 4orm - Know Before You Send
 * Tier 1 and Tier 2: retrieval.
 *
 *   Tier 1  EXA        broad, fast, semantic. Pinned to real register domains
 *                      so "search the web" becomes "search the registers".
 *   Tier 2  PARALLEL   objective-driven, multi-query, citation-aware excerpts.
 *                      Used where the answer has to be assembled across sources
 *                      rather than found on one page.
 *
 * Neither of these reasons about anything. They fetch. The reasoning happens in
 * one Claude call afterwards, which is the only place judgment is paid for.
 */

const EXA_URL      = 'https://api.exa.ai/search';
const PARALLEL_URL = 'https://api.parallel.ai/v1/search';

/* Register domains, grouped by the check each one serves. Pinning a search to
   these is what separates a regulator's own page from an article about it. */
export const DOMAINS = {
  ca_securities: ['bcsc.bc.ca','asc.ca','osc.ca','securities-administrators.ca',
                  'autorites-valeurs-mobilieres.ca','ciro.ca','fcnb.ca','lautorite.qc.ca',
                  'fcaa.gov.sk.ca','nssc.novascotia.ca','mbsecurities.ca'],
  ca_payments:   ['fintrac-canafe.canada.ca','bankofcanada.ca','canada.ca'],
  ca_corporate:  ['ised-isde.canada.ca','canadasbusinessregistries.ca','ontario.ca','bcregistry.gov.bc.ca'],
  ca_courts:     ['canlii.org','scc-csc.ca','fct-cf.gc.ca','ic.gc.ca'],
  us:            ['sec.gov','finra.org','brokercheck.finra.org','adviserinfo.sec.gov',
                  'cftc.gov','nfa.futures.org','nmlsconsumeraccess.org','ftc.gov',
                  'ic3.gov','consumerfinance.gov','dfpi.ca.gov'],
  uk:            ['fca.org.uk','register.fca.org.uk','gov.uk',
                  'find-and-update.company-information.service.gov.uk'],
  intl:          ['asic.gov.au','mas.gov.sg','iosco.org','sfc.hk','fma.govt.nz','cysec.gov.cy','mfsa.mt'],
  sanctions:     ['sanctionssearch.ofac.treas.gov','treasury.gov','un.org','international.gc.ca'],
  /* Review hosts are grouped so each group can be pinned separately.
     DOMAINS.reviews stays as the union, because other callers use it. */
  reviews_major:     ['trustpilot.com','sitejabber.com','bbb.org','scamadviser.com','trustburn.com'],
  reviews_boards:    ['complaintsboard.com','ripoffreport.com','pissedconsumer.com'],
  reviews_community: ['forexpeacearmy.com','reddit.com','glassdoor.com','indeed.com',
                      'wikifx.com','fxempire.com','chainabuse.com']
};
DOMAINS.reviews = [...DOMAINS.reviews_major, ...DOMAINS.reviews_boards, ...DOMAINS.reviews_community];

/* Every review host the plan pins a search to. The ledger uses this to say
   "searched" honestly, rather than inferring it from whether anything came back. */
export const REVIEW_HOSTS = DOMAINS.reviews;

/* ------------------------------ EXA ------------------------------ */
export async function exa(query, opts = {}) {
  const key = process.env.EXA_API_KEY;
  if (!key) return { source: 'Exa', status: 'not_configured', results: [] };

  /* Exa bills per request and again per page per content type, so text is
     pulled only where the reasoning call needs prose. On a register lookup the
     highlight is the answer, and the full page is waste. */
  const body = {
    query,
    numResults: opts.numResults || 5,
    type: opts.type || 'auto',
    contents: opts.fullText
      ? { text: { maxCharacters: opts.maxChars || 2400 }, highlights: true }
      : { highlights: true }
  };
  if (opts.includeDomains) body.includeDomains = opts.includeDomains;
  if (opts.excludeDomains) body.excludeDomains = opts.excludeDomains;
  if (opts.category)       body.category       = opts.category;

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  try {
    const r = await fetch(EXA_URL, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
    if (!r.ok) return { source: 'Exa', status: 'error', http: r.status, results: [] };
    const j = await r.json();
    return {
      source: 'Exa', status: 'found', label: opts.label || query,
      cost: j.costDollars?.total ?? null,
      ms: j.searchTime ?? null,
      results: (j.results || []).map(x => ({
        title: x.title, url: x.url, date: x.publishedDate || null,
        text: (x.text || '').slice(0, opts.maxChars || 2200),
        highlights: x.highlights || []
      }))
    };
  } catch (e) {
    return { source: 'Exa', status: 'unreachable', error: e.message, results: [] };
  } finally { clearTimeout(t); }
}

/* ---------------------------- PARALLEL --------------------------- */
export async function parallel(objective, queries, opts = {}) {
  const key = process.env.PARALLEL_API_KEY;
  if (!key) return { source: 'Parallel', status: 'not_configured', results: [] };

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeout || 40000);
  try {
    const r = await fetch(PARALLEL_URL, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objective,
        search_queries: queries.slice(0, 5),
        mode: opts.mode || 'advanced',
        max_chars_total: opts.maxChars || 14000,
        ...(opts.sessionId ? { session_id: opts.sessionId } : {})
      }),
      signal: ctl.signal
    });
    if (!r.ok) return { source: 'Parallel', status: 'error', http: r.status, results: [] };
    const j = await r.json();
    return {
      source: 'Parallel', status: 'found', label: opts.label || objective.slice(0, 60),
      search_id: j.search_id, session_id: j.session_id,
      usage: j.usage || null, warnings: j.warnings || null,
      results: (j.results || []).map(x => ({
        title: x.title, url: x.url, date: x.publish_date || null,
        excerpts: x.excerpts || []
      }))
    };
  } catch (e) {
    return { source: 'Parallel', status: 'unreachable', error: e.message, results: [] };
  } finally { clearTimeout(t); }
}

/* --------------------- the query plan, by check ------------------- */
/* Everything Exa runs is pinned to register domains except the last two,
   which are deliberately open. Everything Parallel runs is an objective that
   cannot be answered by one page. */
export function plan(q, domain) {
  const name = q;
  const d = domain || q;
  const D = DOMAINS;

  return {
    exa: [
      { label:'C1 corporate existence', category:'company', numResults:4,
        query:`${name} company registration legal entity incorporation record`,
        includeDomains:[...D.ca_corporate, ...D.uk, 'sec.gov'] },

      { label:'C2 registration and licensing', numResults:5,
        query:`is ${name} registered or licensed to sell investments`,
        includeDomains:[...D.ca_securities, ...D.ca_payments, ...D.us, ...D.uk, ...D.intl] },

      { label:'C3 caution and warning lists',
        query:`${name} investor alert caution list warning unregistered`,
        includeDomains:[...D.ca_securities, ...D.us, ...D.uk, ...D.intl], numResults:6, fullText:true },

      { label:'C3 sanctions', query:`${name} sanctions designated entity`,
        includeDomains:D.sanctions, numResults:3 },

      { label:'C5 courts and insolvency', query:`${name} lawsuit judgment insolvency order`,
        includeDomains:[...D.ca_courts, 'sec.gov','gov.uk'], numResults:3 },

      /* The review sweep is split three ways on purpose. One search pinned to
         fifteen hosts returns whatever ranks highest and can miss a platform
         entirely. Three narrower pins force results out of each group, which
         is what makes the platform ledger mean something. */
      { label:'C7 review platforms',
        query:`${name} review scam withdrawal refused cannot withdraw one star`,
        includeDomains:D.reviews_major, numResults:6, fullText:true, maxChars:3000 },

      { label:'C7 complaint boards',
        query:`${name} complaint report ripoff refused refund`,
        includeDomains:D.reviews_boards, numResults:5, fullText:true, maxChars:3000 },

      { label:'C7 trading and workplace community',
        query:`${name} scam warning account manager pressure deposit`,
        includeDomains:D.reviews_community, numResults:6, fullText:true, maxChars:3000 },

      { label:'Open sweep, the subject’s own claims',
        query:`${name} ${d} about us regulated licensed years operating history`,
        excludeDomains:D.reviews, numResults:4, fullText:true },

      { label:'Open sweep, everything else',
        query:`${name} ${d} fraud investigation regulator complaint`,
        numResults:5 }
    ],

    par: [
      { label:'Negative review narratives',
        objective:
          `Find NEGATIVE reviews and complaints about ${name} (${d}). Read one and two star reviews only. ` +
          `Ignore positive reviews entirely. For each complaint capture what was actually DONE to the person: ` +
          `was a withdrawal refused, was a fee demanded before funds could be released, was the account frozen ` +
          `after a deposit, did an account manager stop replying, were they pressured to deposit more. ` +
          `Record which platform each complaint came from and the date. Return the complainants own words verbatim.`,
        queries:[
          `${name} withdrawal refused complaint`,
          `${name} scam review cannot withdraw money`,
          `${name} reviews trustpilot sitejabber complaints`,
          `${d} fee to release funds complaint`,
          `${name} reddit scam warning`
        ], mode:'advanced', maxChars:18000 },

      { label:'Regulatory standing',
        objective:
          `Establish whether ${name} (${d}) is registered, licensed or authorised to offer financial services ` +
          `in any jurisdiction, and whether any regulator has published a warning, caution listing or ` +
          `enforcement action against it. Prefer the regulator's own page over commentary. ` +
          `Record the exact wording of any listing and the date it was added.`,
        queries:[
          `${name} securities commission caution list`,
          `${name} not registered investor alert`,
          `${name} FCA warning list unauthorised`,
          `${name} regulatory action enforcement`
        ], mode:'advanced' },

      { label:'People and operator pattern',
        objective:
          `Identify who is behind ${name} (${d}): named directors, officers, owners or executives, ` +
          `and whether those people appear in any official corporate or regulatory record. ` +
          `Also identify whether the same operator runs other brands, by looking for reused phone numbers, ` +
          `addresses, wallet addresses, website templates or promotional material under different names.`,
        queries:[
          `${name} founder CEO director who owns`,
          `${d} same template other websites`,
          `${name} related companies same operator`
        ], mode:'fast' }
    ]
  };
}

export default { exa, parallel, plan, DOMAINS };
