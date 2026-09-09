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
/* Held in a function because the checks below reload the page, and a reload
   takes these two with it. Anything that reloads calls this again. */
const seedData = () => p.evaluate(() => {
  const allok = JSON.parse(JSON.stringify(CLEAR));
  Object.keys(allok.documents || {}).forEach(k => allok.documents[k] = 'ok');
  if (allok.registry && allok.registry.docs) allok.registry.docs.forEach(r => r.state = 'ok');
  const onebad = JSON.parse(JSON.stringify(allok));
  onebad.documents.mg = 'bad';
  if (onebad.registry && onebad.registry.docs)
    onebad.registry.docs.forEach(r => { if (r.key === 'mg') r.state = 'bad'; });
  window.__ALLOK = allok; window.__ONEBAD = onebad;
});
await seedData();

console.log('\nTHE PILLS');
say('two pills, each with its own count',
  await p.evaluate(() => !!document.querySelector('#newbtn b') && !!document.querySelector('#fixbtn b')));
/* They read the operations summary, so they sit on it. Measured under the
   pointer, not in the stylesheet: the board is a fixed 1920 scaled to fit and
   a 26px control lands as 19. */
say('the switch is on the operations summary panel, not in the masthead',
  await p.evaluate(() => { const rd = document.getElementById('reader');
    return rd.contains(document.getElementById('newbtn'))
        && rd.contains(document.getElementById('fixbtn'))
        && !document.querySelector('.mctl #newbtn') && !document.querySelector('.mctl #fixbtn'); }));
{
  const h = await p.evaluate(() => ['newbtn', 'fixbtn'].map(i =>
    Math.round(document.getElementById(i).getBoundingClientRect().height)));
  say('and both are still 24px under the pointer once the board is scaled',
    h.every(x => x >= 24), h.join(' / ') + 'px');
}
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
/* The tab carries the same words as the pill, so it does the same thing: it
   takes on whatever is still waiting and then shows the whole list. Taking on
   one row at a time still works from the row itself. */
{
  const onTab = await st();
  say('the fix list tab shows the list, having swept up whatever was still waiting',
    onTab.rows === before && onTab.nw === 0 && onTab.fx === before,
    onTab.rows + ' rows, new ' + onTab.nw + ', fix ' + onTab.fx);
}
await p.click('#fxBody [data-fx]'); await p.waitForTimeout(200);
const cleared = await st();
/* The tab swept the whole pile on, so clearing one row leaves the rest held. */
say('clearing takes that row off the panel', cleared.fx === before - 1,
  'fix ' + cleared.fx + ' of ' + before);

console.log('\nPRESSING FIX LIST TAKES EVERYTHING ON');
/* One gesture: the pile nobody has looked at moves to the pile somebody has,
   and the summary comes off alarm. It is acknowledgement, not clearance, and
   the difference has to be visible in the words as well as the colour. */
{
  await p.evaluate(() => { localStorage.removeItem('4ormiq.ops.v1'); });
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1100);
  await seedData();
  await p.evaluate(() => paint(normalise(TROUBLE))); await p.waitForTimeout(300);
  const before = await st();
  await p.click('#fixbtn'); await p.waitForTimeout(400);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({
    nw: Number(document.querySelector('#newbtn b').textContent),
    fx: Number(document.querySelector('#fixbtn b').textContent),
    ack: document.getElementById('reader').getAttribute('data-ack'),
    boardS: document.getElementById('reader').getAttribute('data-s'),
    line: document.getElementById('rdline').textContent.trim(),
    body: document.getElementById('rdbody').innerText.replace(/\s+/g, ' '),
    lampAnim: getComputedStyle(document.querySelector('.rdhd i')).animationName,
    lampBg: getComputedStyle(document.querySelector('.rdhd i')).backgroundColor,
    lineBg: getComputedStyle(document.getElementById('rdline')).color
  }));
  say('everything waiting moves to the fix list in one press',
    after.nw === 0 && after.fx === before.nw, before.nw + ' new -> ' + after.fx + ' on the list');
  /* It used to read "All is good to go", which claimed more than the board can
     support while two controls are down. It now says what is running and how
     many are held, which is the thing the reader is being asked to act on. */
  say('and the summary says what is running, and carries the count',
    /^Running\./.test(after.line) && new RegExp('\\b' + after.fx + '\\b').test(after.line),
    after.line);
  say('and it never claims the machine is well', !/^All is good to go/.test(after.line), after.line);
  say('in green, and off alarm',
    after.ack === 'yes' && after.lampBg === 'rgb(51, 216, 155)' && after.lampAnim === 'none'
    && after.lineBg === 'rgb(51, 216, 155)', after.lampBg + ' / ' + after.lampAnim);
  /* THE ONE THING GREEN IS NEVER ALLOWED TO DO HERE.
     It says nothing is unattended. It never says the machine is well, and the
     screen has to keep naming what is wrong while it is green, or a person
     reading it would take the colour for an all clear. */
  say('while still saying how many faults are on the list',
    /faults are on the fix list/.test(after.body), after.body.slice(0, 62));
  say('and still naming them one by one',
    (after.body.match(/is still down/g) || []).length >= 1);
  say('and the board itself has not moved', after.boardS === 'bad', after.boardS);
  /* A NEW FAULT BREAKS THE GREEN. That is the whole value of the state: it
     lets tomorrow's fault be told apart from the one you already know. */
  await p.evaluate(() => { for (const k in OPS.fix) { delete OPS.fix[k]; break; } opsPills(); });
  await p.waitForTimeout(250);
  const broken = await p.evaluate(() => ({
    ack: document.getElementById('reader').getAttribute('data-ack'),
    line: document.getElementById('rdline').textContent.trim() }));
  say('and one new fault puts it back on alarm',
    broken.ack === 'no' && broken.line !== 'All is good to go.', broken.line);
  await p.evaluate(() => { localStorage.removeItem('4ormiq.ops.v1'); });
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1100);
  await seedData();
  await p.click('#newbtn'); await p.waitForTimeout(300);
  await p.click('#fxBody [data-fx]'); await p.waitForTimeout(200);
  await p.click('#fxTabFix'); await p.waitForTimeout(200);
  await p.click('#fxBody [data-fx]'); await p.waitForTimeout(200);
}

