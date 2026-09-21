/* ==================== NEXT STEPS TO PROTECT YOU
   The page a reader lands on when money has not gone. It teaches how to check
   a business, cites a public source for every "did you know", and keeps the
   way to the act page for the reader who has sent money after all. Also holds
   the small fixes that shipped with it: the money question is flagged, the
   close band keeps the reading order, and "VC" is not printed as "Vc". */
import fs from 'fs';
import { chromium } from 'playwright';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const src = fs.readFileSync('index.html', 'utf8');

/* ---- 1. The page exists and every fact carries its source ------------- */
const a = src.indexOf('<div class="rp-sheet" id="rpNext"');
ok(a > -1, 'the next steps page is gone');
const page = src.slice(a, src.indexOf('<div class="rp-sheet"', a + 10));
ok(/Next steps to protect you\./.test(page), 'the page has lost its title');
const cards = page.split('class="rp-dykc"').slice(1);
ok(cards.length >= 4, 'fewer than four did you knows: ' + cards.length);
for (const [i, c] of cards.entries())
  ok(/class="rp-dyks"[\s\S]*?href="https:\/\/[^"]+\.(gc\.ca|canada\.ca|ca)\//.test(c.slice(0, 1600)),
     'did you know ' + (i + 1) + ' carries no public source');
const tips = (page.match(/<li/g) || []).length;
ok(tips >= 8, 'the tips list is short: ' + tips);
ok(/review/i.test(page) && /social media/i.test(page) && /consumer protection/i.test(page),
   'the tips no longer cover review sites, social media and consumer protection sites');
ok(/negative/i.test(page) && /bought/i.test(page),
   'the tips no longer say positive reviews can be bought and a run of negative ones is the signal');
ok(/<button class="rp-actb" type="button" id="rpNextToAct">Do this right now<\/button>/.test(page),
   'the foot of the page is not the same red "Do this right now" pill as beside the verdict');
ok(!/[–—]/.test(page), 'the page carries a long dash');
ok(!/\bAI\b|\bproblem\b/i.test(page.replace(/<[^>]+>/g, ' ')), 'the page says AI or problem');

/* ---- 2. The money question is flagged ---------------------------------- */
ok(/q:"Have you already sent money\?",\s*note:"This is the important one\./.test(src),
   'the money question is no longer flagged as the important one');

/* ---- 3. The close band keeps the reading order ------------------------- */
{
  const g = src.indexOf('id="rpGoodSec"'), c = src.indexOf('id="rpClose"'),
        gp = src.indexOf('id="rpGapsBox"'), w = src.indexOf('id="rpActWay"');
  const say = src.indexOf('id="rpSay"'), fd = src.indexOf('id="rpToFound"'),
        tn = src.indexOf('id="rpTonight"'), card = src.indexOf('class="rp-cardcol"');
  ok(tn < say && say < fd && fd < g && g > -1 && c > g && gp > c && w > gp && w < card,
     'the reading column is out of order: verdict, our own words, what we found, '
   + 'in their favour, what we could not answer, next steps, then the card beside it');
  ok((src.match(/class="rp-gapnote"/g) || []).length <= 1,
     'the old grey gaps box is back beside the one for a run that found nothing');
}

/* ---- 4. "VC" stays VC ------------------------------------------------ */
let kind = [];
{
  const c = src.indexOf('var RP_CAPS'), f = src.indexOf('function rpKind(v){');
  ok(c > -1 && f > -1, 'the capitals map or rpKind is gone');
  const caps = src.slice(c, src.indexOf(';', src.indexOf('}', c)) + 1);
  const fn = src.slice(f, src.indexOf('\n}', f) + 2);
  kind = new Function(caps + fn + 'return [rpKind("VC_STARTUP"), rpKind("nft marketplace"), rpKind("crypto_exchange")];')();
}

