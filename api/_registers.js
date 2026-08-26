/**
 * 4orm - Know Before You Send
 * Register mapping.
 *
 * The console draws a board of 48 named registers. Retrieval returns URLs.
 * This file is the join between the two, and it is deliberately dumb: it maps
 * a hostname to the register it belongs to and nothing else. It makes no
 * judgment about what the page said.
 *
 * Two passes build the board.
 *
 *   Pass 1  reachedBoard()  Retrieval reached this register, so light it.
 *                           State is "clear", meaning reached and nothing
 *                           adverse has been asserted about it yet.
 *   Pass 2  overlayBoard()  The assessment cited this register inside a
 *                           category that came back caution or adverse, so
 *                           carry that state onto the light.
 *
 * A register that neither pass touches stays dark, and dark always means
 * not reached. It never means came back clean. That distinction is the whole
 * point of the board.
 */

/* hostname -> the board register or registers it satisfies.
   Where one host serves two registers, both are listed, because reaching
   securities-administrators.ca does reach the CSA in both senses. */
const HOST_MAP = {
  /* 01 Identity */
  'sunbiz.org':                 ['Florida Sunbiz'],
  'search.sunbiz.org':          ['Florida Sunbiz'],
  'opencorporates.com':         ['OpenCorporates'],
  'sos.wyo.gov':                ['OpenCorporates'],
  'icis.corp.delaware.gov':     ['OpenCorporates'],
  'bizfileonline.sos.ca.gov':   ['OpenCorporates'],
  'apps.sos.ny.gov':            ['OpenCorporates'],
  'ised-isde.canada.ca':        ['Corporations Canada', 'OSB Bankruptcy'],
  'canadasbusinessregistries.ca': ['Corporations Canada'],
  'ontario.ca':                 ['Ontario Registry'],
  'bcregistry.gov.bc.ca':       ['BC Registry'],
  'alberta.ca':                 ['Alberta Registry'],
  'sec.gov':                    ['SEC EDGAR'],
  'find-and-update.company-information.service.gov.uk': ['Companies House', 'UK PSC Register'],

  /* 02 Licensing */
  'securities-administrators.ca':        ['CSA Registration', 'CSA Alerts', 'CSA Disciplined', 'CSA Disciplined Persons'],
  'autorites-valeurs-mobilieres.ca':     ['CSA Registration'],
  'ciro.ca':                    ['CIRO AdvisorReport', 'CIRO Discipline'],
  'fintrac-canafe.canada.ca':   ['FINTRAC MSB'],
  'bankofcanada.ca':            ['Bank of Canada PSP'],
  'register.fca.org.uk':        ['FCA Register'],
  'brokercheck.finra.org':      ['BrokerCheck'],
  'finra.org':                  ['BrokerCheck'],
  'adviserinfo.sec.gov':        ['BrokerCheck'],
  'nfa.futures.org':            ['NFA BASIC'],

  /* 02 Licensing, money services */
  'fincen.gov':                 ['FinCEN MSB'],
  'nasaa.org':                  ['CSA Registration'],
  'flofr.gov':                  ['FinCEN MSB'],

  /* 03 Enforcement */
  'justice.gov':                ['DOJ Press'],
  'irs.gov':                    ['IRS-CI'],
  'fbi.gov':                    ['DOJ Press'],
  'usmarshals.gov':             ['DOJ Press'],
  'myfloridalegal.com':         ['State AG'],
  'ag.ny.gov':                  ['State AG'],
  'oag.ca.gov':                 ['State AG'],
  'iosco.org':                  ['IOSCO I-SCAN'],
  'bcsc.bc.ca':                 ['BCSC Caution List'],
  'asc.ca':                     ['ASC Caution List'],
  'osc.ca':                     ['OSC Alerts'],
  'fca.org.uk':                 ['FCA Warning List'],
  'sanctionssearch.ofac.treas.gov': ['OFAC'],
  'treasury.gov':               ['OFAC'],
  'un.org':                     ['UN Consolidated'],
  'international.gc.ca':        ['UN Consolidated'],

  /* 04 People */
  'ic.gc.ca':                   ['ISC Ownership'],
  'asic.gov.au':                ['ASIC Banned'],

  /* 05 Legal */
  'uscourts.gov':               ['PACER'],
  'pacer.gov':                  ['PACER'],
  'dockets.justia.com':         ['Justia Dockets'],
  'law.justia.com':             ['Justia Dockets'],
  'trellis.law':                ['Justia Dockets'],
  'unicourt.com':               ['Justia Dockets'],
  'pacermonitor.com':           ['Justia Dockets'],
  'kccllc.net':                 ['Bankruptcy Claims'],
  'omniagentsolutions.com':     ['Bankruptcy Claims'],
  'veritaglobal.net':           ['Bankruptcy Claims'],
  'stretto.com':                ['Bankruptcy Claims'],
  'donlinrecano.com':           ['Bankruptcy Claims'],
  'epiqglobal.com':             ['Bankruptcy Claims'],
  'canlii.org':                 ['CanLII'],
  'courtlistener.com':          ['CourtListener'],
  'gov.uk':                     ['UK Insolvency'],
  'scc-csc.ca':                 ['CanLII'],
  'fct-cf.gc.ca':               ['CanLII'],

  /* 06 Web */
  'rdap.org':                   ['ICANN RDAP'],
  /* crt.sh serves two registers and is declared once, below under check 10.
     A second declaration here would silently lose whichever came first. */
  'virustotal.com':             ['VirusTotal'],
  'urlscan.io':                 ['urlscan.io'],
  'transparencyreport.google.com': ['Google Web Risk'],

  /* NEW. Source pack A, United States investing and retail trading. */
  'adviserinfo.sec.gov':        ['SEC IAPD, Form ADV', 'IAPD First Registration', 'BrokerCheck'],
  'reports.adviserinfo.sec.gov':['SEC IAPD, Form ADV', 'IAPD First Registration'],
  'efts.sec.gov':               ['SEC Form D', 'Form D First Filing', 'EDGAR First Filing'],
  'cftc.gov':                   ['CFTC Enforcement'],
  'dfpi.ca.gov':                ['DFPI Crypto Scam Tracker'],

  /* NEW. Source pack B, Canada. */
  'sedarplus.ca':               ['SEDAR+', 'SEDAR+ First Filing'],
  'sedar.com':                  ['SEDAR+', 'SEDAR+ First Filing'],
  'sedi.ca':                    ['SEDI Insider Reports', 'SEDI First Insider Record'],

  /* NEW. Source pack C, international. */
  'asic.gov.au':                ['ASIC Banned'],
  'moneysmart.gov.au':          ['ASIC Investor Alerts'],
  'sfc.hk':                     ['SFC Public Register'],
  'apps.sfc.hk':                ['SFC Public Register'],
  'esma.europa.eu':             ['ESMA MiCA CASP'],
  'eba.europa.eu':              ['ESMA MiCA CASP'],

  /* NEW. Chain explorers. What moved, never who owns it. */
  'etherscan.io':               ['Etherscan'],
  'bscscan.com':                ['Etherscan'],
  'arbiscan.io':                ['Etherscan'],
  'polygonscan.com':            ['Etherscan'],
  'solscan.io':                 ['Solscan'],
  'solana.fm':                  ['Solscan'],
  'tronscan.org':               ['Tronscan'],
  'blockchain.com':             ['Bitcoin Explorer'],
  'blockchair.com':             ['Bitcoin Explorer'],
  'mempool.space':              ['Bitcoin Explorer'],

  /* NEW. The operator graph. */
  'publicwww.com':              ['Analytics and Pixel Reuse'],
  'builtwith.com':              ['Site Technology'],
  'securitytrails.com':         ['DNS and IP History', 'Domain History'],
  'viewdns.info':               ['DNS and IP History'],
  'dnslytics.com':              ['DNS and IP History'],
  'censys.io':                  ['Host and Certificate Graph', 'First Certificate'],
  'search.censys.io':           ['Host and Certificate Graph'],

  /* NEW. Where a build first appears in public. */
  'apps.apple.com':             ['App Store First Release'],
  'play.google.com':            ['Google Play First Release'],
  'github.com':                 ['GitHub Repository Created', 'GitHub First Commit'],
  'npmjs.com':                  ['GitHub Repository Created'],
  'prnewswire.com':             ['First Press Release'],
  'businesswire.com':           ['First Press Release'],
  'globenewswire.com':          ['First Press Release'],
  'newswire.ca':                ['First Press Release'],
  'youtube.com':                ['First YouTube Video'],
  'x.com':                      ['First Social Post'],
  'twitter.com':                ['First Social Post'],

  /* 10 Claim dates against the record */
  'web.archive.org':            ['Wayback Machine'],
  'archive.org':                ['Wayback Machine'],
  'crt.sh':                     ['Certificate Log', 'First Certificate'],
  'censys.io':                  ['First Certificate'],
  'trademarks.justia.com':      ['Trademark Filing'],
  'tsdr.uspto.gov':             ['Trademark Filing'],
  'uspto.gov':                  ['Trademark Filing'],
  'securitytrails.com':         ['Domain History'],
  'whois.domaintools.com':      ['Domain History'],
  'linkedin.com':               ['Public Profile'],
  'crunchbase.com':             ['Public Profile'],

  /* 07 Reviews */
  'trustpilot.com':             ['Trustpilot'],
  'sitejabber.com':             ['Sitejabber'],
  'bbb.org':                    ['BBB Scam Tracker'],
  'forexpeacearmy.com':         ['Forex Peace Army'],
  'reddit.com':                 ['Reddit'],
  'glassdoor.com':              ['Glassdoor'],

  /* 08 Payment */
  'chainabuse.com':             ['Chainabuse']
};

