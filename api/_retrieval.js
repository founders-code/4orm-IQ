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

/* ==================== THE SEARCHES LEAVE AT A RATE ======================
   Every search on a round used to be dispatched in one Promise.all, so a check
   opened with thirty four simultaneous requests. Exa's documented limit is ten
   queries a second. Most of that burst came back 429, exa() turned each one
   into {status:'error', results:[]}, and a refused search is indistinguishable
   downstream from a register that genuinely held nothing.

   The tell was the clock: a real sweep takes minutes, and a sweep that is
   refused at the door takes seconds.

   Cutting the number of searches would have fixed the errors by checking less,
   which is the one economy this product cannot make. Coverage is the thing
   being sold. So the same searches go out, at a rate the provider accepts.

   A 429 is also temporary, and losing a register to one is losing evidence we
   were entitled to, so it is retried rather than recorded as a dark source. */
const QPS = Math.max(1, Math.min(10, Number(process.env.KBYS_QPS) || 8));

let windowStart = 0, windowCount = 0;
async function slot() {
  for (;;) {
    const now = Date.now();
    if (now - windowStart >= 1000) { windowStart = now; windowCount = 0; }
    if (windowCount < QPS) { windowCount++; return; }
    await new Promise(r => setTimeout(r, 1000 - (now - windowStart) + 5));
  }
}

/* Two retries, backing off, and only for the statuses that mean "later".
   A 401 or a 402 is not a "later" and is never retried. */
