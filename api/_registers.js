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
  'ised-isde.canada.ca':        ['Corporations Canada', 'OSB Bankruptcy'],
  'canadasbusinessregistries.ca': ['Corporations Canada'],
  'ontario.ca':                 ['Ontario Registry'],
  'bcregistry.gov.bc.ca':       ['BC Registry'],
  'alberta.ca':                 ['Alberta Registry'],
  'sec.gov':                    ['SEC EDGAR'],
  'find-and-update.company-information.service.gov.uk': ['Companies House', 'UK PSC Register'],

  /* 02 Licensing */
  'securities-administrators.ca':        ['CSA Registration', 'CSA Alerts', 'CSA Disciplined'],
  'autorites-valeurs-mobilieres.ca':     ['CSA Registration'],
  'ciro.ca':                    ['CIRO AdvisorReport'],
  'fintrac-canafe.canada.ca':   ['FINTRAC MSB'],
  'bankofcanada.ca':            ['Bank of Canada PSP'],
  'register.fca.org.uk':        ['FCA Register'],
  'brokercheck.finra.org':      ['BrokerCheck'],
  'finra.org':                  ['BrokerCheck'],
  'adviserinfo.sec.gov':        ['BrokerCheck'],
  'nfa.futures.org':            ['NFA BASIC'],

  /* 03 Enforcement */
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
  'canlii.org':                 ['CanLII'],
  'courtlistener.com':          ['CourtListener'],
  'gov.uk':                     ['UK Insolvency'],
  'scc-csc.ca':                 ['CanLII'],
  'fct-cf.gc.ca':               ['CanLII'],

  /* 06 Web */
  'rdap.org':                   ['ICANN RDAP'],
  'crt.sh':                     ['Certificate Log'],
  'virustotal.com':             ['VirusTotal'],
  'urlscan.io':                 ['urlscan.io'],
  'transparencyreport.google.com': ['Google Web Risk'],

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

/* A host matches a map entry if it is that host or a subdomain of it. */
function registersFor(h) {
  if (!h) return [];
  if (HOST_MAP[h]) return HOST_MAP[h];
  for (const key of Object.keys(HOST_MAP)) {
    if (h.endsWith('.' + key)) return HOST_MAP[key];
  }
  return [];
}

/* Every URL retrieved this run, flattened, with its register attribution. */
export function retrievedSources(exaOut = [], parOut = []) {
  const out = [];
  exaOut.forEach(b => (b.results || []).forEach(r => {
    const h = host(r.url);
    out.push({
      tier: 'Exa', label: b.label || '', url: r.url, title: r.title || '',
      date: r.date || null, host: h, registers: registersFor(h),
      snippet: (r.highlights && r.highlights[0]) || (r.text || '').slice(0, 400) || ''
    });
  }));
  parOut.forEach(b => (b.results || []).forEach(r => {
    const h = host(r.url);
    out.push({
      tier: 'Parallel', label: b.label || '', url: r.url, title: r.title || '',
      date: r.date || null, host: h, registers: registersFor(h),
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

/* Pass 2. Carry the assessment's own verdict on a category onto the registers
   it cited. Only downgrades: a register never becomes cleaner than pass 1. */
const RANK = { unreached: 0, clear: 1, caution: 2, adverse: 3 };

export function overlayBoard(board, assessment) {
  const out = { ...board };
  (assessment?.categories || []).forEach(c => {
    const st = String(c.state || '').toLowerCase();
    if (st !== 'caution' && st !== 'adverse') return;
    (c.evidence || []).forEach(e => {
      const names = new Set([
        ...registersFor(host(e.url)),
        ...registersFor(String(e.source || '').toLowerCase())
      ]);
      /* An evidence item often names the register in prose rather than by URL. */
      Object.keys(board).forEach(n => {
        if (String(e.source || '').toLowerCase().includes(n.toLowerCase())) names.add(n);
      });
      names.forEach(n => {
        if (!out[n]) return;                       /* never light an unreached register */
        if (RANK[st] > RANK[out[n]]) out[n] = st;
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
