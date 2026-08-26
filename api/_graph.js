/**
 * 4orm IQ - THE OPERATOR GRAPH
 *
 * Category 09 used to be three signals. This is the structure underneath them.
 *
 * The graph answers one question that no register answers: is this operation
 * the same operation as one we have seen before, under a different name. It
 * does that by recording identifiers that a party controls, and edges between
 * them, and then looking for the same identifier under two names.
 *
 * The whole value depends on one discipline. A shared identifier is a fact.
 * A shared operator is a conclusion. Two companies behind Cloudflare share an
 * identifier and nothing else, and a system that cannot tell that apart from
 * two companies sharing a wallet is worse than useless, because it will be
 * confidently wrong about somebody's business.
 *
 * So every edge carries:
 *   specificity   how much the identifier narrows the world
 *   source_tier   what kind of record it came from
 *   status        OBSERVED, CORROBORATED, DISPUTED, STALE
 *   evidence      the excerpt and the URL it was read from
 *
 * And a cluster is only ever reported at the strength its edges support.
 */

export const NODE_TYPES = [
  'DOMAIN','IP_ADDRESS','NAMESERVER','REGISTRAR',
  'GOOGLE_ANALYTICS_ID','GOOGLE_TAG_MANAGER_ID','META_PIXEL_ID','OTHER_TRACKING_ID',
  'EMAIL','PHONE','TELEGRAM','WHATSAPP','SOCIAL_HANDLE',
  'CRYPTO_WALLET','BANK_BENEFICIARY','BANK_ACCOUNT_REFERENCE','IBAN','SWIFT',
  'PERSON','DIRECTOR','OFFICER','PROMOTER','ADVISER',
  'LEGAL_ENTITY','TRADING_NAME',
  'APP','APP_DEVELOPER',
  'GITHUB_ACCOUNT','GITHUB_REPOSITORY',
  'TRADEMARK','PATENT',
  'REGULATOR_WARNING','COURT_CASE','ENFORCEMENT_ACTION'
];

export const EDGE_TYPES = [
  'RESOLVES_TO','USES_NAMESERVER','REGISTERED_WITH','USES_ANALYTICS','USES_META_PIXEL',
  'USES_EMAIL','USES_PHONE','PROMOTES_WALLET',
  'USES_DOMAIN','CONTROLLED_BY','DIRECTOR','PROMOTED_BY','RECEIVES_FUNDS_AS',
  'CONTROLS','PROMOTES','ASSOCIATED_WITH',
  'DEVELOPED_BY','CONTRIBUTES_TO',
  'PREVIOUSLY_WARNED_AS','PREVIOUSLY_WARNED_IN',
  'SHARES_IDENTIFIER_WITH','SHARES_BENEFICIARY_WITH','SHARES_WALLET_WITH','SHARES_PERSON_WITH'
];

export const EDGE_STATUS = ['OBSERVED','CORROBORATED','DISPUTED','STALE'];

/* ------------------------------------------------------------------ *
 * SPECIFICITY
 *
 * How much does sharing THIS identifier narrow the world. This is the number
 * that stops the graph shouting about Cloudflare.
 *
 *   0.05  everybody uses it
 *   0.35  a real but common arrangement
 *   0.70  a property somebody had to create and configure
 *   0.95  money, or a document, and there is no innocent reason to share it
 * ------------------------------------------------------------------ */
const GENERIC_HOSTS = [
  'cloudflare','godaddy','namecheap','aws','amazonaws','google','gcp','azure','microsoft',
  'digitalocean','hostinger','wix','squarespace','shopify','wordpress','bluehost',
  'siteground','ovh','hetzner','linode','vercel','netlify','fastly','akamai','cdn'
];

