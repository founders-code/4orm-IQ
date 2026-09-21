/* ==================== THE DOOR CARRIES NO VERDICT, AND THE IMPERATIVE IS TRUE
   Two rules, both about the same thing: a page somebody reads in a panic must
   not say more than it knows.

   The door to the records is neutral, because a colour on it is a verdict
   about what is behind it before anybody has opened it.

   The imperative beside the verdict says "if you've sent money" wherever we
   have not been told that money has gone. */
import fs from 'fs';
import { chromium } from 'playwright';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const src = fs.readFileSync('index.html', 'utf8');

/* ---- 1. No status colour on the door, in the stylesheet ---------------- */
{
  const i = src.indexOf('#rpt .rp-foundbtn{');
  ok(i > -1, 'the door to the records is gone');
  const block = src.slice(i, src.indexOf('#rpt .rp-foundbtn .rp-go svg', i));
  for (const tok of ['--ok', '--bad', '--warn', '--caution'])
    ok(!new RegExp('var\\(' + tok + '\\b').test(block),
       'the door is painted with ' + tok + ', which is a verdict about what is behind it');
  /* And no hard-coded green, amber or red either. The tokens were only half
     the problem: three of the four colours on this door were literals. */
  for (const hex of block.matchAll(/#([0-9A-Fa-f]{6})\b/g)) {
    const [r, g, b] = [0, 2, 4].map(k => parseInt(hex[1].slice(k, k + 2), 16));
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    ok(spread <= 40, 'the door carries the literal colour #' + hex[1]
       + ', which reads as a status rather than as a surface');
  }
}

/* ---- 2. The count does the work --------------------------------------- */
{
  ok(/function rpOfficialCount/.test(src),
     'nothing counts how many records an authority published, so the neutral '
   + 'door has no fact to carry');
  const fn = src.slice(src.indexOf('function rpOfficialCount'),
                       src.indexOf('function rpLookalikes'));
  ok(/rpAttached\(/.test(fn),
     'the count includes records that are not about this party, which is the '
   + 'attachment rule broken on a smaller surface');
  ok(/t==="A"/.test(fn), 'the count includes records no authority published');
  ok(/regulator, court or registry/.test(src),
     'the door no longer says how many of the records an authority published');
}

/* ---- 3. The imperative says only what we know -------------------------- */
{
  ok(/if you\\u2019ve sent money/.test(src) || /if you’ve sent money/.test(src),
     'the imperative is issued without the condition, to readers who have sent nothing');
  const i = src.indexOf('var actLabel_');
  ok(i > -1, 'the label is no longer chosen from what we know');
  const block = src.slice(i, i + 220);
  ok(/sent_ \?/.test(block),
     'the label does not turn on whether the reader told us money has gone');
  ok(/sent_ \? "Do this right now"/.test(block),
     'a reader who has told us the money is gone is still given a conditional, '
   + 'which hedges the one line that has to land');
}

/* ---- 4. The beat is still earned by one thing only -------------------- */
{
  ok(/var beat_ = rpHasOfficial\(d\) \? " rp-beat" : ""/.test(src),
     'the flashing is no longer gated on an authority having named this party');
  ok(!/rp-beat[^\n]*stage/.test(src),
     'the flashing has been tied to whether money was sent; it means one thing '
   + 'and that thing is an authority record');
}

/* ---- 5. And it renders ------------------------------------------------- */
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/index.html?demo=1');
  await p.waitForTimeout(400);
  /* The same walk uxgate takes: the two context questions have to be answered
     or the run never starts. */
  const tap = re => p.evaluate(r => { const b = [...document.querySelectorAll('button')]
    .find(x => x.offsetParent && new RegExp(r, 'i').test(x.innerText));
    if (b) { b.click(); return 1; } return 0; }, re);
  await p.fill('#kbInput', 'Meridian Yield Partners'); await p.click('#kbGo');
  await p.waitForTimeout(250);
  await p.evaluate(() => { const x = document.getElementById('primOk'); if (x) x.click(); });
  await p.waitForTimeout(2200);
  await tap('investment'); await p.waitForTimeout(1400);
  await tap('Yes');
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(1100);
    if (await p.evaluate(() => document.body.getAttribute('data-stage') === 'report')) break;
    await p.evaluate(() => { const x = document.getElementById('primOk');
      if (x && !x.disabled) x.click(); });
  }
  const st = await p.evaluate(() => document.body.getAttribute('data-stage'));
  ok(st === 'report', 'the demo never reached the report, so nothing below was measured');
  if (st === 'report') {
    const d = await p.evaluate(() => {
      const el = document.getElementById('rpToFound');
      const cs = getComputedStyle(el);
      const go = getComputedStyle(el.querySelector('.rp-go'));
      const t  = getComputedStyle(el.querySelector('.rp-t'));
      const act = document.querySelector('#rpTonightA .rp-actb');
      return { bg: cs.backgroundColor, bd: cs.borderColor, go: go.backgroundColor,
               tc: t.color, sub: document.getElementById('rpToFoundX').textContent,
               act: act ? act.textContent.trim() : null,
               beat: act ? act.className.includes('rp-beat') : null };
    });
    const grey = c => { const m = c.match(/\d+/g).slice(0, 3).map(Number);
      return Math.max(...m) - Math.min(...m) <= 40; };
    ok(grey(d.bg), 'the door renders a coloured ground: ' + d.bg);
    ok(grey(d.bd), 'the door renders a coloured border: ' + d.bd);
    ok(grey(d.go), 'the door renders a coloured arrow: ' + d.go);
    /* Either the count, or the honest line for a run that found nothing. What
       it must never be is empty, or a promise of "every record" on a run that
       returned two. */
    ok(d.sub.trim().length > 10, 'the door says nothing about what is behind it');
    ok(/record|register/.test(d.sub),
       'the door subline no longer names records or registers: ' + d.sub);
    console.log('  door   ' + d.bg + ' / ' + d.bd + ' / arrow ' + d.go);
    console.log('  sub    ' + d.sub);
    console.log('  action ' + JSON.stringify(d.act) + '  beats: ' + d.beat);
  }
  ok(errs.length === 0, 'page errors: ' + errs.join(' | '));

  /* ---- 6. A red verdict where the money has NOT gone -----------------
     Driven rather than walked. The demo party is not red and the walk cannot
     make it one, so the two inputs the label turns on are set directly through
     the debug hook and the report is drawn again. That is the whole point of
     the hook: the property worth testing is not that a button renders, it is
     that its sentence is true for the reader in front of it. */
  const q = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const e2 = []; q.on('pageerror', e => e2.push(String(e)));
  const tap2 = re => q.evaluate(r => { const x = [...document.querySelectorAll('button')]
    .find(y => y.offsetParent && new RegExp(r, 'i').test(y.innerText));
    if (x) { x.click(); return 1; } return 0; }, re);
  await q.goto('file://' + process.cwd() + '/index.html?demo=1&debug=1');
  await q.waitForTimeout(400);
  await q.fill('#kbInput', 'Meridian Yield Partners'); await q.click('#kbGo');
  await q.waitForTimeout(250);
  await q.evaluate(() => { const x = document.getElementById('primOk'); if (x) x.click(); });
  await q.waitForTimeout(2200);
  await tap2('investment'); await q.waitForTimeout(1400);
  await tap2('Yes');
  for (let i = 0; i < 24; i++) {
    await q.waitForTimeout(1100);
    if (await q.evaluate(() => document.body.getAttribute('data-stage') === 'report')) break;
    await q.evaluate(() => { const x = document.getElementById('primOk');
      if (x && !x.disabled) x.click(); });
  }
  const hook = await q.evaluate(() => !!(window.__KBYS__ && window.__KBYS__.rerender));
  ok(hook, 'the debug hook is gone, so the not-sent case cannot be driven');

  const n = hook ? await q.evaluate(() => {
    const K = window.__KBYS__;
    const d = K.lastReport();
    d.verdict = 'RED';
    K.runCtx({ sector: 'INVESTMENT', stage: 'BEFORE', channel: null });
    K.rerender();
    const a = document.querySelector('#rpTonightA .rp-actb');
    return { ctx: K.runCtx().stage, act: a ? a.textContent.trim() : null,
             beat: a ? a.className.includes('rp-beat') : null };
  }) : {};
  console.log('  red, not sent  ctx=' + n.ctx + '  action ' + JSON.stringify(n.act)
    + '  beats: ' + n.beat);
  ok(n.ctx === 'BEFORE', 'the not-sent case did not take: ' + n.ctx);
  ok(n.act, 'a red verdict offers no action at all');
  ok(n.act && /if you\u2019ve sent money|if you’ve sent money/.test(n.act),
     'a reader who has sent nothing is told to do something right now with no '
   + 'condition: ' + JSON.stringify(n.act));
  /* And the demo party has no attached authority record, so it must not beat. */
  ok(n.beat === false,
     'a red verdict with no authority record about this party is still flashing');

  ok(e2.length === 0, 'page errors on the not-sent walk: ' + e2.join(' | '));
} finally { await b.close(); }

if (fails.length) { console.error('doorcheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('doorcheck ok  neutral door with the count, imperative conditional on what we know');
