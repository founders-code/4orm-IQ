/* A RECORD ABOUT SOMEBODY ELSE, AND A NAME THAT MUST NOT REACH THE PAGE.
   Both defects were found on one live result for a provincial Crown
   corporation: a UK regulator warning about a domain sharing three letters with
   the party reached the reader as a warning about the party, and a director's
   name reached the report card, the findings and the packs. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);
const fail = async m => { console.error('FAIL: ' + m); await b.close(); process.exit(1); };

/* ---------------------------------------- a redaction never changes the subject */
{
  const d = { name: 'ATB Financial', cats: { C1: { state: 'RED', ev: [
    { t: 'A', src: 'Bloomberg profile', match: 'exact', about: 'atb.com',
      find: 'Ursula Holmsten is listed as an executive at ATB Wealth.', quote: '' }] } } };
  const cases = [
    ['Ursula Holmsten, trading as ATB Financial, is established in Alberta statute as a Crown corporation.',
     out => !/Crown corporation/.test(out), 'a sentence whose subject was redacted was published anyway'],
    ['The firm is real. Ursula Holmsten is listed as an executive at ATB Wealth. The domain is old.',
     out => !/Holmsten/.test(out) && /The firm is real/.test(out) && /The domain is old/.test(out),
     'the name survived, or the true sentences around it did not'],
    ['Records name Ursula Holmsten as the sole director of the entity.',
     out => !/Holmsten/.test(out) && /sole director/.test(out),
     'a mid-sentence redaction lost the sentence or kept the name'],
    ['ATB Financial is a Crown corporation wholly owned by the Province of Alberta.',
     out => out.indexOf('ATB Financial is a Crown corporation') === 0,
     'a sentence about the company was altered']
  ];
  for (const [txt, ok, why] of cases) {
    const out = await p.evaluate(([t, dd]) => window.__KBYS__.scrub(t, dd), [txt, d]);
    if (!ok(out)) await fail(why + '\n    in:  ' + txt + '\n    out: ' + out);
  }
  /* A redaction at the head of a sentence that says what somebody DID is kept,
     because dropping it would lose a true fact for no reason. */
  const did = await p.evaluate(([t, dd]) => window.__KBYS__.scrub(t, dd),
    ['Ursula Holmsten founded the firm in 2011.', d]);
  if (/Holmsten/.test(did)) await fail('the name survived: ' + did);
  if (!/founded the firm in 2011/.test(did))
    await fail('a sentence about what somebody did was dropped, and it did not need to be: ' + did);
  if (!/^[A-Z]/.test(did)) await fail('a redaction at the head of a sentence does not read like one: ' + did);
  /* One that says what the subject IS is withheld, and the withholding declared. */
  const said = await p.evaluate(([t, dd]) => window.__KBYS__.scrub(t, dd),
    ['Ursula Holmsten is a Crown corporation established by statute.', d]);
  if (!/named a person, so it is not printed/.test(said))
    await fail('a sentence that would have turned a company into a person was published: ' + said);
  console.log('redaction: the subject of a sentence is never changed, and a withheld one is declared');
}