const BASE_SPECIFICITY = {
  NAMESERVER: 0.35, REGISTRAR: 0.15, IP_ADDRESS: 0.45,
  GOOGLE_ANALYTICS_ID: 0.88, GOOGLE_TAG_MANAGER_ID: 0.88, META_PIXEL_ID: 0.90,
  OTHER_TRACKING_ID: 0.75,
  EMAIL: 0.85, PHONE: 0.85, TELEGRAM: 0.80, WHATSAPP: 0.80, SOCIAL_HANDLE: 0.70,
  CRYPTO_WALLET: 0.96, BANK_BENEFICIARY: 0.96, BANK_ACCOUNT_REFERENCE: 0.96,
  IBAN: 0.96, SWIFT: 0.40,
  PERSON: 0.82, DIRECTOR: 0.88, OFFICER: 0.88, PROMOTER: 0.75, ADVISER: 0.70,
  LEGAL_ENTITY: 0.90, TRADING_NAME: 0.60,
  APP_DEVELOPER: 0.85, GITHUB_ACCOUNT: 0.80, GITHUB_REPOSITORY: 0.75,
  TRADEMARK: 0.85, DOMAIN: 0.50,
  REGULATOR_WARNING: 0.90, COURT_CASE: 0.85, ENFORCEMENT_ACTION: 0.90
};

/**
 * specificity(node) -> { value, band, why }
 * band is the word a reader sees. The number is for the maths.
 */
export function specificity(node) {
  const type = String(node.node_type || '').toUpperCase();
  const val = String(node.normalized_value || node.display_value || '').toLowerCase();
  let v = BASE_SPECIFICITY[type];
  if (v === undefined) v = 0.5;
  let why = '';

  /* A generic provider tells you nothing about who runs the site. */
  if (['NAMESERVER','IP_ADDRESS','REGISTRAR'].includes(type) &&
      GENERIC_HOSTS.some(g => val.includes(g))) {
    v = 0.05;
    why = 'a mass market provider that millions of unrelated sites use';
  }

  /* A shared mailbox at a free provider is weaker than a company address. */
  if (type === 'EMAIL' && /@(gmail|outlook|hotmail|yahoo|proton|icloud)\./.test(val)) {
    v = 0.62;
    why = 'a free mailbox rather than a company address, so it is weaker than it looks';
  }
  /* A role address at the same domain is not a link between two operations. */
  if (type === 'EMAIL' && /^(info|admin|support|contact|sales|hello|office)@/.test(val)) {
    v = Math.min(v, 0.55);
    why = why || 'a role address, which is common and reused legitimately';
  }
  /* A default analytics container that ships with a template. */
  if (['GOOGLE_ANALYTICS_ID','GOOGLE_TAG_MANAGER_ID'].includes(type) &&
      /^(ua-0+|g-0+|gtm-0+|gtm-xxxx)/.test(val)) {
    v = 0.10;
    why = 'a placeholder container id that ships with the template, not a configured property';
  }

  return { value: Number(v.toFixed(2)), band: band(v), why };
}

function band(v) {
  if (v >= 0.92) return 'very high';
  if (v >= 0.70) return 'high';
  if (v >= 0.40) return 'medium';
  if (v >= 0.20) return 'low';
  return 'very low';
}

/* ------------------------------------------------------------------ *
 * NODES AND EDGES
 * ------------------------------------------------------------------ */

export function normalize(type, value) {
  let v = String(value == null ? '' : value).trim();
  switch (String(type).toUpperCase()) {
    case 'DOMAIN': case 'NAMESERVER':
      return v.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    case 'EMAIL': return v.toLowerCase();
    case 'PHONE': return v.replace(/[^\d+]/g, '');
    case 'CRYPTO_WALLET':
      /* EVM addresses are case insensitive in practice; other chains are not. */
      return /^0x[a-fA-F0-9]{40}$/.test(v) ? v.toLowerCase() : v;
    case 'PERSON': case 'DIRECTOR': case 'OFFICER': case 'PROMOTER': case 'ADVISER':
    case 'LEGAL_ENTITY': case 'TRADING_NAME':
      return v.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ')
              .replace(/\b(inc|llc|ltd|limited|corp|corporation|plc|gmbh|sa|nv|bv|pty|lp|llp)\b/g, '')
              .trim();
    default: return v.toLowerCase();
  }
}

export function nodeId(type, value) {
  return String(type).toUpperCase() + ':' + normalize(type, value);
}

