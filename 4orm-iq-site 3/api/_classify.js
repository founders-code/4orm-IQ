/**
 * 4orm IQ - VERTICAL CLASSIFICATION
 *
 * Before a plan is built, work out what the party appears to be. A crypto
 * hedge fund is four things at once, and each one opens a different set of
 * registers. Running every specialised search against every company is how a
 * check gets slow, expensive, and full of registers that could never have
 * held a record.
 *
 * This runs BEFORE the reasoning call, on the words the party uses about
 * itself and on the shape of the identifier that was typed in. It is
 * deliberately generous: a classification that is wrong costs a few searches,
 * a classification that is missing costs a whole register pack. Where the
 * signal is weak the classification is still recorded, with its confidence and
 * the phrase that triggered it, and it is published in the report.
 *
 * It never decides anything about the party. It decides where to look.
 */

/* Each vertical: the phrases that open it, and what that vertical means in a
   sentence a reader would accept. Phrases are matched case insensitively as
   whole words or exact fragments, against the search string and, when we have
   it, the party's own published copy. */
const RULES = [
  { v:'PUBLIC_STOCK', why:'trades or claims to trade on a public exchange',
    any:['ticker','nasdaq','nyse','tsx','tsxv','cse','otc markets','otcqb','otcpink',
         'publicly traded','listed company','shareholders','share price','sedar',
         'annual report','quarterly results','stock symbol','common shares'] },

  { v:'BROKER_DEALER', why:'takes orders or holds client accounts',
    any:['broker','brokerage','broker-dealer','broker dealer','execution',
         'client accounts','trading account','open an account','deposit and trade',
         'spreads','leverage','margin account','order execution'] },

  { v:'INVESTMENT_ADVISER', why:'advises on or manages other people’s money',
    any:['investment adviser','investment advisor','registered adviser','wealth management',
         'portfolio management','discretionary management','financial advisor',
         'financial adviser','asset management','managed accounts','ria','form adv'] },

  { v:'PRIVATE_INVESTMENT', why:'raises money privately rather than on an exchange',
    any:['private placement','accredited investor','offering memorandum','subscription agreement',
         'raise','capital raise','investors','minimum investment','units','limited partnership',
         'lp interests','promissory note','fixed return','guaranteed return','roi',
         'passive income','profit share','revenue share'] },

  { v:'VC_STARTUP', why:'is an early stage company raising from investors',
    any:['seed round','series a','series b','pre-seed','venture','vc','cap table',
         'safe note','convertible note','startup','y combinator','techstars','accelerator',
         'founders','pitch deck','term sheet'] },

  { v:'PRIVATE_FUND', why:'pools money from several investors into one vehicle',
    any:['hedge fund','private fund','fund i','fund ii','fund iii','feeder fund',
         'master fund','gp','general partner','limited partners','carried interest',
         'aum','assets under management','fund manager','pooled'] },

  { v:'FOREX_CFD', why:'offers leveraged currency or contract for difference trading',
    any:['forex','fx trading','currency pairs','cfd','cfds','contracts for difference',
         'binary options','metatrader','mt4','mt5','pips','lot size','copy trading',
         'signals','prop firm','funded account','challenge account'] },

  { v:'CRYPTO', why:'deals in crypto assets, custody, exchange or transfer',
    any:['crypto','cryptocurrency','bitcoin','btc','ethereum','eth','usdt','tether',
         'stablecoin','token','tokens','defi','web3','staking','yield farming','mining',
         'wallet','blockchain','exchange listing','airdrop','nft','altcoin','binance',
         'metamask','cold storage','custody'] },

  { v:'COMMODITIES', why:'deals in commodities, futures or physical metals',
    any:['commodity','commodities','futures','gold bullion','precious metals','silver bullion',
         'oil and gas working interest','managed futures','commodity pool','cta','cpo'] }
];

/* Identifier shape carries its own signal. A wallet address typed into the
   search bar is a crypto check whatever the copy says. */