/* ------------------------------------------ no name survives anywhere in a payload */
{
  const d = {
    name: 'ATB Financial', domain: 'atb.com', verdict: 'GREY',
    headline: 'Nothing against them', statement: 'Ursula Holmsten is listed as an executive.',
    cats: { C1: { state: 'YELLOW', sum: 'Ursula Holmsten is listed as an executive at ATB Wealth.',
      ev: [{ t: 'A', src: 'Bloomberg profile', match: 'exact', about: 'atb.com',
             find: 'Ursula Holmsten is listed as an executive at ATB Wealth.',
             plain: 'A person called Ursula Holmsten runs part of it.',
             quote: 'Ursula Holmsten, executive.', url: 'https://example.com/x' }] } },
    issues: [{ t: 'Ursula Holmsten is an executive', x: 'Ursula Holmsten is listed as an executive.', sev: 'high', tier: 'A' }],
    claims: [], gaps: [], unresolved: []
  };
  const out = await p.evaluate(dd => { window.__KBYS__.scrubPayload(dd); return JSON.stringify(dd); }, d);
  if (/Holmsten/.test(out.replace(/"url":"[^"]*"/g, '')))
    await fail('a name survived the payload scrub: ' + out.slice(0, 300));
  if (!/example\.com/.test(out)) await fail('the scrub damaged a url');
  console.log('payload scrub: no name survives in any field, and urls are untouched');
}

/* ------------------------ a record about somebody else never speaks for the party */
{
  const base = () => ({
    name: 'ATB Financial', domain: 'atb.com', verdict: 'RED',
    headline: 'A regulator has acted', statement: 'A regulator warning was found.',
    idc: 80, cov: 70, asOf: '25 Aug 2026', reads: [], stats: [], bars: [], barFoot: '',
    cats: { C2: { state: 'RED', sum: 'On a warning list', ev: [{
      t: 'A', src: 'FCA Warning List', when: '26 Aug 2026',
      about: 'atb.primerdroidscripts.pro', match: 'unconnected',
      find: 'The FCA listed the domain atb.primerdroidscripts.pro as an unauthorised firm.',
      plain: '', quote: '', url: 'https://example.com/fca' }] } },
    claims: [], issues: [], gaps: [], unresolved: [], reviews: { checked: 0, carrying: 0, reports: 0, state: 'absent', note: '', rows: [] },
    ledger: [], retrieved: [], board: {}, live: false
  });
  await p.evaluate(d => { window.__KBYS__.runCtx({ stage: 'BEFORE' }); window.__KBYS__.enter(d, ''); }, base());
  await p.waitForTimeout(800);
  const n = await p.evaluate(() => {
    const t = q => { const e = document.querySelector(q); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    return { eyebrow: t('#rpEyebrowT'), why: t('#rpWhy'), tonight: t('#rpTonightT'),
             say: t('#rpSay'), now: !document.getElementById('rpNow').hidden };
  });
  const loud = [n.eyebrow, n.why, n.tonight, n.say].join(' ');
  if (/has published a warning about this firm|has already flagged|has already published a finding/i.test(loud))
    await fail('a record about a different domain is being read as a warning about the party:\n    ' + loud);
  if (/do not send/i.test(n.tonight))
    await fail('the page says do not send on the strength of a record about somebody else: ' + n.tonight);

  /* And the reader is told the look-alike exists, in the sheet, as what it is. */
  await p.evaluate(() => document.getElementById('rpToFound').click());
  await p.waitForTimeout(600);
  const look = await p.evaluate(() => {
    const e = document.querySelector('#rpFoundBox .rp-look');
    return e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  });
  if (!look) await fail('the look-alike record is not shown to the reader at all');
  if (!/primerdroidscripts\.pro/.test(look))
    await fail('the look-alike block does not say which identifier the record names: ' + look);
  if (!/not a link|counts for nothing/i.test(look))
    await fail('the look-alike block does not say it counts for nothing: ' + look);
  await p.evaluate(() => document.getElementById('rpFoundBack').click());
  await p.waitForTimeout(400);
  console.log('look-alike: reported as a different party, and it never speaks for this one');
}

/* ------------------------------------- and an exact record still speaks normally */
{
  const d = {
    name: 'Atlantic Global Wealth', domain: 'atlanticglobalwealth.com', verdict: 'RED',
    headline: 'A regulator has acted', statement: 'A regulator warning names this firm.',
    idc: 90, cov: 80, asOf: '25 Aug 2026', reads: [], stats: [], bars: [], barFoot: '',
    cats: { C2: { state: 'RED', sum: 'On a warning list', ev: [{
      t: 'A', src: 'FCA Warning List', when: '26 Aug 2026',
      about: 'atlanticglobalwealth.com', match: 'exact',
      find: 'The FCA listed atlanticglobalwealth.com as an unauthorised firm.',
      plain: '', quote: '', url: 'https://example.com/fca' }] } },
    claims: [], issues: [], gaps: [], unresolved: [], reviews: { checked: 0, carrying: 0, reports: 0, state: 'absent', note: '', rows: [] },
    ledger: [], retrieved: [], board: {}, live: false
  };
  await p.evaluate(dd => { window.__KBYS__.runCtx({ stage: 'BEFORE' }); window.__KBYS__.enter(dd, ''); }, d);
  await p.waitForTimeout(800);
  const n = await p.evaluate(() => {
    const t = q => { const e = document.querySelector(q); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    return { why: t('#rpWhy'), tonight: t('#rpTonightT'),
             look: !!document.querySelector('#rpFoundBox .rp-look') };
  });
  if (!/flagged|regulator|official/i.test(n.why))
    await fail('a record that DOES name the party no longer speaks: ' + n.why);
  if (n.look) await fail('an exact record is being reported as a look-alike');
  console.log('exact record: still speaks, and is not filed as a look-alike');
}

if (errs.length) await fail('page errors: ' + errs.join(' | '));
console.log('OK');
await b.close();