/* Review platforms we sweep. The board has room for six; we search more than
   that, and the ledger reports all of them so nobody has to guess whether a
   platform was looked at. `board` is the register name where one exists. */
export const REVIEW_PLATFORMS = [
  { host: 'trustpilot.com',      name: 'Trustpilot',         board: 'Trustpilot' },
  { host: 'sitejabber.com',      name: 'Sitejabber',         board: 'Sitejabber' },
  { host: 'bbb.org',             name: 'Better Business Bureau', board: 'BBB Scam Tracker' },
  { host: 'forexpeacearmy.com',  name: 'Forex Peace Army',   board: 'Forex Peace Army' },
  { host: 'reddit.com',          name: 'Reddit',             board: 'Reddit' },
  { host: 'glassdoor.com',       name: 'Glassdoor',          board: 'Glassdoor' },
  { host: 'complaintsboard.com', name: 'ComplaintsBoard',    board: null },
  { host: 'ripoffreport.com',    name: 'Ripoff Report',      board: null },
  { host: 'pissedconsumer.com',  name: 'PissedConsumer',     board: null },
  { host: 'scamadviser.com',     name: 'ScamAdviser',        board: null },
  { host: 'trustburn.com',       name: 'Trustburn',          board: null },
  { host: 'wikifx.com',          name: 'WikiFX',             board: null },
  { host: 'fxempire.com',        name: 'FX Empire',          board: null },
  { host: 'indeed.com',          name: 'Indeed',             board: null },
  { host: 'chainabuse.com',      name: 'Chainabuse',         board: 'Chainabuse' }
];