function fromIdentifier(q) {
  const v = String(q || '').trim();
  if (/^(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{20,}|T[A-Za-z0-9]{33})$/.test(v))
    return [{ v: 'CRYPTO', confidence: 0.95, reason: 'the identifier searched is a wallet address' }];
  if (/^\$[A-Z]{1,5}$|^[A-Z]{1,5}\.(TO|V|CN|NE)$/.test(v))
    return [{ v: 'PUBLIC_STOCK', confidence: 0.8, reason: 'the identifier searched is a ticker symbol' }];
  return [];
}

/**
 * classify(query, corpus)
 *   query   what the consumer typed
 *   corpus  any text already retrieved from the party's own site, or ''
 *
 * Returns { verticals, classifications } where classifications carries the
 * confidence and the phrase behind each one, for publication.
 */
export function classify(query, corpus = '') {
  const hay = (String(query || '') + ' \n ' + String(corpus || '')).toLowerCase();
  const out = [];

  RULES.forEach(r => {
    const hits = r.any.filter(p => hay.includes(p));
    if (!hits.length) return;
    /* One phrase is a lead. Three or more, or one from the party's own copy
       rather than the search box, is a classification worth routing on. */
    const confidence = Math.min(0.95, 0.45 + hits.length * 0.12);
    out.push({
      classification: r.v,
      confidence: Number(confidence.toFixed(2)),
      reason: r.why + '. Matched: ' + hits.slice(0, 4).join(', '),
      matched: hits.slice(0, 8)
    });
  });

  fromIdentifier(query).forEach(x => {
    if (out.some(o => o.classification === x.v)) return;
    out.push({ classification: x.v, confidence: x.confidence, reason: x.reason, matched: [] });
  });

  /* Nothing matched. OTHER is a real answer, not a failure: it runs the
     identity, enforcement, web, review and claim date packs, which is the
     right check for a company that is not selling an investment at all. */
  if (!out.length) {
    out.push({ classification: 'OTHER', confidence: 0.4,
      reason: 'no investment, trading or crypto activity was established from the words available. ' +
              'The general packs run, the specialised registers do not.', matched: [] });
  }

  out.sort((a, b) => b.confidence - a.confidence);
  return { verticals: out.map(o => o.classification), classifications: out };
}

/**
 * Jurisdiction hints, from the same material. Used only to narrow, and only
 * where the evidence is positive. Silence never narrows anything.
 */
const JUR = [
  ['CA-BC', ['british columbia','vancouver','bcsc','victoria bc']],
  ['CA-ON', ['ontario','toronto','osc.ca','ottawa']],
  ['CA-AB', ['alberta','calgary','edmonton']],
  ['CA',    ['canada','canadian','.ca ','cra ','fintrac','sedar','ciro']],
  ['US-FL', ['florida','miami','tampa','sunbiz']],
  ['US-CA', ['california','san francisco','los angeles','dfpi']],
  ['US',    ['united states','usa','u.s.','sec.gov','finra','delaware','new york','nevada','wyoming']],
  ['UK',    ['united kingdom','london','companies house','fca ','england','wales']],
  ['AU',    ['australia','sydney','melbourne','asic','afsl']],
  ['HK',    ['hong kong','sfc ','kowloon']],
  ['EU',    ['european union','cyprus','cysec','malta','mfsa','ireland','estonia','lithuania','mica']]
];

export function jurisdictions(query, corpus = '', domain = '') {
  const hay = (String(query || '') + ' ' + String(corpus || '') + ' ' + String(domain || '')).toLowerCase();
  const out = [];
  JUR.forEach(([code, phrases]) => { if (phrases.some(p => hay.includes(p))) out.push(code); });
  if (/\.ca(\/|$|\s)/.test(String(domain || '')) && !out.includes('CA')) out.push('CA');
  if (/\.co\.uk(\/|$|\s)/.test(String(domain || '')) && !out.includes('UK')) out.push('UK');
  if (/\.com\.au(\/|$|\s)/.test(String(domain || '')) && !out.includes('AU')) out.push('AU');
  return [...new Set(out)];
}

export default { classify, jurisdictions };
