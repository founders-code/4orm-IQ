/**
 * 4orm IQ - THE OPERATOR GRAPH AND ROUTING TESTS
 *
 *   node tools/graph-tests.mjs
 *
 * Eight tests, run against the real modules. Each one encodes a way this
 * feature could be confidently wrong about a real business, which is the only
 * failure mode that matters here: a graph that shouts about Cloudflare, or a
 * chronology that calls an old brand a liar because it bought its domain late,
 * damages somebody who did nothing.
 */
import { specificity, node, converge, walletStatement } from '../api/_graph.js';
import { classify, jurisdictions } from '../api/_classify.js';
import { applicable, BY_ID, TOTAL_SOURCES } from '../api/_catalogue.js';
import { plan } from '../api/_retrieval.js';
import { searchedBoard, applicabilityBoard, overlayBoard } from '../api/_registers.js';

let pass = 0, fail = 0;
const ok  = (t, c, note) => { c ? pass++ : fail++; console.log((c ? '  PASS  ' : '  FAIL  ') + t + (note ? '\n          ' + note : '')); };
const head = t => console.log('\n' + t);

/* ---------------------------------------------------------------- TEST 1 */
head('TEST 1  Form D chronology. A claimed 2018 raise, a 2025 first sale.');
{
  const p = plan('Meridian Growth Fund', 'meridiangrowth.com', null,
    { verticals: ['PRIVATE_FUND', 'PRIVATE_INVESTMENT'] });
  const formD = p.par.find(x => /Form D/i.test(x.label));
  ok('the Form D objective is in the plan', !!formD);
  ok('it asks for the date of first sale specifically',
     !!formD && /date of first sale/i.test(formD.objective));
  ok('it forbids treating the gap as wrongdoing on its own',
     !!formD && /never on its own an allegation|not.*automatically|requires explanation/i.test(formD.objective),
     'a first sale later than a claimed start date has ordinary explanations');
  const chrono = p.par.find(x => /Dated claims/i.test(x.label));
  ok('the dated claims objective extracts verbatim and does not evaluate',
     !!chrono && /VERBATIM|verbatim/.test(chrono.objective) && /Do not evaluate/i.test(chrono.objective));
}

/* ---------------------------------------------------------------- TEST 2 */
head('TEST 2  Adviser identity mismatch. The claimed CRD belongs to somebody else.');
{
  const p = plan('Atlas Wealth', 'atlaswealth.com', null, { verticals: ['INVESTMENT_ADVISER'] });
  const iapd = p.par.find(x => /IAPD/i.test(x.label));
  ok('the IAPD objective is in the plan', !!iapd);
  ok('it instructs an explicit finding when the number belongs to another entity',
     !!iapd && /different legal entity/i.test(iapd.objective) && /quote both names/i.test(iapd.objective));
  ok('it forbids reading a current registration as an endorsement',
     !!iapd && /not an endorsement/i.test(iapd.objective));
  ok('it keeps historical registration',
     !!iapd && /historical/i.test(iapd.objective));
}

/* ---------------------------------------------------------------- TEST 3 */
head('TEST 3  Trading suspension. An exact ticker hit outranks thin coverage.');
{
  const p = plan('NVCT', 'nvct.example', null, { verticals: ['PUBLIC_STOCK'] });
  const sus = p.exa.find(x => /trading suspension/i.test(x.label));
  ok('the suspension search runs for a public stock', !!sus);
  ok('it is pinned to the regulator itself',
     !!sus && (sus.includeDomains || []).includes('sec.gov'));
  const other = plan('Acme Plumbing', 'acmeplumbing.com', null, { verticals: ['OTHER'] });
  ok('and it does NOT run for a party with no securities activity',
     !other.exa.some(x => /trading suspension/i.test(x.label)),
     'routing exists so a plumber is not measured against a stock register');
  ok('SEC Trading Suspensions is routed to PUBLIC_STOCK only',
     BY_ID.SEC_TRADING_SUSPENSIONS.verticals.join() === 'PUBLIC_STOCK');
}

/* ---------------------------------------------------------------- TEST 4 */
head('TEST 4  Reddit only. Five posts, no authoritative corroboration.');
{
  ok('Reddit is Tier D', BY_ID.REDDIT.source_tier === 'D');
  ok('every review platform is Tier C or D, so none can carry RED alone',
     ['TRUSTPILOT','SITEJABBER','BBB_SCAM_TRACKER','FOREX_PEACE_ARMY','REDDIT','GLASSDOOR']
       .every(k => ['C','D'].includes(BY_ID[k].source_tier)));
  ok('the DFPI tracker is government published and still not an adjudicated finding',
     BY_ID.DFPI_CRYPTO_SCAM_TRACKER.evidence_kind === 'government_published_consumer_report' &&
     BY_ID.DFPI_CRYPTO_SCAM_TRACKER.source_tier === 'B',
     'a regulator publishing a consumer complaint does not turn it into a finding');
}

/* ---------------------------------------------------------------- TEST 5 */
head('TEST 5  Operator reuse. Same analytics id, same phone, same wallet, prior warning.');
{
  const links = [
    { node: node('GOOGLE_ANALYTICS_ID', 'G-7QK2M4XR10'), other: 'Harbourline Capital' },
    { node: node('PHONE', '+1 604 555 0148'),            other: 'Harbourline Capital' },
    { node: node('CRYPTO_WALLET', 'TQn9Y2khEsLJW1ChVWFMSMeRDow5oy1F2P'), other: 'Harbourline Capital' }
  ];
  const r = converge(links);
  ok('three high specificity connections read as strong', r.strength === 'strong', r.strength);
  ok('all three are counted as independent', r.independent === 3);
  ok('the statement describes a connection, never a shared operator',
     !/same operator|run by the same/i.test(r.statement) && /connection|connect/i.test(r.statement),
     r.statement.slice(0, 90) + '...');
}