export function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return null; }
}

/* Several hosts serve more than one register, and which one a page belongs to
   is decided by the PATH, not the host. sec.gov carries EDGAR, Form D and the
   trading suspension list, and attributing a suspension notice to EDGAR would
   light the wrong lamp on the board.

   Each rule is [hostSuffix, pathTest, registers]. First match wins, and a page
   that matches none falls back to the flat host map. */
const PATH_MAP = [
  ['sec.gov',      /litigation\/suspensions|trading-suspension|\/suspensions/i,
                   ['SEC Trading Suspensions']],
  ['sec.gov',      /form-?d|formd|exempt-?offering|\/d\/|regulation-?d/i,
                   ['SEC Form D', 'Form D First Filing', 'Form D First Sale']],
  ['sec.gov',      /edgar|browse-edgar|cgi-bin/i,
                   ['SEC EDGAR', 'EDGAR First Filing']],
  ['cftc.gov',     /check|red-?list|registration-?deficient/i,
                   ['CFTC RED List']],
  ['cftc.gov',     /enforcement|press|litigation|federal-?register/i,
                   ['CFTC Enforcement']],
  ['asic.gov.au',  /banned|disqualified|enforcement/i,
                   ['ASIC Banned']],
  ['asic.gov.au',  /register|licen[cs]|professional|authorised-?representative/i,
                   ['ASIC Professional Register']],
  ['asic.gov.au',  /alert|warning|imposter/i,
                   ['ASIC Investor Alerts']],
  ['sfc.hk',       /alert-?list|suspicious|unlicen[cs]ed/i,
                   ['SFC Alert List']],
  ['sfc.hk',       /register|licen[cs]|intermediaries|public-?register/i,
                   ['SFC Public Register']],
  ['ciro.ca',      /enforcement|disciplin|hearing|settlement/i,
                   ['CIRO Discipline']],
  ['ciro.ca',      /advisorreport|advisor-?report/i,
                   ['CIRO AdvisorReport']],
  ['securities-administrators.ca', /disciplined/i,
                   ['CSA Disciplined', 'CSA Disciplined Persons']],
  ['securities-administrators.ca', /alert|caution|warning/i,
                   ['CSA Alerts']],
  ['securities-administrators.ca', /nrs|registration|national-?registration/i,
                   ['CSA Registration']],
  ['dfpi.ca.gov',  /crypto-?scam/i, ['DFPI Crypto Scam Tracker']]
];