/* The Fix list tab now drains the New pile, the same as the Fix list pill,
   because both carry the same words. That can leave a tab with nothing on it,
   and Clear is disabled on an empty tab, so a walk through both piles presses
   Clear only where there is something to clear. */
const clearTab = async tab => {
  await p.click(tab); await p.waitForTimeout(200);
  const on = await p.evaluate(() => {
    const b = document.getElementById('fxClear');
    return !!b && !b.disabled && b.offsetParent !== null;
  });
  if (on) { await p.click('#fxClear'); await p.waitForTimeout(200); }
  return on;
};

console.log('\nAND CLEARING CHANGES NOTHING ELSE');
say('the board is still red', cleared.board === 'bad');
/* THE LAMP MAY GO OFF ALARM. IT MAY NOT GO ALL CLEAR.
   With rows still held, nothing is unattended, so the lamp is entitled to
   leave alarm. What it may never do while the board is red is show the all
   clear, because that lamp answers for the machine and the machine has not
   moved. */
say('the operations summary lamp does not show all clear while the board is red',
  cleared.anim !== 'allclear' && cleared.clear === 'no', cleared.anim + ' / clear=' + cleared.clear);
await clearTab('#fxTabNew');
await clearTab('#fxTabFix');
await p.waitForTimeout(150);
const emptied = await st();
say('with every row cleared the panel reads empty', emptied.nw === 0 && emptied.fx === 0);
/* THE LINE SOMEBODY OPENS AN EMPTY LIST TO READ.
   And the sentence that stops it standing alone. An empty list says all is
   good to go about ITSELF; while the board is still red it has to say which
   of the two it is talking about, or the panel is answering for the machine. */
{
  const t = await p.evaluate(() =>
    (document.querySelector('#fxBody .fxempty') || { innerText: '' }).innerText.replace(/\s+/g, ' ').trim());
  say('an empty list says all is good to go', /^All is good to go\./.test(t), t.slice(0, 46));
  say('and while the board is red it says that is the panel, not the machine',
    /this panel, not the machine/i.test(t) && /board is still red/i.test(t));
}
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
await clearTab('#fxTabNew');
await clearTab('#fxTabFix');
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
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

/* BOTH CONTROLS THAT SAY FIX LIST HAVE TO MEAN IT.
   The pill took the waiting rows on. The tab inside the panel, carrying the
   same words, only changed which pile was on screen, so anyone who opened on
   New and pressed Fix list got an empty list and a board still saying two
   things needed them. The board was right and the control was lying. */
await p.evaluate(() => { localStorage.removeItem('4ormiq.ops.v1'); });
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1100);
const preTab = await st();
await p.click('#newbtn'); await p.waitForTimeout(300);
await p.click('#fxTabFix'); await p.waitForTimeout(400);
const afterTab = await st();
say('the fix list tab takes the waiting rows on, like the pill does',
  preTab.nw > 0 && afterTab.nw === 0 && afterTab.fx === preTab.nw,
  'new ' + preTab.nw + ' -> ' + afterTab.nw + ', fix ' + afterTab.fx);

/* AND THE BOARD SAYS SO, WITH THE COUNT WHERE THE READER IS BEING ASKED TO
   ACT. Green here is about the list, never about the machine, so the line may
   report what is running and how many are held, and may not claim they are
   gone: every fault is still named underneath it. */
{
  const line = (await p.evaluate(() => document.getElementById('rdline').textContent)).trim();
  const body = await p.evaluate(() => document.getElementById('rdbody').textContent);
  if (/needs? you/.test(line))
    fails.push('the board still says something needs you after everything was taken on: ' + line);
  if (!new RegExp('\\b' + afterTab.fx + '\\b').test(line))
    fails.push('the acknowledged line does not carry the count: ' + line);
  if (/all (is|clear)|nothing is wrong|no faults/i.test(line))
    fails.push('the acknowledged line claims the machine is well, not just attended: ' + line);
  if (!/still down|fix list/i.test(body))
    fails.push('the acknowledged board stopped naming the faults it is holding');
  say('the acknowledged line reports running, carries the count, and still names the faults',
    !/needs? you/.test(line), line);
}

say('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

await b.close();
if (fails.length) { console.log('\nFAILED\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\nPASSED');
