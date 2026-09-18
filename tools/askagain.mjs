/* ==================================================== THE SECOND ATTEMPT
   A reader typed four letters. The letters matched several unrelated
   organisations, nothing could be attached to any one of them, and the page
   correctly said it could not tell which one they meant. Then it stopped.

   A result that ends there tells somebody they are on their own at the moment
   they asked for help, and the fix is one question: which one is it. This
   checks that the question is asked where it is the right question, that it is
   NOT asked where the page already knows who the party is, and that it refuses
   a second identifier as short as the first rather than spending a run on it. */
import { chromium } from 'playwright';

const base = d => ({
  verdict: 'GREY', headline: '', statement: 'A record was found.',
  idc: 30, cov: 40, asOf: '18 Sep 2026', reads: [], stats: [], bars: [], barFoot: '',
  claims: [], issues: [], gaps: [], unresolved: [],
  reviews: { checked: 3, carrying: 0, reports: 0, state: 'organic', note: '', rows: [] },
  ledger: [], retrieved: [], board: {}, live: false, ...d
});

/* Four letters, four strangers. Nothing names the party. */
const AMBIGUOUS = base({
  name: 'ACET (AMBIGUOUS IDENTIFIER)', domain: '',
  cats: {
    C7: { state: 'RED', sum: 'Reports across platforms', ev: [
      { t: 'C', src: 'Trustpilot', when: '18 Sep 2026', match: 'unconnected',
        about: 'an engineering firm of the same initials', find: 'Reviews describe a late delivery.' },
      { t: 'D', src: 'Reddit', when: '18 Sep 2026', match: 'unconnected',
        about: 'a college association of the same initials', find: 'Threads describe a dispute.' },
      { t: 'C', src: 'Sitejabber', when: '18 Sep 2026', match: 'unconnected',
        about: 'a shopfront of the same initials', find: 'Reviews describe a refund refused.' }]
    }
  }
});

/* The party is known and the record names them. There is nothing to ask. */
const RESOLVED = base({
  name: 'ATLANTIC GLOBAL WEALTH', domain: 'atlanticglobalwealth.com', verdict: 'RED',
  cats: {
    C2: { state: 'RED', sum: 'On a warning list', ev: [
      { t: 'A', src: 'FCA Warning List', when: '18 Sep 2026', match: 'exact',
        about: 'atlanticglobalwealth.com', find: 'The FCA lists this domain as an unauthorised firm.' }]
    }
  }
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);

const fails = [];
const show = async d => {
  await p.evaluate(x => { window.__KBYS__.runCtx({ stage: 'BEFORE' }); window.__KBYS__.enter(x, ''); }, d);
  await p.waitForTimeout(500);
  return p.evaluate(() => {
    const a = document.getElementById('rpAsk');
    const up = a && !a.hidden;
    const inp = document.getElementById('rpAskIn');
    const btn = document.getElementById('rpAskGo');
    const r = e => { const x = e.getBoundingClientRect(); return { w: x.width, h: x.height }; };
    return { up, x: up ? document.getElementById('rpAskX').textContent.replace(/\s+/g,' ').trim() : '',
             inp: up ? r(inp) : null, btn: up ? r(btn) : null };
  });
};

console.log('\nTHE SECOND ATTEMPT\n');

{
  const n = await show(AMBIGUOUS);
  if (!n.up) fails.push('the reader is told we could not tell which organisation, and asked nothing');
  else {
    if (!/full legal name/i.test(n.x)) fails.push('the question does not say a full legal name will do it');
    if (!/website/i.test(n.x) || !/email/i.test(n.x) || !/wallet/i.test(n.x))
      fails.push('the question does not offer all the identifiers the front door accepts');
    /* A control smaller than a fingertip is a control a stressed reader misses. */
    if (n.inp.h < 44) fails.push('the box is ' + Math.round(n.inp.h) + 'px tall, under the 44px floor');
    if (n.btn.h < 44) fails.push('the button is ' + Math.round(n.btn.h) + 'px tall, under the 44px floor');
  }
  console.log('  ' + (fails.length ? 'FAIL  ' : 'ok    ') + 'four letters, four strangers: the question is asked');
  if (n.up) console.log('        ' + n.x.slice(0, 150));
}

{
  const n = await show(RESOLVED);
  const bad = n.up;
  if (bad) fails.push('the page knows exactly who the party is and asks who they are anyway');
  console.log('  ' + (bad ? 'FAIL  ' : 'ok    ') + 'a named party: nothing is asked');
}

/* And the refusal. Five letters is the same failure as four. */
{
  await show(AMBIGUOUS);
  const note = await p.evaluate(() => new Promise(r => {
    document.getElementById('rpAskIn').value = 'ACETX';
    document.getElementById('rpAskGo').click();
    setTimeout(() => r(document.getElementById('rpAskNote').textContent.trim()), 400);
  }));
  const ok = /too short/i.test(note);
  if (!ok) fails.push('a second identifier as short as the first was accepted and spent a run: "' + note + '"');
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + 'a second short name is refused before it costs a run');

  const empty = await p.evaluate(() => new Promise(r => {
    document.getElementById('rpAskIn').value = '  ';
    document.getElementById('rpAskGo').click();
    setTimeout(() => r(document.getElementById('rpAskNote').textContent.trim()), 400);
  }));
  if (!empty) fails.push('an empty box submitted silently');
  console.log('  ' + (empty ? 'ok    ' : 'FAIL  ') + 'an empty box says what it wants');
}

if (errs.length) fails.push('page errors: ' + errs.join(' | '));

console.log('');
if (fails.length) {
  console.log('FAILED');
  fails.forEach(f => console.log('  ' + f));
  console.log('');
  await b.close();
  process.exit(1);
}
console.log('PASSED  an unresolved identifier gets a question, a resolved one does not\n');
await b.close();
