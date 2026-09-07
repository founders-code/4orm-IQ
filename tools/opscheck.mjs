/* ===================================================== THE OPERATIONS PANEL
   The board says what is true. The panel says what a person has done about
   it. These are two different facts and the whole value of the panel is that
   it can never answer for the board.

   Every check here was proved by breaking it first: take the veto out of
   opsPills and check 5 fails; drop the state out of the cleared key and
   check 6 fails; let amber raise a row and check 2 fails.
   ====================================================================== */
import { chromium } from 'playwright';

const fails = [];
const say = (label, ok, detail) => {
  console.log('  ' + (ok ? 'ok   ' : 'FAIL ') + label + (detail === undefined ? '' : '  |  ' + detail));
  if (!ok) fails.push(label);
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await p.goto('file://' + process.cwd() + '/admin.html?demo=1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1100);

const st = () => p.evaluate(() => ({
  nw:    Number((document.getElementById('newbtn').querySelector('b') || {}).textContent || -1),
  fx:    Number((document.getElementById('fixbtn').querySelector('b') || {}).textContent || -1),
  clear: document.getElementById('reader').getAttribute('data-clear'),
  board: document.getElementById('reader').getAttribute('data-s'),
  anim:  getComputedStyle(document.querySelector('.rdhd i')).animationName,
  open:  document.getElementById('fixlist').classList.contains('on'),
  rows:  document.querySelectorAll('#fxBody .fxrow').length
}));

/* Two datasets built here rather than taken from the file, because the board's
   own CLEAR sample still carries two documents that record a NO-GO on their
   own covers. Those are real and they are supposed to be red, which means the
   all-clear lamp cannot be exercised against it. */
await p.evaluate(() => {
  const allok = JSON.parse(JSON.stringify(CLEAR));
  Object.keys(allok.documents || {}).forEach(k => allok.documents[k] = 'ok');
  if (allok.registry && allok.registry.docs) allok.registry.docs.forEach(r => r.state = 'ok');
  const onebad = JSON.parse(JSON.stringify(allok));
  onebad.documents.mg = 'bad';
  if (onebad.registry && onebad.registry.docs)
    onebad.registry.docs.forEach(r => { if (r.key === 'mg') r.state = 'bad'; });
  window.__ALLOK = allok; window.__ONEBAD = onebad;
});

console.log('\nTHE PILLS');
say('two pills, each with its own count',
  await p.evaluate(() => !!document.querySelector('#newbtn b') && !!document.querySelector('#fixbtn b')));
say('and each carries a name a screen reader can use',
  await p.evaluate(() => (document.getElementById('newbtn').getAttribute('aria-label') || '').length > 12
                      && (document.getElementById('fixbtn').getAttribute('aria-label') || '').length > 12));
say('the panel is inert while it is shut, so it is not a row of phantom tab stops',
  await p.evaluate(() => document.getElementById('fixlist').hasAttribute('inert')
                      && document.getElementById('fixlist').getAttribute('aria-hidden') === 'true'));

console.log('\nAMBER IS NOT A FAULT');
await p.evaluate(() => paint(normalise(TROUBLE)));
await p.waitForTimeout(250);
const amber = await p.evaluate(() => {
  let bad = 0, warn = 0;
  for (const k in BOARD_ROWS) { if (BOARD_ROWS[k].s === 'bad') bad++; if (BOARD_ROWS[k].s === 'warn') warn++; }
  return { bad, warn, raised: opsSplit().nw.length + opsSplit().fx.length };
});
say('every red row is raised and no amber one is',
  amber.raised === amber.bad && amber.warn > 0,
  amber.bad + ' red, ' + amber.warn + ' amber, ' + amber.raised + ' raised');

console.log('\nTHE THREE MOVES');
await p.click('#newbtn'); await p.waitForTimeout(250);
const opened = await st();
say('a pill opens the panel on the data screen', opened.open && opened.rows > 0, opened.rows + ' rows');
const before = opened.nw;
await p.click('#fxBody [data-fx]'); await p.waitForTimeout(200);
const took = await st();
say('taking one on moves it from new to the fix list',
  took.nw === before - 1 && took.fx === 1, 'new ' + before + ' -> ' + took.nw + ', fix ' + took.fx);
await p.click('#fxTabFix'); await p.waitForTimeout(200);
say('the fix list tab shows what was taken on', (await st()).rows === 1);
await p.click('#fxBody [data-fx]'); await p.waitForTimeout(200);
const cleared = await st();
say('clearing takes it off the panel', cleared.fx === 0);

console.log('\nAND CLEARING CHANGES NOTHING ELSE');
say('the board is still red', cleared.board === 'bad');
say('the operations summary lamp is still on alarm', cleared.anim === 'alarm', cleared.anim);
await p.click('#fxTabNew'); await p.click('#fxClear'); await p.waitForTimeout(150);
await p.click('#fxTabFix'); await p.click('#fxClear'); await p.waitForTimeout(250);
const emptied = await st();
say('with every row cleared the panel reads empty', emptied.nw === 0 && emptied.fx === 0);
say('and the lamp STILL does not go green, because the board has not changed',
  emptied.clear === 'no' && emptied.anim === 'alarm', emptied.anim);
await p.keyboard.press('Escape'); await p.waitForTimeout(250);
say('escape closes the panel', !(await st()).open);

console.log('\nALL CLEAR, AND WHAT IT TAKES');
await p.evaluate(() => paint(normalise(window.__ALLOK)));
await p.waitForTimeout(250);
const green = await st();
say('nothing red and nothing on the panel flashes the lamp green',
  green.clear === 'yes' && green.anim === 'allclear', green.anim);
say('and both pills go dark',
  await p.evaluate(() => document.getElementById('newbtn').getAttribute('data-n') === 'none'
                      && document.getElementById('fixbtn').getAttribute('data-n') === 'none'));

console.log('\nA CLEARED ROW IS NOT CLEARED FOREVER');
await p.evaluate(() => paint(normalise(window.__ONEBAD)));
await p.waitForTimeout(250);
say('a row going red raises it as new', (await st()).nw === 1);
await p.click('#newbtn'); await p.waitForTimeout(200);
await p.click('#fxClear'); await p.click('#fxTabFix'); await p.click('#fxClear');
await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
say('clearing it empties the panel', (await st()).nw === 0);
await p.evaluate(() => paint(normalise(window.__ALLOK)));
await p.waitForTimeout(250);
say('fixing it lights the lamp', (await st()).clear === 'yes');
/* THIS is what makes a cleared row come back, so it is checked directly
   rather than only through its effect: the moment the board carries that row
   as no longer red, the record of it having been cleared is dropped. */
say('and the record of clearing it is dropped the moment the board says it is fixed',
  await p.evaluate(() => Object.keys(OPS.done).length === 0
                      && Object.keys(JSON.parse(localStorage.getItem('4ormiq.ops.v1')).done).length === 0));
await p.evaluate(() => paint(normalise(window.__ONEBAD)));
await p.waitForTimeout(250);
say('so the SAME row going red again comes back as new, rather than staying quiet',
  (await st()).nw === 1);

console.log('\nIT SURVIVES A RELOAD');
/* On the sample payload, which is what the page paints on its own, so the
   board before and after the reload is the same board. */
await p.evaluate(() => { localStorage.removeItem('4ormiq.ops.v1'); });
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1100);
await p.click('#newbtn'); await p.waitForTimeout(250);
await p.click('#fxBody [data-fx]'); await p.waitForTimeout(200);
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
const held = (await st()).fx;
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1100);
say('what was taken on is still on the fix list after a reload',
  held === 1 && (await st()).fx === held, 'held ' + held);

/* AND A BOARD THAT CAME BACK EMPTY MUST NOT EMPTY THE LIST.
   Absent is not fixed. This is the failure mode that would quietly lose an
   operator's working list on a bad fetch. */
await p.evaluate(() => { BOARD_ROWS = {}; opsPills(); });
await p.waitForTimeout(200);
say('an empty board does not clear the fix list',
  await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('4ormiq.ops.v1')).fix).length === 1));

say('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

await b.close();
if (fails.length) { console.log('\nFAILED\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\nPASSED');