export function node(type, value, display) {
  const t = String(type).toUpperCase();
  if (!NODE_TYPES.includes(t)) throw new Error('unknown node type: ' + t);
  const n = {
    node_id: nodeId(t, value),
    node_type: t,
    normalized_value: normalize(t, value),
    display_value: display || String(value)
  };
  n.specificity = specificity(n);
  return n;
}

/**
 * edge(from, to, type, evidence)
 * evidence carries where this came from, which is what makes an edge
 * something a reader can check rather than something we assert.
 */
export function edge(from, to, type, ev = {}) {
  const t = String(type).toUpperCase();
  if (!EDGE_TYPES.includes(t)) throw new Error('unknown edge type: ' + t);
  return {
    from_node_id: from.node_id || from,
    to_node_id: to.node_id || to,
    edge_type: t,
    source_id: ev.source_id || null,
    run_id: ev.run_id || null,
    first_seen: ev.first_seen || null,
    last_seen: ev.last_seen || null,
    source_tier: ev.source_tier || 'B',
    confidence: ev.confidence == null ? 0.6 : ev.confidence,
    historically_available: !!ev.historically_available,
    evidence_excerpt: ev.excerpt || '',
    source_url: ev.url || '',
    retrieved_at: ev.retrieved_at || null,
    status: EDGE_STATUS.includes(ev.status) ? ev.status : 'OBSERVED'
  };
}

/* ------------------------------------------------------------------ *
 * CONVERGENCE
 *
 * The Run Manual rule, held to: category 09 needs convergence. One connection
 * is interesting. Two independent meaningful connections are material. Three
 * or more high specificity independent connections are strong.
 *
 * Independent means the connections do not all rest on the same underlying
 * fact. Two domains on one IP and the same two domains on that IP's
 * nameserver is one connection, not two, and counting it twice is how a graph
 * talks itself into a conclusion.
 * ------------------------------------------------------------------ */

/* Which family a node type belongs to, for the independence test. */
const FAMILY = {
  IP_ADDRESS:'infrastructure', NAMESERVER:'infrastructure', REGISTRAR:'infrastructure',
  DOMAIN:'infrastructure',
  GOOGLE_ANALYTICS_ID:'tracking', GOOGLE_TAG_MANAGER_ID:'tracking',
  META_PIXEL_ID:'tracking', OTHER_TRACKING_ID:'tracking',
  EMAIL:'contact', PHONE:'contact', TELEGRAM:'contact', WHATSAPP:'contact', SOCIAL_HANDLE:'contact',
  CRYPTO_WALLET:'money', BANK_BENEFICIARY:'money', BANK_ACCOUNT_REFERENCE:'money',
  IBAN:'money', SWIFT:'money',
  PERSON:'people', DIRECTOR:'people', OFFICER:'people', PROMOTER:'people', ADVISER:'people',
  LEGAL_ENTITY:'people', TRADING_NAME:'people',
  APP_DEVELOPER:'build', GITHUB_ACCOUNT:'build', GITHUB_REPOSITORY:'build', APP:'build',
  TRADEMARK:'registry', PATENT:'registry',
  REGULATOR_WARNING:'record', COURT_CASE:'record', ENFORCEMENT_ACTION:'record'
};

export function family(type) { return FAMILY[String(type).toUpperCase()] || 'other'; }

/**
 * converge(links) -> { strength, independent, counted, dropped, statement }
 *
 * links: [{ node, other, edge }] every identifier this subject shares with
 * some other named party.
 *
 * strength: none | interesting | material | strong
 */
