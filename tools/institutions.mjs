/* ============================================================ THE BYSTANDER TEST
   Every other check on this product asks whether we catch the bad ones. This
   one asks the question that actually ends a company: do we accuse a real one.

   It was written because we did. A live result for Alberta Treasury Branches,
   a Crown corporation of 88 years wholly owned by a province and with the
   province standing behind every deposit, carried the line "the UK Financial
   Conduct Authority has published a warning about this firm" and told the
   reader not to send anything tonight. The FCA had published nothing about
   them. It had listed a domain that shared three letters with theirs inside
   somebody else's subdomain.

   So: a set of real, large, ordinary institutions, each put through the page as
   a payload of the shape a live run produces, and the build fails if any of
   them comes back adverse on anything less than a record that names them.

   These are not demo specimens and nothing here asserts anything about any of
   them. Each payload is a SHAPE: the clean record a real institution produces,
   plus the near-miss that a sweep of a common name throws up. What is being
   tested is our arithmetic, not their conduct.                              */
import { chromium } from 'playwright';

const CASES = [
  {
    who: 'a provincial crown bank with a look-alike domain on a warning list',
    d: {
      name: 'ALBERTA TREASURY BRANCHES', domain: 'atb.com',
      scale: { basis: 'annual report', customers: 800000, assets_usd: 46000000000,
               since: 1938, guarantee: 'Government of Alberta', band: 'major' },
      cats: {
        C1: { state: 'GREEN', sum: 'Established by statute',
              ev: [{ t: 'A', src: 'ATB Financial Act', when: '25 Aug 2026', match: 'exact',
                     about: 'Alberta Treasury Branches', find: 'Constituted by provincial statute.' }] },
        C2: { state: 'RED', sum: 'On a warning list',
              ev: [{ t: 'A', src: 'FCA Warning List', when: '25 Aug 2026', match: 'unconnected',
                     about: 'atb.primerdroidscripts.pro',
                     find: 'A warning list entry names a domain sharing three letters with this one.' }] }
      }
    }
  },
  {
    who: 'a large retail bank with ordinary consumer complaints',
    d: {
      name: 'A LARGE RETAIL BANK', domain: 'example-bank.com',
      scale: { basis: 'annual report', customers: 4000000, assets_usd: 300000000000,
               since: 1867, guarantee: 'CDIC', band: 'major' },
      cats: {
        C1: { state: 'GREEN', sum: 'Registered',
              ev: [{ t: 'A', src: 'Companies register', when: '25 Aug 2026', match: 'exact',
                     about: 'example-bank.com', find: 'Registered and active.' }] },
        C7: { state: 'RED', sum: 'Negative reports across platforms',
              ev: [
                { t: 'C', src: 'Trustpilot', when: '25 Aug 2026', match: 'exact',
                  about: 'example-bank.com', find: 'One-star reviews describe refused claims.' },
                { t: 'D', src: 'Reddit', when: '25 Aug 2026', match: 'exact',
                  about: 'example-bank.com', find: 'Threads describe long hold times.' },
                { t: 'C', src: 'Google reviews', when: '25 Aug 2026', match: 'exact',
                  about: 'example-bank.com', find: 'Branch reviews describe poor service.' }]
        }
      }
    }
  },
  {
    who: 'a long-established insurer sharing a word with an unrelated entity',
    d: {
      name: 'AN ESTABLISHED INSURER', domain: 'example-insure.com',
      scale: { basis: 'regulatory filing', customers: 1200000, assets_usd: 80000000000,
               since: 1891, guarantee: null, band: 'major' },
      cats: {
        C2: { state: 'RED', sum: 'Name appears on an alert',
              ev: [{ t: 'A', src: 'Securities regulator alert list', when: '25 Aug 2026',
                     match: 'unconnected', about: 'Example Insure Capital Partners LLC',
                     find: 'An alert names a differently constituted entity sharing one word.' }] }
      }
    }
  }
];

/* And the control: a record that DOES name the party must still carry. A check
   that never accuses anybody is not a safe check, it is a broken one. */
const CONTROL = {
  who: 'a firm a regulator has actually named',
  d: {
    name: 'ATLANTIC GLOBAL WEALTH', domain: 'atlanticglobalwealth.com',
    scale: { basis: '', customers: null, assets_usd: null, since: 2026, guarantee: null, band: 'new' },
    cats: {
      C2: { state: 'RED', sum: 'On a warning list',
            ev: [{ t: 'A', src: 'FCA Warning List', when: '25 Aug 2026', match: 'exact',
                   about: 'atlanticglobalwealth.com',
                   find: 'The FCA lists this domain as an unauthorised firm.' }] }
    }
  }
};

const base = d => ({
  verdict: 'RED', headline: 'High risk', statement: 'A record was found.',
  idc: 85, cov: 70, asOf: '25 Aug 2026', reads: [], stats: [], bars: [], barFoot: '',
  claims: [], issues: [], gaps: [], unresolved: [],
  reviews: { checked: 3, carrying: 1, reports: 12, state: 'organic', note: '', rows: [] },
  ledger: [], retrieved: [], board: {}, live: false, ...d
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);

const fails = [];
const read = async d => {
  await p.evaluate(x => { window.__KBYS__.runCtx({ stage: 'BEFORE' }); window.__KBYS__.enter(x, ''); }, d);
  await p.waitForTimeout(600);
  return p.evaluate(() => {
    const t = q => { const e = document.querySelector(q); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    const d = window.__KBYS__.lastReport() || {};
    return { verdict: d.verdict, eyebrow: t('#rpEyebrowT'), why: t('#rpWhy'),
             tonight: t('#rpTonightT'), say: t('#rpSay'),
             now: !document.getElementById('rpNow').hidden,
             nowH: t('#rpNowH') };
  });
};

console.log('\nTHE BYSTANDER TEST\n');
for (const c of CASES) {
  const n = await read(base(c.d));
  const loud = [n.eyebrow, n.why, n.tonight, n.say, n.nowH].join(' ');
  const bad = [];
  if (n.verdict === 'RED') bad.push('the verdict is RED');
  if (/do not send|send nothing/i.test(loud)) bad.push('the page says do not send');
  if (/published a warning about this firm|already flagged|says do not send money/i.test(loud))
    bad.push('the page says an authority acted against them');
  if (n.now && /send nothing|ring your bank/i.test(n.nowH)) bad.push('the page hands them an emergency');
  console.log('  ' + (bad.length ? 'FAIL  ' : 'ok    ') + c.who + '   -> ' + n.verdict);
  if (bad.length) {
    fails.push(c.who + ': ' + bad.join(', '));
    console.log('        ' + loud.slice(0, 200));
  }
}

{
  const n = await read(base(CONTROL.d));
  const loud = [n.eyebrow, n.why, n.tonight, n.say].join(' ');
  const ok = n.verdict === 'RED' && /flagged|warning|regulator|do not send/i.test(loud);
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + CONTROL.who + '   -> ' + n.verdict);
  if (!ok) fails.push('the control was not carried: a record that names the party stopped speaking');
}

if (errs.length) fails.push('page errors: ' + errs.join(' | '));

console.log('');
if (fails.length) {
  console.log('FAILED');
  fails.forEach(f => console.log('  ' + f));
  console.log('\nA real institution is being told its customers should not send it money.\n'
    + 'Nothing about this is a tuning problem. Find the record it rested on and\n'
    + 'ask whether that record names them.\n');
  await b.close();
  process.exit(1);
}
console.log('PASSED  no real institution is accused on a record that does not name it\n');
await b.close();