/* ---- 5. It renders, routes, and "VC" stays VC -------------------------- */
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/index.html?demo=1&debug=1');
  await p.waitForTimeout(400);
  ok(kind[0] === 'VC startup', 'rpKind prints ' + JSON.stringify(kind[0]));
  ok(kind[1] === 'NFT marketplace', 'rpKind prints ' + JSON.stringify(kind[1]));
  ok(kind[2] === 'Crypto exchange', 'rpKind prints ' + JSON.stringify(kind[2]));

  const tap = re => p.evaluate(r => { const x = [...document.querySelectorAll('button')]
    .find(y => y.offsetParent && new RegExp(r, 'i').test(y.innerText));
    if (x) { x.click(); return 1; } return 0; }, re);
  await p.fill('#kbInput', 'Meridian Yield Partners'); await p.click('#kbGo');
  await p.waitForTimeout(2200);
  await tap('investment'); await p.waitForTimeout(1400);
  const note = await p.evaluate(() => document.body.innerText.includes('This is the important one'));
  ok(note, 'the flag does not show on the money question');
  await tap('not yet');
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(1100);
    if (await p.evaluate(() => document.body.getAttribute('data-stage') === 'report')) break;
    await p.evaluate(() => { const x = document.getElementById('primOk'); if (x && !x.disabled) x.click(); });
  }
  const st = await p.evaluate(() => document.body.getAttribute('data-stage'));
  ok(st === 'report', 'the demo never reached the report');
  if (st === 'report') {
    const r = await p.evaluate(() => {
      document.getElementById('rpToAct').click();
      const s = document.getElementById('rpNext');
      const shown = !s.hidden && s.getBoundingClientRect().height > 400;
      const logo = !!s.querySelector('img[data-logo="1"]') || !!document.querySelector('img[data-logo="1"]');
      document.getElementById('rpNextToAct').click();
      const act = !document.getElementById('rpAct').hidden;
      return { shown, logo, act };
    });
    ok(r.shown, 'the next steps page does not open from the door');
    ok(r.act, 'the red button on the next steps page does not open the act page');
    /* One column, one width: every block in it shares both edges. */
    const e = await p.evaluate(() => { document.getElementById('rpActBack') && document.getElementById('rpActBack').click();
      return ['#rpEyebrow','#rpTonight','#rpSay','#rpReport .rp-foundway','#rpGapsBox','#rpActWay']
        .map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }); });
    const [l0, r0] = e[0];
    e.forEach((x, i) => ok(Math.abs(x[0] - l0) <= 1 && Math.abs(x[1] - r0) <= 1,
      'block ' + (i + 1) + ' of the reading column does not share its edges: ' + JSON.stringify(e)));
    console.log('  next page ' + JSON.stringify(r) + '  cards ' + cards.length + '  tips ' + tips);
  }
  /* ---- 6. Keep reading only when the way on is out of sight ---------- */
  for (const [h, want] of [[1400, false], [620, true]]) {
    const c = await b.newPage({ viewport: { width: 1440, height: h } });
    await c.goto('file://' + process.cwd() + '/index.html?demo=1&debug=1');
    await c.waitForTimeout(400);
    const tp = re => c.evaluate(r => { const x = [...document.querySelectorAll('button')]
      .find(y => y.offsetParent && new RegExp(r, 'i').test(y.innerText)); if (x) x.click(); }, re);
    await c.fill('#kbInput', 'Meridian Yield Partners'); await c.click('#kbGo');
    await c.waitForTimeout(2200); await tp('investment'); await c.waitForTimeout(1400); await tp('not yet');
    for (let i = 0; i < 24; i++) {
      await c.waitForTimeout(1100);
      if (await c.evaluate(() => document.body.getAttribute('data-stage') === 'report')) break;
      await c.evaluate(() => { const x = document.getElementById('primOk'); if (x && !x.disabled) x.click(); });
    }
    await c.evaluate(() => window.scrollTo(0, 0));
    await c.waitForTimeout(1800);
    const cue = await c.evaluate(() => { const m = document.getElementById('rpMore');
      return !m.hidden && m.classList.contains('rp-on'); });
    const seen = await c.evaluate(() => document.getElementById('rpActWay').getBoundingClientRect().bottom <= innerHeight);
    console.log('  keep reading at ' + h + 'px: ' + cue + ' (way on in view: ' + seen + ')');
    ok(cue === !seen, 'keep reading is ' + (cue ? 'shown' : 'hidden') + ' at ' + h
       + 'px while the way on is ' + (seen ? 'in view' : 'out of sight'));
    await c.close();
  }

  ok(errs.length === 0, 'page errors: ' + errs.join(' | '));
} finally { await b.close(); }

if (fails.length) { console.error('nextcheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('nextcheck ok  next steps page sourced, routed, and the money question flagged');