export function converge(links = []) {
  const counted = [], dropped = [], seenFamily = new Map();

  links.forEach(l => {
    const s = l.node.specificity || specificity(l.node);
    if (s.value < 0.20) {
      dropped.push({ ...l, why: s.why || 'too common to mean anything on its own' });
      return;
    }
    /* Independence: one connection per family per counterparty. The strongest
       identifier in a family represents it. */
    const key = family(l.node.node_type) + '||' + (l.other || '');
    const prev = seenFamily.get(key);
    if (prev && (prev.node.specificity || specificity(prev.node)).value >= s.value) {
      dropped.push({ ...l, why: 'the same kind of connection to the same party is already counted, and counting it twice would overstate it' });
      return;
    }
    if (prev) {
      dropped.push({ ...prev, why: 'superseded by a more specific connection of the same kind' });
      counted.splice(counted.indexOf(prev), 1);
    }
    seenFamily.set(key, l);
    counted.push(l);
  });

  const high = counted.filter(l => (l.node.specificity || specificity(l.node)).value >= 0.70);

  let strength = 'none';
  if (counted.length === 1) strength = 'interesting';
  else if (counted.length >= 2 && high.length < 3) strength = 'material';
  if (high.length >= 3) strength = 'strong';

  return { strength, counted, dropped, independent: counted.length, high: high.length,
           statement: statement(strength, counted, high) };
}

function statement(strength, counted, high) {
  if (!counted.length)
    return 'No identifier connects this party to any other party in our records. ' +
           'That is not evidence of anything either way.';
  const names = [...new Set(counted.map(l => l.other).filter(Boolean))];
  const what = counted.map(l => l.node.node_type.toLowerCase().replace(/_/g, ' ')).join(', ');
  const who = names.length === 1 ? names[0] : names.length + ' other parties';

  if (strength === 'interesting')
    return 'One identifier, a ' + what + ', is shared with ' + who + '. ' +
           'One shared identifier is worth knowing about and is not evidence of a shared operator. ' +
           'It is published so you can judge it.';
  if (strength === 'material')
    return counted.length + ' independent identifiers are shared with ' + who +
           ' (' + what + '). Independent means they do not all rest on the same underlying fact. ' +
           'Two or more independent connections is a material finding and warrants explanation.';
  return high.length + ' high specificity identifiers, independently observed, connect this party to ' +
         who + ' (' + what + '). Each one is listed below with the record it was read from. ' +
         'This is the strongest thing the operator graph can say, and it still describes a connection, ' +
         'not an accusation.';
}

/* ------------------------------------------------------------------ *
 * PREVIOUS WARNING MEMORY
 *
 * The part that is worth the most. When an identifier belonging to this party
 * has been seen before attached to an entity that later received a regulator
 * warning, say so, name the identifier, name the entity, name the regulator
 * and give the date. Never assert that the two are the same operation.
 * ------------------------------------------------------------------ */
export function priorWarnings(links = []) {
  return links
    .filter(l => l.priorWarning)
    .map(l => {
      const s = l.node.specificity || specificity(l.node);
      return {
        identifier_type: l.node.node_type,
        identifier: l.node.display_value,
        specificity: s.band,
        prior_entity: l.priorWarning.entity,
        regulator: l.priorWarning.regulator,
        date: l.priorWarning.date,
        source_url: l.priorWarning.url || '',
        statement:
          'The ' + l.node.node_type.toLowerCase().replace(/_/g, ' ') + ' ' + l.node.display_value +
          ' appears both on this party and on ' + l.priorWarning.entity +
          ', which ' + l.priorWarning.regulator + ' published a warning about on ' +
          l.priorWarning.date + '. We are reporting a shared identifier and the record it ' +
          'came from. We are not stating that the two are run by the same people.'
      };
    });
}

/* ------------------------------------------------------------------ *
 * WALLET ATTRIBUTION
 *
 * A chain record proves what moved. It never proves who owns an address.
 * ------------------------------------------------------------------ */
export function walletStatement(wallet, how) {
  if (how && how.first_party)
    return 'The website supplied ' + wallet + ' as its payment address on ' +
           (how.retrieved_at || 'the date shown') + '. That is a first party statement by the party itself.';
  if (how && how.attributed_by)
    return 'This wallet was attributed to this party by ' + how.attributed_by +
           '. Independent ownership verification was not located, and nobody controls an address ' +
           'because a third party says so.';
  return 'This address appears in the evidence. Who controls it has not been established, ' +
         'and a chain record cannot establish it.';
}

export default {
  NODE_TYPES, EDGE_TYPES, EDGE_STATUS, node, edge, nodeId, normalize,
  specificity, family, converge, priorWarnings, walletStatement
};
