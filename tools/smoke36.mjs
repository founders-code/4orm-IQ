/* WHICH ACT SCREEN, AND WHAT THE SECTOR IS NOT ALLOWED TO MOVE.
   The act screen is one skeleton with sector content. Two properties matter
   more than any of the words on it:

     1. the sector changes the instructions and never a finding, and
     2. the sentence that says an institution is real rests on a signed
        register, so it stays dark until SR-001 carries one.

   Both are asserted by driving the router directly against a known report and
   comparing the findings before and after, because a screenshot cannot tell
   you that a verdict survived a re-lay. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(3000);
for (let i = 0; i < 6; i++) {
  if (!await p.evaluate(() => document.getElementById('waitBox').classList.contains('on'))) break;
  await p.click('#waitOk'); await p.waitForTimeout(500);
}
await p.click('#rpToFound'); await p.waitForTimeout(500);
await p.click('#rpToAct');   await p.waitForTimeout(500);

/* The fingerprint of everything the sector is forbidden to touch. */
const shape = () => p.evaluate(() => ({
  finds:   [...document.querySelectorAll('#rpFinds .rp-t')].map(e => e.textContent.trim()),
  headline: (document.getElementById('rpHeadline') || {}).textContent || '',
  say:     (document.getElementById('rpSay') || {}).textContent || '',
  verdict: (window.__KBYS__.lastReport() || {}).verdict || ''
}));
const vis = id => p.evaluate(x => {
  const e = document.getElementById(x);
  return !!(e && !e.hidden && e.checkVisibility &&
            e.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true }));
}, id);

/* ---- 1. unplaced falls to the general screen, and asks nothing ---- */
await p.evaluate(() => { window.__KBYS__.runCtx({}); window.__KBYS__.applySector(); });
await p.waitForTimeout(200);
if (await p.evaluate(() => window.__KBYS__.sectorPick()) !== 'general')
  fail('a reader the thread could not place did not land on the general screen');
if (await vis('rpVerify')) fail('the verify panel is showing on a report with no impersonation record');
/* The sector is asked once, in the thread. Asking it again here is the page
   failing to remember an answer the reader already gave. */
{
  const asks = await p.evaluate(() => document.querySelectorAll('#rpAct .rp-saskb, #rpSectorAsk').length);
  if (asks) fail('the act screen asks for the sector again, ' + asks + ' controls');
}

const before = await shape();

/* ---- 2. the sector chosen in the thread lays the screen, and moves no finding ---- */
await p.evaluate(() => { window.__KBYS__.runCtx({ sector: 'INVESTMENT' }); window.__KBYS__.applySector(); });
await p.waitForTimeout(250);
if (await p.evaluate(() => window.__KBYS__.sectorPick()) !== 'investing')
  fail('the sector answered in the thread did not route to the investing screen');
{
  const after = await shape();
  if (JSON.stringify(after) !== JSON.stringify(before))
    fail('the sector changed the result:\n  before ' +
         JSON.stringify(before) + '\n  after  ' + JSON.stringify(after));
}

/* ---- 3. a tier A clone record routes to the impersonation screen ---- */
const title0 = (await p.textContent('#rpActTitle')).trim();
await p.evaluate(() => {
  const d = window.__KBYS__.lastReport();
  d.issues = d.issues || [];
  d.issues.push({ t: 'A regulator warned about a firm using this name', tier: 'A', kind: 'CLONE',
                  sev: 'high', x: 'Injected by smoke36 only.' });
  window.__KBYS__.applySector(d);
});
await p.waitForTimeout(300);
if (await p.evaluate(() => window.__KBYS__.sectorPick()) !== 'impersonation')
  fail('a tier A clone record did not route to the impersonation screen');
if (!await vis('rpVerify')) fail('the impersonation screen did not show the verify panel');
{
  const n = await p.evaluate(() => document.querySelectorAll('#rpVerifyL li').length);
  if (n !== 3) fail('the verify panel has ' + n + ' steps, expected 3');
  const t1 = (await p.textContent('#rpActTitle')).trim();
  if (t1 === title0) fail('the impersonation screen kept the general title: ' + t1);
  /* The first step is the one that settles it, so it has to be the first one. */
  const s1 = (await p.textContent('#rpVerifyL li:first-child')).toLowerCase();
  if (!/call(ed)? back|call back/.test(s1) || !/number you found yourself/.test(s1))
    fail('the first verify step is not call back on a number you found yourself, it is: ' + s1);
  /* The door on this screen may not send somebody to a number they were given. */
  const clock = (await p.textContent('#rpClockX')).toLowerCase();
  if (!/not any number you were given|number on the back of your card/.test(clock))
    fail('the impersonation clock does not tell the reader which number to ring');
}

/* ---- 4. the affirmative bank line is gated, and dark today ---- */
{
  const confirmed = await p.evaluate(() => window.__KBYS__.depositConfirmed(window.__KBYS__.lastReport()));
  if (confirmed !== false)
    fail('a deposit taking register confirmed a bank, but none is ENABLED on SR-001');
  const lead = (await p.textContent('#rpActLead')).trim();
  if (/institution itself is real|on the deposit taking register/.test(lead))
    fail('the act screen asserts the institution is real with no register behind it: ' + lead);
}

/* ---- 5. and none of that moved a finding either ---- */
{
  const after = await shape();
  if (JSON.stringify(after.finds) !== JSON.stringify(before.finds) ||
      after.verdict !== before.verdict || after.say !== before.say)
    fail('routing to the impersonation screen changed the result:\n  before ' +
         JSON.stringify(before) + '\n  after  ' + JSON.stringify(after));
}

if (errs.length) fail('page errors: ' + errs.join(' | '));
console.log('sector routing: general -> investing -> impersonation, verify panel 3 steps, bank line gated dark, findings unmoved');
await b.close();