const RETRY_ON = new Set([429, 502, 503, 504]);
async function paced(fn, label) {
  let last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await slot();
    const r = await fn();
    if (!(r && r.status === 'error' && RETRY_ON.has(r.http))) return r;
    last = r;
    await new Promise(z => setTimeout(z, 400 * Math.pow(2, attempt) + Math.random() * 200));
  }
  try { console.warn('[retrieval] gave up after retries', label, last && last.http); } catch {}
  return last;
}

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
  /* United States securities, futures and consumer regulators. */
  us:            ['sec.gov','finra.org','brokercheck.finra.org','adviserinfo.sec.gov',
                  'cftc.gov','nfa.futures.org','nmlsconsumeraccess.org','ftc.gov',
                  'ic3.gov','consumerfinance.gov','dfpi.ca.gov'],

  /* Vertical packs. These are pinned only when the party is classified into the
     matching vertical, because a Canadian plumber has no Form D and searching
     for one costs money and returns a register that could never have applied. */
  us_adviser:    ['adviserinfo.sec.gov','sec.gov','brokercheck.finra.org','nasaa.org'],
  us_exempt:     ['sec.gov','efts.sec.gov'],
  us_suspension: ['sec.gov'],
  us_derivatives:['cftc.gov','nfa.futures.org','sec.gov'],
  us_crypto_state:['dfpi.ca.gov','dfs.ny.gov','dob.texas.gov'],
  ca_issuer:     ['sedarplus.ca','sedi.ca','securities-administrators.ca','osc.ca','bcsc.bc.ca'],
  ca_discipline: ['ciro.ca','securities-administrators.ca','osc.ca','bcsc.bc.ca','asc.ca','lautorite.qc.ca'],
  au:            ['asic.gov.au','moneysmart.gov.au'],
  hk:            ['sfc.hk','apps.sfc.hk'],
  eu_crypto:     ['esma.europa.eu','eba.europa.eu'],

  /* The operator graph. Identifier reuse, infrastructure history and the
     technology a site is built on. */
  graph:         ['publicwww.com','builtwith.com','securitytrails.com','censys.io',
                  'urlscan.io','crt.sh','viewdns.info','dnslytics.com'],

  /* Chain explorers. First party chain data. What moved, never who owns it. */
  chain:         ['etherscan.io','solscan.io','tronscan.org','blockchain.com',
                  'blockchair.com','bscscan.com','arbiscan.io','polygonscan.com'],

  /* Where a build first appears in public. */
  build:         ['github.com','apps.apple.com','play.google.com','npmjs.com'],

  /* Criminal and money services. Added after the first real entity checked was a
     Florida corporation whose arrest and guilty plea were published by the
     Department of Justice and by IRS Criminal Investigation, neither of which was
     in the pinned list. FinCEN carries the money services business register, which
     is the decisive check for anyone pooling funds and paying distributions. */
  us_criminal:   ['justice.gov','irs.gov','fbi.gov','fincen.gov','treasury.gov',
                  'hsi.dhs.gov','usmarshals.gov'],

  /* State corporate registries. A company's home registry answers the identity
     question that no federal register can. */
  us_corporate:  ['sunbiz.org','sos.wyo.gov','icis.corp.delaware.gov','bizfileonline.sos.ca.gov',
                  'businesssearch.sos.ca.gov','apps.sos.ny.gov','sos.state.tx.us',
                  'mycorporation.sos.state.nv.us','opencorporates.com'],

  /* Courts, dockets, receivership and bankruptcy. */
  us_courts:     ['uscourts.gov','pacer.gov','courtlistener.com','dockets.justia.com',
                  'law.justia.com','trellis.law','unicourt.com','pacermonitor.com',
                  'kccllc.net','omniagentsolutions.com','veritaglobal.net','stretto.com',
                  'donlinrecano.com','epiqglobal.com'],

  /* The record of when a thing first existed. This is what a dated claim is
     checked against, and it is the whole of category 10. */
  timeline:      ['web.archive.org','archive.org','crt.sh','censys.io',
                  'trademarks.justia.com','tsdr.uspto.gov','uspto.gov',
                  'whois.domaintools.com','securitytrails.com'],

  /* People. A name found in a record is worth searching on its own. */
  people:        ['linkedin.com','crunchbase.com','youtube.com','x.com','twitter.com',
                  'instagram.com','facebook.com','muckrack.com','opencorporates.com'],

  /* State securities regulators and attorneys general. */
  us_states:     ['nasaa.org','myfloridalegal.com','flofr.gov','ag.ny.gov','oag.ca.gov',
                  'dfpi.ca.gov','dfi.wa.gov','dobs.pa.gov'],
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
  return paced(() => exaOnce(query, opts, key), 'exa:' + (opts.label || query).slice(0, 40));
}
async function exaOnce(query, opts, key) {

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
  return paced(() => parallelOnce(objective, queries, opts, key), 'parallel:' + String(objective).slice(0, 40));
}
async function parallelOnce(objective, queries, opts, key) {

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
/* Which categories a check may run. The console sends the switch state; an
   absent or empty list means every check runs, which is the default state of
   the panel. A search is kept when any category it feeds is still switched on. */
export const ALL_CATS = ['C1','C2','C3','C4','C5','C6','C7','C8','C9','C10'];

export function plan(q, domain, enabled, ctx = {}) {
  const on = (Array.isArray(enabled) && enabled.length) ? new Set(enabled) : new Set(ALL_CATS);
  const name = q;
  const d = domain || q;
  const D = DOMAINS;

  /* Vertical routing. A search that carries a verts list runs only when the
     party was classified into one of them. This is what stops a Form D search
     running against a plumber, and what stops an Australian licence register
     lowering coverage on a party with no Australian activity. */
  const V = new Set((ctx.verticals && ctx.verticals.length) ? ctx.verticals : ['OTHER']);
  const inV = list => !list || list.some(x => V.has(x));
  const keep = e => (!e.cats || e.cats.some(c => on.has(c))) && inV(e.verts);

  const built = {
    exa: [
      { label:'C1 corporate existence', cats:['C1'], category:'company', numResults:4,
        query:`${name} company registration legal entity incorporation record`,
        includeDomains:[...D.ca_corporate, ...D.uk, 'sec.gov'] },

      { label:'C2 registration and licensing', cats:['C2'], numResults:5,
        query:`is ${name} registered or licensed to sell investments`,
        includeDomains:[...D.ca_securities, ...D.ca_payments, ...D.us, ...D.uk, ...D.intl] },

      { label:'C3 caution and warning lists', cats:['C3'],
        query:`${name} investor alert caution list warning unregistered`,
        includeDomains:[...D.ca_securities, ...D.us, ...D.uk, ...D.intl], numResults:6, fullText:true },

      { label:'C3 sanctions', cats:['C3'], query:`${name} sanctions designated entity`,
        includeDomains:D.sanctions, numResults:3 },

      { label:'C3 criminal and money services', cats:['C3','C2'],
        query:`${name} charged indicted arrested fraud money laundering registration`,
        includeDomains:[...D.us_criminal, ...D.us_states], numResults:6, fullText:true, maxChars:3000 },

      { label:'C1 state corporate registry', cats:['C1'],
        query:`${name} corporation registered agent officers annual report entity record`,
        includeDomains:D.us_corporate, numResults:4 },

      { label:'C5 courts and insolvency', cats:['C5'], query:`${name} lawsuit judgment insolvency order`,
        includeDomains:[...D.ca_courts, ...D.us_courts, 'sec.gov','gov.uk'], numResults:5, fullText:true },

      { label:'C5 receivership and bankruptcy', cats:['C5'],
        query:`${name} receiver appointed chapter 11 bankruptcy claims creditors`,
        includeDomains:D.us_courts, numResults:4 },

      /* The review sweep is split three ways on purpose. One search pinned to
         fifteen hosts returns whatever ranks highest and can miss a platform
         entirely. Three narrower pins force results out of each group, which
         is what makes the platform ledger mean something. */
      { label:'C7 review platforms', cats:['C7'],
        query:`${name} review scam withdrawal refused cannot withdraw one star`,
        includeDomains:D.reviews_major, numResults:6, fullText:true, maxChars:3000 },

      { label:'C7 complaint boards', cats:['C7'],
        query:`${name} complaint report ripoff refused refund`,
        includeDomains:D.reviews_boards, numResults:5, fullText:true, maxChars:3000 },

      { label:'C7 trading and workplace community', cats:['C7'],
        query:`${name} scam warning account manager pressure deposit`,
        includeDomains:D.reviews_community, numResults:6, fullText:true, maxChars:3000 },

      /* Category 10. Two halves: what the party says about how long it has been
         doing this, and the independent record of when it first existed. The
         check is the comparison, and it is arithmetic rather than opinion. */
      { label:'C10 dated claims, from the party itself', cats:['C10'],
        query:`${name} ${d} since founded established years of experience track record returns in`,
        includeDomains:[d].filter(Boolean), numResults:6, fullText:true, maxChars:3200 },

      { label:'C10 the record of first existence', cats:['C10','C6'],
        query:`${d} ${name} first archived capture certificate issued trademark filed domain history`,
        includeDomains:D.timeline, numResults:6, fullText:true, maxChars:2600 },

      { label:'C10 first public mention', cats:['C10'],
        query:`"${name}" earliest announcement launch press first mention`,
        numResults:5 },

      { label:'Open sweep, the subject’s own claims', cats:['C1','C2'],
        query:`${name} ${d} about us regulated licensed years operating history`,
        excludeDomains:D.reviews, numResults:4, fullText:true },

      { label:'Open sweep, everything else', cats:['C1','C3','C5'],
        query:`${name} ${d} fraud investigation regulator complaint`,
        numResults:5 },

      /* ---------------- vertical packs ---------------- */

      { label:'C03 SEC trading suspensions', cats:['C3'], verts:['PUBLIC_STOCK'],
        query:`${name} trading suspension order securities exchange act release`,
        includeDomains:D.us_suspension, numResults:4, fullText:true, maxChars:2600 },

      { label:'C02 CFTC RED list and registration', cats:['C2','C3'],
        verts:['FOREX_CFD','COMMODITIES','CRYPTO','BROKER_DEALER'],
        query:`${name} registration deficient RED list foreign entity solicit`,
        includeDomains:D.us_derivatives, numResults:5, fullText:true, maxChars:2600 },

      { label:'C03 state crypto scam trackers', cats:['C3','C7'],
        verts:['CRYPTO','FOREX_CFD','PRIVATE_INVESTMENT'],
        query:`${name} ${d} crypto scam tracker complaint reported`,
        includeDomains:D.us_crypto_state, numResults:5, fullText:true, maxChars:2600 },

      { label:'C01 Canadian issuer filings', cats:['C1','C5','C10'],
        verts:['PUBLIC_STOCK','PRIVATE_INVESTMENT','PRIVATE_FUND'],
        query:`${name} prospectus material change financial statements filing`,
        includeDomains:D.ca_issuer, numResults:5, fullText:true, maxChars:2800 },

      { label:'C04 Canadian discipline and insiders', cats:['C4','C3'],
        verts:['PUBLIC_STOCK','BROKER_DEALER','INVESTMENT_ADVISER','PRIVATE_INVESTMENT'],
        query:`${name} disciplinary hearing settlement agreement sanctions insider report`,
        includeDomains:D.ca_discipline, numResults:5, fullText:true, maxChars:2800 },

      { label:'C02 Australian licence and alerts', cats:['C2','C3','C4'],
        verts:['BROKER_DEALER','INVESTMENT_ADVISER','FOREX_CFD','CRYPTO','PRIVATE_FUND'],
        query:`${name} ${d} AFS licence authorised representative investor alert`,
        includeDomains:D.au, numResults:4, fullText:true },

      { label:'C02 Hong Kong licence and alert list', cats:['C2','C3'],
        verts:['BROKER_DEALER','INVESTMENT_ADVISER','FOREX_CFD','CRYPTO','PUBLIC_STOCK'],
        query:`${name} ${d} licensed corporation responsible officer alert list`,
        includeDomains:D.hk, numResults:4, fullText:true },

      { label:'C02 EU crypto authorisation', cats:['C2'], verts:['CRYPTO'],
        query:`${name} crypto asset service provider authorisation MiCA member state`,
        includeDomains:D.eu_crypto, numResults:4 },

      /* ---------------- the operator graph ---------------- */

      { label:'C09 identifier reuse across sites', cats:['C9'],
        query:`"${d}" analytics tag manager pixel id same code other websites`,
        includeDomains:D.graph, numResults:6, fullText:true, maxChars:3000 },

      { label:'C09 infrastructure and DNS history', cats:['C9','C6','C10'],
        query:`${d} dns history ip history nameserver previous records related domains`,
        includeDomains:D.graph, numResults:5, fullText:true, maxChars:2600 },

      /* ---------------- chain and build chronology ---------------- */

      { label:'C08 chain records for the addresses found', cats:['C8','C9'], verts:['CRYPTO'],
        query:`${name} ${d} wallet address contract first transaction token`,
        includeDomains:D.chain, numResults:5, fullText:true, maxChars:2600 },

      { label:'C10 first public build record', cats:['C10','C9'],
        verts:['VC_STARTUP','CRYPTO'],
        query:`${name} ${d} repository created first commit app released version history`,
        includeDomains:D.build, numResults:5, fullText:true, maxChars:2400 }
    ],

    par: [
      { label:'Negative review narratives', cats:['C7'],
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

      { label:'Regulatory standing', cats:['C2','C3'],
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

      { label:'People and operator pattern', cats:['C4','C9'],
        objective:
          `Identify who is behind ${name} (${d}): named directors, officers, owners or executives, ` +
          `and whether those people appear in any official corporate or regulatory record. ` +
          `Also identify whether the same operator runs other brands, by looking for reused phone numbers, ` +
          `addresses, wallet addresses, website templates or promotional material under different names.`,
        queries:[
          `${name} founder CEO director who owns`,
          `${d} same template other websites`,
          `${name} related companies same operator`
        ], mode:'fast' },

      /* Sources whose answer spans several pages. A Form ADV is a filing, a
         list of amendments, a disciplinary section and a private funds
         schedule, and no single page carries all four. */

      { label:'SEC IAPD and Form ADV', cats:['C2','C4','C1','C10'],
        verts:['INVESTMENT_ADVISER','PRIVATE_INVESTMENT','PRIVATE_FUND','BROKER_DEALER'],
        objective:
          `Establish whether ${name} (${d}) or its principals appear in the SEC Investment Adviser ` +
          `Public Disclosure system. Capture the firm name exactly as registered, the CRD number, the ` +
          `SEC file number, current registration status, any state registration, every alternate or ` +
          `former name, the business address, named control persons, every disciplinary disclosure, ` +
          `the Form ADV filing date and the dates of amendments, any private funds listed, assets under ` +
          `management where disclosed, and related persons. Capture historical registration as well as ` +
          `current: a lapsed registration is still relevant. A current registration is not an endorsement ` +
          `and must never be reported as one. If the registration number the party claims belongs to a ` +
          `different legal entity, say so explicitly and quote both names.`,
        queries:[
          `${name} investment adviser public disclosure Form ADV CRD`,
          `${name} SEC registered investment adviser firm summary`,
          `${name} Form ADV brochure part 2 disciplinary`,
          `${d} adviser registration status file number`
        ], includeDomains:D.us_adviser, mode:'advanced', maxChars:16000 },

      { label:'SEC Form D exempt offerings', cats:['C2','C1','C10'],
        verts:['PRIVATE_INVESTMENT','VC_STARTUP','PRIVATE_FUND','CRYPTO','INVESTMENT_ADVISER'],
        objective:
          `Find every Form D exempt offering filing by ${name} (${d}) or entities that share its ` +
          `principals. Capture the date of the FIRST filing, every amendment date, the total offering ` +
          `amount, the amount sold, the amount remaining, the date of first sale, the type of security, ` +
          `the exemption relied on, the minimum investment accepted, related persons named on the filing, ` +
          `sales compensation, and the states where the offering was made. The date of first filing and ` +
          `the date of first sale are the two figures that matter most, because they are what a claimed ` +
          `fundraising history gets checked against. A first sale later than a claimed start date is a ` +
          `discrepancy to be described, never on its own an allegation of wrongdoing.`,
        queries:[
          `${name} Form D notice of exempt offering EDGAR`,
          `${name} first sale date offering amount Form D`,
          `${name} Regulation D 506 filing related persons`
        ], includeDomains:D.us_exempt, mode:'advanced', maxChars:14000 },

      { label:'CFTC enforcement and the people named', cats:['C3','C4','C5'],
        verts:['FOREX_CFD','COMMODITIES','CRYPTO','PRIVATE_INVESTMENT','PRIVATE_FUND'],
        objective:
          `Establish whether the Commodity Futures Trading Commission has taken any action involving ` +
          `${name} (${d}), its founders, its principals or its promoters. Search the entity and the ` +
          `people separately. Capture the proceeding, the date, the allegations as pleaded, the findings ` +
          `if any were made, the case number, the order, penalties, registration status and every person ` +
          `named. Keep a complaint and a finding apart: a complaint contains allegations that have not ` +
          `been proven, a consent order or judgment contains findings. Never render one as the other.`,
        queries:[
          `${name} CFTC complaint enforcement action order`,
          `${name} CFTC RED list registration deficient`,
          `${name} founder principal CFTC civil action`
        ], includeDomains:D.us_derivatives, mode:'advanced', maxChars:14000 },

      { label:'SEDAR+ filings and chronology', cats:['C1','C5','C10'],
        verts:['PUBLIC_STOCK','PRIVATE_INVESTMENT','PRIVATE_FUND'],
        objective:
          `Find filings by ${name} on SEDAR+. Capture the issuer name, every filing date, filing type, ` +
          `the province, prospectuses, financial statements, management discussion and analysis, material ` +
          `change reports, offering documents and anything relating to a cease trade order. Capture the ` +
          `DATE OF THE EARLIEST FILING separately, and quote any passage describing the stage the business ` +
          `was at in a given year, for example pre revenue or development stage. That passage is what a ` +
          `claimed operating history is checked against, and both the claim and the filing must be quoted ` +
          `so the reader can compare them without taking anybody's word for it.`,
        queries:[
          `${name} SEDAR filings prospectus financial statements`,
          `${name} material change report management discussion analysis`,
          `${name} cease trade order issuer profile`
        ], includeDomains:D.ca_issuer, mode:'advanced', maxChars:14000 },

      { label:'SEDI insider reports', cats:['C4','C1','C10'],
        verts:['PUBLIC_STOCK','PRIVATE_INVESTMENT'],
        objective:
          `Find insider reports filed on SEDI relating to ${name}. Capture the insider name, the issuer, ` +
          `the relationship to the issuer, the securities held, each transaction, the transaction dates, ` +
          `and whether each was an acquisition or a disposition. Capture the date of the earliest insider ` +
          `record. Report what the filings say. Do not characterise a pattern of trading as anything.`,
        queries:[
          `${name} SEDI insider report securities transactions`,
          `${name} director officer insider filing acquisition disposition`
        ], includeDomains:D.ca_issuer, mode:'fast', maxChars:10000 },

      { label:'Discipline against the people, every jurisdiction', cats:['C4','C3'],
        verts:['PUBLIC_STOCK','BROKER_DEALER','INVESTMENT_ADVISER','PRIVATE_INVESTMENT','PRIVATE_FUND','FOREX_CFD'],
        objective:
          `For ${name} (${d}) and for every founder, director, officer, adviser, salesperson or promoter ` +
          `named anywhere in the material, establish whether that person appears in a disciplinary or ` +
          `disciplined persons record: CIRO disciplinary proceedings, the CSA disciplined persons list, ` +
          `ASIC banned and disqualified persons, FCA prohibitions, or any equivalent. Capture the ` +
          `proceeding, the allegations, the decision, any settlement, the sanctions, the date, and how the ` +
          `person was connected to the registered firm at the time. A person level adverse history is ` +
          `relevant to every entity that person is connected to, and each connection must be stated with ` +
          `the record that establishes it.`,
        queries:[
          `${name} director disciplinary proceeding decision sanctions`,
          `${name} principal banned disqualified prohibited order`,
          `${name} disciplined persons list securities`
        ], includeDomains:D.ca_discipline, mode:'advanced', maxChars:14000 },

      { label:'Dated claims made by the party itself', cats:['C10'],
        objective:
          `Read ${d} and any other page published by ${name} itself, and extract every FACTUAL CLAIM ` +
          `THAT CARRIES A DATE OR A DURATION. Examples of the shape: trading successfully since 2018, ` +
          `ten years of experience, serving investors since 2017, two billion traded in 2024, founded in ` +
          `2015, established 2019, over a decade of. For each one capture the claim VERBATIM, the page it ` +
          `appears on, and the year it implies the party began. Do not evaluate the claims. Do not decide ` +
          `whether they are true. Extract them exactly as written, because they are one half of a ` +
          `comparison and the records are the other half.`,
        queries:[
          `${d} since founded established years experience track record`,
          `${d} about us our story history milestones`,
          `${name} "since 20" OR "years of experience" OR "founded in"`
        ], includeDomains:[d].filter(Boolean), mode:'advanced', maxChars:12000 }
    ]
  };

  /* Priority order. When MAX_SEARCHES bites it must drop the open sweeps at
     the end, never the routed register that the classification exists to
     reach. A vertical pack is the whole point of routing; "everything else"
     is the consolation prize. */
  const rank = e => {
    const L = String(e.label || '');
    if (e.verts) return 0;                                   /* routed to this party */
    if (/^C(1|2|3|5|10)\b/.test(L)) return 1;                /* the register checks */
    if (/^C7/.test(L)) return 2;                             /* the review sweep */
    if (/Open sweep/i.test(L)) return 4;
    return 3;
  };
  const exa = built.exa.filter(keep)
    .map((e, i) => ({ e, i, r: rank(e) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.e);

  return { exa, par: built.par.filter(keep), enabled: [...on] };
}

/**
 * Round two.
 *
 * Round one searches the identifier the consumer typed. Round two searches what
 * round one turned up: the people named in the records, the case numbers on the
 * dockets, and the entities that appear alongside the subject.
 *
 * This is the difference between a single sweep and an investigation. A check
 * that finds a chief executive's name and never searches it has stopped one
 * step short of the answer.
 *
 * Seeds are supplied by the caller, which extracts them from round one results.
 * Nothing here invents a seed.
 */
export function planRound2(q, domain, seeds = {}, enabled) {
  const on = (Array.isArray(enabled) && enabled.length) ? new Set(enabled) : new Set(ALL_CATS);
  const keep = e => !e.cats || e.cats.some(c => on.has(c));
  const D = DOMAINS;
  const out = [];

  /* ============ NOTHING IS RETRIEVED THAT CANNOT BE REPORTED ============
     Round two used to run up to seven searches against named individuals: a
     criminal and disciplinary sweep, a court docket sweep, and a public profile
     sweep, all pulling full page text.

     None of it could ever reach a reader. SR-001 clears no source for
     person-level output (personOutput is empty), person nodes are filtered
     before the corpus is written, and rpPeople returns an empty list by
     construction. So the run was retrieving named people's criminal records,
     disciplinary history and litigation, putting them through the reasoning
     call, and discarding every one - while the privacy notice tells a reader we
     do not keep that material.

     Paying for it was the smaller problem. Retrieving it at all was the real
     one, and on a budget of six round two searches these could crowd out the
     case number, related entity and sibling domain searches whose results a
     reader can actually be shown.

     A person's disciplinary record can bear on a company's fitness, and this
     comes back the day counsel signs off and SR-001 clears a source for it.
     Until then the register decides, and the register says no.

     seeds.people is still extracted, because the count of people named in the
     records is itself a reportable fact about a company. It is a count here and
     never a query. */

  (seeds.caseNumbers || []).slice(0, 3).forEach(c => {
    out.push({ label:`R2 docket, ${c}`, cats:['C5'], numResults:4, fullText:true, maxChars:3000,
      query:`"${c}" ${q} complaint order docket`,
      includeDomains:[...D.us_courts, ...D.us_criminal] });
  });

  (seeds.relatedEntities || []).slice(0, 3).forEach(e => {
    out.push({ label:`R2 related entity, ${e}`, cats:['C9','C1'], numResults:4,
      query:`"${e}" ${q} related connected same operator registration`,
      includeDomains:[...D.us_corporate, ...D.us_criminal, ...D.us_courts, ...D.ca_corporate] });
  });

  (seeds.domains || []).slice(0, 3).forEach(d2 => {
    out.push({ label:`R2 sibling domain, ${d2}`, cats:['C9','C6'], numResults:3,
      query:`${d2} ${q} same operator cloned site` });
  });

  return out.filter(keep);
}

/**
 * Extract round two seeds from round one output. Deterministic, and it never
 * proposes a seed that is not present verbatim in a retrieved result.
 */
export function extractSeeds(exaOut = [], parOut = [], subjectDomain = null, subject = '') {
  const subj = String(subject || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const isSubject = v => {
    const t = String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return !!subj && (t === subj || t.includes(subj) || subj.includes(t));
  };
  const text = [];
  exaOut.forEach(b => (b.results || []).forEach(r => {
    text.push(r.title || ''); text.push(r.text || ''); (r.highlights || []).forEach(h => text.push(h));
  }));
  parOut.forEach(b => (b.results || []).forEach(r => {
    text.push(r.title || ''); (r.excerpts || []).forEach(e => text.push(e));
  }));
  const blob = text.join('\n');

  /* Federal and state case numbers, in the forms courts actually print them. */
  const caseNumbers = [...new Set(
    (blob.match(/\b\d{1,2}:\d{2}-(?:cv|cr|mj|bk)-\d{3,6}(?:-[A-Z]{2,4})?\b/g) || [])
    .concat(blob.match(/\b\d{4}-CA-\d{6}-[A-Z]\b/gi) || [])
    .concat(blob.match(/\bMDL\s*No\.?\s*\d{3,5}\b/gi) || [])
  )].slice(0, 6);

  /* People named in a role. Requires the role word, so a headline noun phrase
     does not become a person. */
  const ROLE = '(?:chief executive|CEO|founder|president|director|officer|owner|manager|principal)';
  const people = [...new Set(
    (blob.match(new RegExp('([A-Z][a-z]+(?:\\s+[A-Z][a-z\\.]+){1,2})\\s*,?\\s+(?:the\\s+)?' + ROLE, 'g')) || [])
      .map(m => m.replace(new RegExp('\\s*,?\\s+(?:the\\s+)?' + ROLE + '$'), '').trim())
      .concat(
        (blob.match(new RegExp(ROLE + '\\s+(?:of\\s+[A-Za-z0-9 ]+\\s+)?([A-Z][a-z]+(?:\\s+[A-Z][a-z\\.]+){1,2})', 'g')) || [])
          .map(m => m.replace(new RegExp('^' + ROLE + '\\s+(?:of\\s+[A-Za-z0-9 ]+\\s+)?'), '').trim())
      )
      .filter(n => n.split(/\s+/).length >= 2 && n.length < 44 && !isSubject(n))
      .filter(n => !/(Inc|LLC|Ltd|LP|Corp|Ventures|Capital|Partners|Holdings|Group)$/i.test(n))
  )].slice(0, 4);

  /* Corporate suffixes, so a sentence fragment does not become an entity. */
  const relatedEntities = [...new Set(
    (blob.match(/\b([A-Z][A-Za-z0-9&'\-]+(?:\s+[A-Z][A-Za-z0-9&'\-]+){0,3}\s+(?:Inc|LLC|Ltd|LP|LLP|Corp|Corporation|Holdings|Ventures|Capital|Partners|Group)\.?)\b/g) || [])
      .map(x => x.trim())
      .filter(x => x.length > 6 && x.length < 54)
  )].filter(e => !isSubject(e)).slice(0, 5);

  const domains = [...new Set(
    (blob.match(/\bhttps?:\/\/([a-z0-9.\-]+\.[a-z]{2,})/gi) || [])
      .map(u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } })
      .filter(Boolean)
  )].filter(h => h !== subjectDomain && !/(gov|reddit|trustpilot|bbb|linkedin|youtube|facebook|instagram|wikipedia)\./.test(h))
    .slice(0, 4);

  return { people, caseNumbers, relatedEntities, domains };
}

export default { exa, parallel, plan, DOMAINS };