/* ---------------------------------------------------------------- TEST 6 */
head('TEST 6  Generic infrastructure. Two unrelated sites both behind Cloudflare.');
{
  const cf = node('NAMESERVER', 'ns1.cloudflare.com');
  ok('Cloudflare scores very low specificity', cf.specificity.band === 'very low',
     cf.specificity.value + ' ' + cf.specificity.why);
  const r = converge([{ node: cf, other: 'Some Other Company' }]);
  ok('it produces NO operator connection at all', r.strength === 'none', r.strength);
  ok('and it is published as found and not counted, rather than hidden',
     r.dropped.length === 1 && typeof r.dropped[0].why === 'string' && r.dropped[0].why.length > 12,
     r.dropped[0] && r.dropped[0].why);

  const gtm = node('GOOGLE_TAG_MANAGER_ID', 'GTM-XXXX');
  ok('a placeholder container id is also worthless', gtm.specificity.band === 'very low',
     gtm.specificity.why);
}

/* ---------------------------------------------------------------- TEST 7 */
head('TEST 7  Wallet attribution. A blog says the wallet is theirs.');
{
  const third = walletStatement('0xabc...', { attributed_by: 'a third party blog' });
  ok('third party attribution is stored as attribution, not ownership',
     /attributed to/i.test(third) && /not located/i.test(third) && !/belongs to/i.test(third), third);
  const firstParty = walletStatement('0xabc...', { first_party: true, retrieved_at: '12 Aug 2026' });
  ok('a first party statement is described as exactly that',
     /website supplied/i.test(firstParty) && /first party/i.test(firstParty));
  const unknown = walletStatement('0xabc...', null);
  ok('and with nothing at all, ownership is explicitly not established',
     /has not been established/i.test(unknown) && /cannot establish/i.test(unknown));
}

/* ---------------------------------------------------------------- TEST 8 */
head('TEST 8  A source is unavailable because no key exists.');
{
  const st = BY_ID.SECURITYTRAILS;
  ok('SecurityTrails declares the key it would need', st.key_name === 'SECURITYTRAILS_API_KEY');
  ok('its failure behaviour is a published gap, never clean', st.failure_behavior === 'gap');
  ok('every source in the catalogue fails to a gap',
     Object.values(BY_ID).every(x => x.failure_behavior === 'gap'));

  /* A plan that never ran must not mark its registers as asked and empty. */
  const board = searchedBoard({}, []);
  ok('a search that did not run pins nothing', Object.keys(board).length === 0,
     'pinning a plan rather than an outcome would manufacture negative results out of an outage');
}

/* ------------------------------------------------- routing and coverage */
head('ROUTING  Coverage is measured against what could have applied.');
{
  const ca = applicable({ verticals: ['PUBLIC_STOCK'], jurisdictions: ['CA'] });
  const asicApplies = ca.applicable.some(s => s.source_id === 'ASIC_PRO_REGISTER');
  ok('an Australian licence register does not apply to a Canada only issuer', !asicApplies);
  const named = ca.notApplicable.find(x => x.source.source_id === 'ASIC_PRO_REGISTER');
  ok('and it is named with a reason rather than silently dropped', !!named, named && named.reason);
  ok('applicable is always smaller than the catalogue', ca.applicable.length < TOTAL_SOURCES,
     ca.applicable.length + ' of ' + TOTAL_SOURCES);

  const wide = applicable({ verticals: ['CRYPTO'], jurisdictions: [] });
  ok('with no jurisdiction established, nothing is excluded on jurisdiction',
     !wide.notApplicable.some(x => /register, and no/.test(x.reason)),
     'silence about where a party operates must never shrink the check');
}

head('CLASSIFICATION  Multiple classifications are normal.');
{
  const c = classify('northstar crypto hedge fund accredited investor portfolio management');
  ok('a crypto hedge fund classifies as several things at once', c.verticals.length >= 3, c.verticals.join(', '));
  ok('a plumber classifies as OTHER and nothing else',
     classify('acme plumbing toronto').verticals.join() === 'OTHER');
  ok('a wallet address classifies as crypto from its shape alone',
     classify('TQn9Y2khEsLJW1ChVWFMSMeRDow5oy1F2P').verticals.includes('CRYPTO'));
  ok('every classification carries the phrase that produced it',
     c.classifications.every(x => x.reason && x.reason.length > 10));
}

head('BOARD  A dark register still cannot be talked into a finding.');
{
  const b = applicabilityBoard({ 'Corporations Canada': '' },
    { coverage_gaps: [{ source: '', reason: 'not_applicable' }] });
  ok('an empty source string cannot mark the whole board inapplicable',
     b['Corporations Canada'] === '');
  const o = overlayBoard({ 'BCSC Caution List': 'searched' },
    { categories: [{ state: 'adverse', evidence: [{ source: 'BCSC Caution List', url: '' }] }] });
  ok('a register that came back empty cannot be given a finding',
     o['BCSC Caution List'] === 'searched');
  const esc = overlayBoard({ 'BCSC Caution List': 'caution' },
    { categories: [{ state: 'adverse', evidence: [{ source: 'BCSC Caution List', url: '' }] }] });
  ok('but a register that answered can be escalated by a worse finding',
     esc['BCSC Caution List'] === 'adverse');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
