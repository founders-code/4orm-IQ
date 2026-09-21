/* ==================== THE DOOR CARRIES NO VERDICT, AND THE IMPERATIVE IS TRUE
   Two rules, both about the same thing: a page somebody reads in a panic must
   not say more than it knows.

   The door to the records is neutral, because a colour on it is a verdict
   about what is behind it before anybody has opened it.

   The imperative beside the verdict appears only where the reader told us
   money has gone. Everyone else gets the next steps door instead. */
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

/* ---- 2. The count does the work, in one unit -------------------------- */
{
  const i = src.indexOf('var shownL = rpSieve(');
  ok(i > -1, 'the door count no longer counts the findings the sheet opens on');
  const blk = src.slice(i, i + 900);
  ok(/tier==="A"/.test(blk), 'the second number counts records no authority published');
  ok(/regulator, court or registry/.test(blk),
     'the door no longer says how many findings an authority published');
  ok(!/function rpOfficialCount/.test(src),
     'the old count is back, which counted records rather than findings and '
   + 'printed "six records, nine of them from a regulator"');
}

/* ---- 3. The imperative goes only to a reader whose money has gone ------- */
{
  const i = src.indexOf('var sentNow_ =');
  ok(i > -1, 'the control beside the verdict is no longer chosen from the answer');
  const blk = src.slice(i, i + 900);
  ok(/stage\)\|\|"BEFORE"\)==="SENT"/.test(blk),
     'the control does not turn on whether the reader told us money has gone');
  ok(/if\(sentNow_\)\{/.test(blk) && /Do this right now<\/button>/.test(blk) && !/Open what to tell your bank/.test(src),
     'a reader whose money has gone is not told to do this right now');
  ok(/actBox\.hidden = true/.test(blk),
     'a reader who has sent nothing is still shown an imperative beside the verdict');
}

/* ---- 4. The beat is earned by two things, and rests lit ----------------- */
{
  ok(/var beat_ = \(sentNow_ && rpHasOfficial\(d\)\) \? " rp-beat" : ""/.test(src),
     'the flashing is not gated on money gone AND an authority having named this party');
  ok(/animation:rpBeat 1\.5s var\(--ease\) 3\}/.test(src),
     'the flashing is not three beats');
  ok(!/rpBeat[^;}\n]*infinite/.test(src), 'the flashing never stops');
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

  const drive = stage => q.evaluate(st => {
    const K = window.__KBYS__;
    const d = K.lastReport();
    d.verdict = 'RED';
    K.runCtx({ sector: 'INVESTMENT', stage: st, channel: null });
    K.rerender();
    const a = document.querySelector('#rpTonightA .rp-actb');
    const w = document.getElementById('rpActWay');
    return { ctx: K.runCtx().stage, act: a && !a.closest('[hidden]') ? a.textContent.trim() : null,
             beat: a ? a.className.includes('rp-beat') : null,
             mode: w ? w.getAttribute('data-mode') : null,
             door: (document.getElementById('rpToActT')||{}).textContent };
  }, stage);
  for (const st of ['BEFORE', 'DILIGENCE']) {
    const n = hook ? await drive(st) : {};
    console.log('  red, ' + st + '  action ' + JSON.stringify(n.act) + '  door ' + JSON.stringify(n.door));
    ok(n.ctx === st, 'the ' + st + ' case did not take: ' + n.ctx);
    ok(!n.act, 'a reader who has sent nothing is shown an action beside the verdict: ' + n.act);
    ok(n.mode === 'next', 'the door is in ' + n.mode + ' mode for a reader who has sent nothing');
    ok(n.door === 'Next steps to protect you', 'the door reads ' + JSON.stringify(n.door));
    /* The door opens the next steps page, not the act page. */
    if (hook) {
      const opened = await q.evaluate(() => { document.getElementById('rpToAct').click();
        const r = !document.getElementById('rpNext').hidden;
        document.getElementById('rpNextBack').click(); return r; });
      ok(opened, 'the door does not open the next steps page for ' + st);
    }
  }
  const s = hook ? await drive('SENT') : {};
  console.log('  red, SENT  action ' + JSON.stringify(s.act) + '  beats: ' + s.beat + '  door ' + JSON.stringify(s.door));
  ok(s.act === 'Do this right now', 'a reader whose money has gone is not given "Do this right now": ' + s.act);
  ok(s.door === 'Next steps to protect you in the future', 'the door for SENT reads ' + JSON.stringify(s.door));
  /* The demo party has no attached authority record, so even SENT must not beat. */
  ok(s.beat === false, 'a verdict with no authority record about this party is still flashing');
  if (hook) {
    const r = await q.evaluate(() => {
      document.getElementById('rpToAct').click();
      const next = !document.getElementById('rpNext').hidden;
      document.getElementById('rpNextBack').click();
      document.querySelector('#rpTonightA .rp-actb').click();
      return { next, act: !document.getElementById('rpAct').hidden };
    });
    ok(r.next, 'the door does not open next steps for a reader whose money has gone');
    ok(r.act, '"Do this right now" beside the verdict does not open the act page');
  }

  ok(e2.length === 0, 'page errors on the not-sent walk: ' + e2.join(' | '));
} finally { await b.close(); }

if (fails.length) { console.error('doorcheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('doorcheck ok  neutral records door with the count, imperative only where money has gone');
