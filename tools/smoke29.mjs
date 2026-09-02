/* THE REGISTER, AND THE ONE THING IT MUST NEVER DO.
 *
 * This names real businesses. In Canadian defamation the plaintiff does not
 * have to prove falsity: say something that lowers a company's reputation and
 * the burden is on us to make out a defence. So what is measured here is not
 * that the page looks right. It is that:
 *
 *   an official entry carries the authority's name, its date and its link,
 *     because "that body published this" is provably true and truth is a
 *     complete defence, and without those three we have no defence at all;
 *   a pattern entry states counts and never a conclusion, and says on its own
 *     line that no regulator has acted;
 *   no verdict word ever appears beside a named company;
 *   an entry the server has not named cannot be named by the page;
 *   the right of reply is on the page, above the names.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

/* A register with one of each, plus one the server has held back. */
const FEED = {
  ok: true, asOf: '2026-09-01',
  counts: { parties: 4, official: 1, pattern: 1, fresh: 2, unnamed: 2 },
  items: [
    { name: 'Atlantic Global Wealth', domain: 'atlanticglobalwealth.com', tier: 'official',
      authority: 'FCA Warning List', authorityUrl: 'https://register.fca.org.uk/x',
      finding: 'Named on the warning list as not authorised to carry on regulated activity.',
      foundAt: '2026-03-03', searches: 88, recent: 40, firstSeen: '2026-08-28',
      lastSeen: '2026-09-01', isNew: true, rising: true, named: true, awaitingReply: false },
    { name: 'Harbourline Capital Group', domain: 'harbourline.com', tier: 'pattern',
      platforms: 5, reports: 43, searches: 34, recent: 6, firstSeen: '2026-07-02',
      lastSeen: '2026-09-01', isNew: false, rising: false, named: true, awaitingReply: false,
      reply: 'We dispute the characterisation and have asked the platforms to remove them.',
      replyAt: '2026-08-20' },
    /* Held back by the server: counted, no name, no domain. */
    { name: null, domain: null, tier: 'pattern', platforms: 3, reports: 9, searches: 4,
      recent: 4, firstSeen: '2026-08-30', lastSeen: '2026-09-01', isNew: true, rising: true,
      named: false, awaitingReply: true },
    /* HOSTILE. A held entry that arrives WITH a name on it, which is what a bug
       on the server, a stale cache or a tampered response looks like. The page
       must refuse it on the flag rather than trust that the name was nulled. */
    { name: 'LEAKY SHOULD NOT APPEAR LTD', domain: 'leaky-should-not-appear.example',
      tier: 'pattern', platforms: 4, reports: 12, searches: 7, recent: 7,
      firstSeen: '2026-08-31', lastSeen: '2026-09-01', isNew: true, rising: true,
      named: false, awaitingReply: true }
  ]
};

await p.route('**/api/register*', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) }));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(1200);

/* Under the search bar, not above it. It is a second thought after the thing
   they came to do, and above the bar it reads as a prerequisite. */
{
  const pos = await p.evaluate(() => {
    const r = document.getElementById('regRow').getBoundingClientRect();
    const f = document.getElementById('kbForm').getBoundingClientRect();
    return { pill: Math.round(r.top), form: Math.round(f.bottom) };
  });
  console.log('pill top', pos.pill, 'search bar bottom', pos.form);
  if (pos.pill < pos.form) fail('the register pill sits above the search bar, it belongs under it');
}

/* The pill only exists when there is something behind it. */
const pill = await p.evaluate(() => {
  const r = document.getElementById('regRow');
  return { shown: !r.hidden, n: (document.getElementById('regPillN').textContent || '').trim() };
});
console.log('pill:', JSON.stringify(pill));
if (!pill.shown) fail('the register pill is hidden when the register has entries');
if (pill.n !== '4') fail('the pill count does not match the register');

await p.click('#regOpen');
await p.waitForTimeout(500);
const body = await p.evaluate(() => document.getElementById('regBody').innerText);
const html = await p.evaluate(() => document.getElementById('regBody').innerHTML);

/* THE GATE. A held-back entry may not be named, and its counts may not be
   attached to anything that identifies it. */
if (/harbourline\.com/i.test(body) === false) fail('a named entry did not render at all');
const names = await p.evaluate(() =>
  [...document.querySelectorAll('#regBody .reg-name')].map(e => e.textContent.trim()));
console.log('names on the page:', JSON.stringify(names));
if (names.length !== 2) fail('the page shows ' + names.length + ' names for two named entries');
if (/LEAKY SHOULD NOT APPEAR/i.test(body) || /leaky-should-not-appear/i.test(body))
  fail('a held entry that arrived carrying a name was published anyway: the page trusts the '
     + 'server to have nulled it instead of refusing on the flag');
if (names.some(n => !n)) fail('an entry rendered with an empty name, which is a held entry leaking');
if (!/2 further parties are counted and not named/i.test(body))
  fail('the held entry is not accounted for, so the counts do not add up on the page');

/* AN OFFICIAL ENTRY IS SOMEBODY ELSE'S RECORD. All three or it is not one. */
if (!/FCA Warning List/.test(body)) fail('an official entry does not name the authority');
if (!/2026-03-03/.test(body)) fail('an official entry does not carry the date the authority published');
if (!/register\.fca\.org\.uk/.test(html)) fail('an official entry does not link to the authority');

/* A PATTERN ENTRY IS A COUNT, AND SAYS SO ON ITS OWN LINE. */
if (!/5 independent platforms/.test(body)) fail('a pattern entry does not say how many platforms');
if (!/43 reports/.test(body)) fail('a pattern entry does not say how many reports');
const noReg = await p.evaluate(() =>
  [...document.querySelectorAll('#regBody .regnone')].map(e => e.textContent.trim()));
if (!noReg.some(t => /no regulator has acted/i.test(t)))
  fail('a pattern entry does not say on its own line that no regulator has acted');
if (!/We dispute the characterisation/.test(body))
  fail('a reply we were sent is not printed beside the entry');

/* NO VERDICT WORD ANYWHERE NEAR A NAMED COMPANY. */
for (const w of ['scam', 'fraudster', 'fraudulent', 'criminal', 'dishonest', 'rip off', 'ripoff',
                 'crook', 'con artist', 'thief', 'stole'])
  if (new RegExp('\\b' + w + '\\b', 'i').test(body))
    fail('the word "' + w + '" appears on a page that names real companies');
if (/\bfraud\b/i.test(body) && !/anti-fraud/i.test(body))
  fail('the word "fraud" appears on a page that names real companies');

/* THE RIGHT OF REPLY IS ON THE PAGE, ABOVE THE NAMES. */
if (!/register@4ormfinance\.com/.test(body)) fail('there is no address to write to');
const order = await p.evaluate(() => {
  const b = document.getElementById('regBody');
  const rules = b.querySelector('.regrules');
  const first = b.querySelector('.reglist');
  if (!rules || !first) return null;
  return rules.getBoundingClientRect().top < first.getBoundingClientRect().top;
});
if (order !== true) fail('the rules and the right of reply sit below the names, they belong above them');

/* A register that is switched off shows no pill at all. */
await p.route('**/api/register*', r =>
  r.fulfill({ status: 200, contentType: 'application/json',
              body: JSON.stringify({ ok: false, reason: 'no_database', items: [], counts: null }) }));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(1200);
if (await p.evaluate(() => !document.getElementById('regRow').hidden))
  fail('the pill is shown when the register is switched off, so it opens an empty page');

if (errs.length) fail('page errors ' + errs.slice(0, 2).join(' | '));
console.log('PASSED');
await b.close();
