/* THE PRIMER, WHICH EVERY OTHER TEST CLICKS THROUGH.
   It is the first thing a reader sees after pressing check, it says how long
   the check takes, and its button is the acknowledgement of the one sentence
   that has to be read before a verdict about a named company appears. Because
   the rest of the suite dismisses it to get at the screens behind it, this is
   the only place its behaviour is actually asserted. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

/* Nothing on it before a check runs, and nothing of it clickable. */
{
  const up = await p.evaluate(() => document.getElementById('primBox').classList.contains('on'));
  if (up) fail('the primer is up before anybody has run a check');
  const reach = await p.evaluate(() => {
    const k = document.getElementById('primOk'); const r = k.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === k;
  });
  if (reach) fail('the primer is closed and its button is still clickable');
}

await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(700);

const read = await p.evaluate(() => {
  const box = document.getElementById('primBox');
  const t = id => (document.getElementById(id) || { textContent: '' }).textContent.trim();
  return {
    up: box.classList.contains('on'),
    title: t('primT'),
    fine: t('primFine'),
    steps: [...box.querySelectorAll('.primsteps li')].map(e => e.textContent.trim()),
    btn: t('primOk'),
    focused: document.activeElement && document.activeElement.id,
    running: !!document.getElementById('waitBox').classList.contains('on')
  };
});

if (!read.up) fail('the primer does not open when a check starts');
if (!/two to three minutes/i.test(read.title))
  fail('the primer does not say how long a check takes: ' + read.title);
if (read.steps.length < 3) fail('the primer explains the check in ' + read.steps.length + ' steps');
if (!/research tool, not advice/i.test(read.fine))
  fail('the primer does not carry the disclaimer, so it cannot be the acknowledgement');
if (read.btn !== 'I understand') fail('the primer button reads: ' + read.btn);
if (read.focused !== 'primOk') fail('focus is on ' + read.focused + ', not on the way forward');
/* THE SWEEP IS ALREADY RUNNING UNDERNEATH IT.
   A primer that holds the check up spends the reader's two minutes on a card
   they did not ask to read. */
if (!read.running) fail('the check waits for the primer instead of running behind it');

/* Nothing on the waiting screen may be reachable while the primer is up. */
{
  const reach = await p.evaluate(() => {
    const k = document.getElementById('waitOk'); const r = k.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(hit && (hit === k || k.contains(hit)));
  });
  if (reach) fail('the gate under the primer can be pressed through it');
}

await p.evaluate(() => document.getElementById('primOk').click());
await p.waitForTimeout(600);

const after = await p.evaluate(() => ({
  up: document.getElementById('primBox').classList.contains('on'),
  gate: (document.getElementById('waitOk') || {}).textContent,
  gateOff: !!(document.getElementById('waitOk') || {}).disabled,
  phase: (document.getElementById('waitPhase') || { textContent: '' }).textContent
}));
if (after.up) fail('the primer stays up after it has been acknowledged');
/* Acknowledged once. The reader is not asked to agree to the same sentence at
   the other end of the wait. */
if (!after.gateOff) fail('the gate still asks for an acknowledgement that has already been given');
if (!/Understood/i.test(after.gate)) fail('the gate reads: ' + after.gate);

if (errs.length) { console.error(errs.join('\n')); fail(errs.length + ' page errors'); }
console.log('primer: two to three minutes, ' + read.steps.length
  + ' steps, disclaimer carried, acknowledged once, sweep running underneath');
console.log('\nPASSED');
await b.close();
