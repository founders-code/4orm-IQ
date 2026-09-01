/* THE REPORT IS FOUR SCREENS, WALKED THE WAY A READER WALKS IT.
   Forward on the green pills, back on the back buttons, and out to sources and
   method from every one of them. The bug this replaces: back from the findings
   screen landed on the findings screen, because one back button was routed
   through the logic that decides where the SOURCES screen goes back to. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);

const fail = m => { console.error('FAIL: ' + m); process.exit(1); };
const up = () => p.evaluate(() => [...document.querySelectorAll('#rpt .rp-sheet')]
  .filter(s => !s.hidden).map(s => s.id));
const stage = () => p.evaluate(() => document.body.getAttribute('data-stage'));
const one = async (want, where) => {
  const u = await up();
  if (u.length !== 1) fail(where + ': ' + u.length + ' report screens are showing at once (' + u.join(', ') + ')');
  if (u[0] !== want) fail(where + ': showing ' + u[0] + ', expected ' + want);
};

/* NOTHING INVISIBLE MAY BE CLICKABLE.
   The waiting overlay is fixed at inset:0 and sits over the whole landing when
   it is closed. A control inside it that keeps pointer events swallows every
   click meant for the page underneath, and the page looks broken rather than
   wrong. */
{
  const dead = await p.evaluate(() => {
    const box = document.getElementById('waitBox');
    if (box.classList.contains('on')) return ['the waiting overlay is open on the landing'];
    return [...box.querySelectorAll('button,a,input,summary')]
      .filter(e => getComputedStyle(e).pointerEvents !== 'none')
      .map(e => e.id || e.className || e.tagName);
  });
  if (dead.length) fail('these live inside the closed waiting overlay and will swallow clicks on the landing: ' + dead.join(', '));
}

/* Sources and method, from the landing, where there is no result behind it. */
await p.click('#navSources'); await p.waitForTimeout(400);
await one('rpSources', 'sources from the landing');
if ((await p.textContent('#rpBackToReportT')).trim() !== 'Back')
  fail('the way out of sources offers to go back to a report that does not exist yet');
await p.click('#rpBackToReport'); await p.waitForTimeout(400);
if (await stage() !== 'landing') fail('back from sources did not return to the landing');

await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(3000);
for (let i = 0; i < 6; i++) {
  if (!await p.evaluate(() => document.getElementById('waitBox').classList.contains('on'))) break;
  await p.click('#waitOk'); await p.waitForTimeout(500);
}
await p.waitForTimeout(1000);
await one('rpReport', 'a finished check');

/* Every screen carries both pills, and the reader can reach them from anywhere. */
const pillPair = async where => {
  const n = await p.evaluate(() => {
    const s = [...document.querySelectorAll('#rpt .rp-sheet')].find(x => !x.hidden);
    const t = [...s.querySelectorAll('.rp-nav .rp-pill')].map(e => e.textContent.trim());
    return t;
  });
  if (!n.some(t => /Sources and method/.test(t))) fail(where + ' has no sources and method pill');
  if (!n.some(t => /Find support/.test(t))) fail(where + ' has no find support pill');
};
await pillPair('the result screen');

/* Forward. */
await p.click('#rpToFound'); await p.waitForTimeout(500); await one('rpFound', 'the way on to what we found');
await pillPair('the findings screen');
await p.click('#rpToAct');   await p.waitForTimeout(500); await one('rpAct', 'the way on to what to do');
await pillPair('the act screen');

/* Back, one step at a time, to where the reader actually came from. */
await p.click('#rpActBack');   await p.waitForTimeout(500); await one('rpFound', 'back from what to do');
await p.click('#rpFoundBack'); await p.waitForTimeout(500); await one('rpReport', 'back from what we found');

/* Out to sources from the middle of the report, and back to where they were. */
await p.click('#rpToFound'); await p.waitForTimeout(400);
await p.click('#rpToSources_found'); await p.waitForTimeout(400);
await one('rpSources', 'sources from the findings screen');
if ((await p.textContent('#rpBackToReportT')).trim() !== 'Back to the report')
  fail('the way out of sources does not offer the report a reader is halfway through');
await p.click('#rpBackToReport'); await p.waitForTimeout(400);
await one('rpFound', 'back from sources');

/* The order on the result screen, read off the rendered page. */
await p.click('#rpFoundBack'); await p.waitForTimeout(400);
await one('rpReport', 'back to the result before reading its order');
const order = await p.evaluate(() => {
  const s = document.getElementById('rpReport');
  const y = sel => { const e = s.querySelector(sel); return e ? e.getBoundingClientRect().top + window.scrollY : null; };
  return { gap: y('.rp-gapnote'), already: y('#rpAlready'), onward: y('#rpToFound') };
});
if (order.gap === null || order.already === null || order.onward === null)
  fail('the result screen is missing the gap note, the already-sent door or the way on');
if (!(order.gap < order.already && order.already < order.onward))
  fail('the result screen reads in the wrong order: ' + JSON.stringify(order));

console.log('screens walked, both pills on every one, order held');
if (errs.length) fail('page errors ' + errs.slice(0,2).join(' | '));
console.log('PASSED');
await b.close();