/* Everything a host can serve, whatever the path. Used when we know a domain
   was queried but have no page from it: asking cftc.gov asks both the RED list
   and the enforcement record, and the board should say we asked both. */
const HOST_SERVES = (() => {
  const m = {};
  Object.entries(HOST_MAP).forEach(([h, regs]) => { m[h] = new Set(regs); });
  PATH_MAP.forEach(([h, , regs]) => {
    m[h] = m[h] || new Set();
    regs.forEach(r => m[h].add(r));
  });
  return Object.fromEntries(Object.entries(m).map(([h, set]) => [h, [...set]]));
})();

function hostKey(h, table) {
  if (!h) return null;
  if (table[h]) return h;
  for (const key of Object.keys(table)) if (h.endsWith('.' + key)) return key;
  return null;
}

/**
 * registersFor(host, url)
 * Which register a RETRIEVED PAGE belongs to. Path aware, because a host can
 * serve several and attributing a page to the wrong one lights the wrong lamp.
 */
function registersFor(h, url) {
  if (!h) return [];
  const path = String(url || '');
  for (const [suffix, test, regs] of PATH_MAP) {
    if ((h === suffix || h.endsWith('.' + suffix)) && test.test(path)) return regs;
  }
  const k = hostKey(h, HOST_MAP);
  return k ? HOST_MAP[k] : [];
}

/**
 * registersServedBy(host)
 * Which registers we can honestly say were ASKED when this domain was pinned
 * on a search. Broader than registersFor on purpose.
 */
export function registersServedBy(h) {
  if (!h) return [];
  const k = hostKey(String(h).toLowerCase().replace(/^www\./, ''), HOST_SERVES);
  return k ? HOST_SERVES[k] : [];
}

/* Every URL retrieved this run, flattened, with its register attribution. */
export function retrievedSources(exaOut = [], parOut = []) {
  const out = [];
  exaOut.forEach(b => (b.results || []).forEach(r => {
    const h = host(r.url);
    out.push({
      tier: 'Exa', label: b.label || '', url: r.url, title: r.title || '',
      date: r.date || null, host: h, registers: registersFor(h, r.url),
      snippet: (r.highlights && r.highlights[0]) || (r.text || '').slice(0, 400) || ''
    });
  }));
  parOut.forEach(b => (b.results || []).forEach(r => {
    const h = host(r.url);
    out.push({
      tier: 'Parallel', label: b.label || '', url: r.url, title: r.title || '',
      date: r.date || null, host: h, registers: registersFor(h, r.url),
      snippet: (r.excerpts && r.excerpts[0]) ? r.excerpts[0].slice(0, 400) : ''
    });
  }));
  return out;
}

/* Pass 1. Reached means a page came back from that register on this run. */
export function reachedBoard(sources = [], conn = {}, siblings = []) {
  const board = {};
  sources.forEach(s => s.registers.forEach(n => { board[n] = 'clear'; }));

  const rdap = conn.records?.rdap;
  board['ICANN RDAP']  = rdap?.status === 'found' ? 'clear' : (board['ICANN RDAP'] || 'unreached');
  board['Mail Config'] = conn.records?.mail?.status === 'found' ? 'clear' : (board['Mail Config'] || 'unreached');
  if (siblings.length) board['Infrastructure Cluster'] = 'adverse';
  else if (rdap?.status === 'found') board['Infrastructure Cluster'] = 'clear';

  return board;
}

/* Pass 1b. A register that was actually queried and returned nothing is NOT
   the same thing as a register we could not get into. Both leave the light
   dark, and until this pass existed the board called both of them "could not
   reach it", which is a lie about the second and an insult to the first.
   searchedHosts is every domain that was pinned on a search that ran. */
export function searchedBoard(board, searchedHosts = []) {
  const out = { ...board };
  new Set(searchedHosts).forEach(h => {
    registersServedBy(h).forEach(n => { if (!out[n]) out[n] = 'searched'; });
  });
  return out;
}

/* Pass 1c. A Canadian corporate registry has no record of a Florida company
   and never will. Counting that against coverage makes the whole figure
   meaningless. The assessment publishes not_applicable in coverage_gaps and
   this carries it onto the board so the reader sees why the light is dark. */
export function applicabilityBoard(board, assessment) {
  const out = { ...board };
  const names = Object.keys(board);
  (assessment?.coverage_gaps || []).forEach(g => {
    const reason = String(g.reason || '').toLowerCase().replace(/[\s-]+/g, '_');
    /* not_applicable only. no_match_key means we had nothing to search on,
       which is a hole in coverage and must stay counted as one. */
    if (reason.indexOf('not_applicable') < 0) return;
    const src = String(g.source || '').toLowerCase().trim();
    /* A bare substring test lets an empty or two letter source claim every
       register on the board, which would render the whole sweep "does not
       apply here" and hide every real gap. Require a real name. */
    if (src.length < 5) return;
    names.forEach(nm => {
      if (out[nm] && out[nm] !== 'searched') return;   /* never overwrite a real result */
      const low = nm.toLowerCase();
      if (src.includes(low) || (low.length >= 5 && low.includes(src))) out[nm] = 'na';
    });
  });
  return out;
}

/* Pass 2. Carry the assessment's own verdict on a category onto the registers
   it cited. Only downgrades: a register never becomes cleaner than pass 1.
   searched and na are dark states: an assessment cannot cite a register that
   returned nothing, so they are never upgraded here. */
const RANK = { unreached: 0, searched: 0, na: 0, clear: 1, caution: 2, adverse: 3 };

export function overlayBoard(board, assessment) {
  const out = { ...board };
  (assessment?.categories || []).forEach(c => {
    const st = String(c.state || '').toLowerCase();
    if (st !== 'caution' && st !== 'adverse') return;
    (c.evidence || []).forEach(e => {
      const names = new Set([
        ...registersFor(host(e.url), e.url),
        ...registersFor(String(e.source || '').toLowerCase())
      ]);
      /* An evidence item often names the register in prose rather than by URL. */
      Object.keys(board).forEach(n => {
        if (String(e.source || '').toLowerCase().includes(n.toLowerCase())) names.add(n);
      });
      names.forEach(n => {
        /* Only a register that answered can carry a finding, but once it has
           one, a worse finding from another category must be able to escalate
           it. Otherwise category order decides the colour of the light. */
        const cur = out[n];
        if (cur !== 'clear' && cur !== 'caution' && cur !== 'adverse') return;
        if (RANK[st] > RANK[cur]) out[n] = st;
      });
    });
  });
  return out;
}

/* The review ledger. Deterministic: counts pages actually returned per
   platform. It does not decide what the reviews say, only that we got there. */
export function reviewLedger(sources = [], searchedHosts = []) {
  const searched = new Set(searchedHosts);
  return REVIEW_PLATFORMS.map(p => {
    const hits = sources.filter(s => s.host === p.host || (s.host || '').endsWith('.' + p.host));
    return {
      platform: p.name,
      host: p.host,
      board: p.board,
      searched: searched.has(p.host),
      pages: hits.length,
      urls: hits.slice(0, 6).map(h => ({ url: h.url, title: h.title, date: h.date, snippet: h.snippet }))
    };
  });
}
