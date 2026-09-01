/* LAYOUT, MEASURED.
 *
 * Four times now a duplicate CSS property has silently won on this page and
 * every text-based test passed while the thing was visibly broken: the sheet
 * padding, the ruler row, the policy chip, and now the context block, where
 * `body[data-stage="landing"] .landing-only{display:block}` outranked a
 * single-class display:flex and discarded the column gap.
 *
 * A regex cannot see that. This renders the page and measures boxes. */
import { chromium } from 'playwright';

const URL = 'file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1';
const fails = [];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
await p.goto(URL);
await p.waitForTimeout(1200);

await p.fill('#kbInput', 'atlanticglobalwealth.com');
await p.waitForTimeout(250);
await p.click('#kbCtx .ctxchip[data-v="AUTO"]');
await p.waitForTimeout(250);

/* 1. Nothing inside the context block may overlap anything else in it. Two
      boxes sharing pixels is the signature of a discarded layout property. */
const boxes = await p.$$eval('#kbCtx > *', els => els.map(e => {
  const r = e.getBoundingClientRect();
  return { cls: e.className, top: r.top, bottom: r.bottom, h: r.height };
}));
console.log('context children:', boxes.length);
if (boxes.length < 4) fails.push('the context block lost a row');
for (let i = 1; i < boxes.length; i++) {
  const gap = boxes[i].top - boxes[i - 1].bottom;
  console.log('  gap after ' + boxes[i - 1].cls + ': ' + Math.round(gap) + 'px');
  if (gap < 0) fails.push('"' + boxes[i].cls + '" overlaps the row above it by '
    + Math.abs(Math.round(gap)) + 'px');
  else if (gap < 8) fails.push('"' + boxes[i].cls + '" sits ' + Math.round(gap)
    + 'px from the row above, which reads as one block rather than two questions');
}

/* 2. Every chip has to be big enough to hit on a phone. */
const small = await p.$$eval('#kbCtx .ctxchip', els => els
  .map(e => ({ t: e.textContent.trim(), h: e.getBoundingClientRect().height }))
  .filter(x => x.h < 30));
if (small.length) fails.push(small.length + ' chip(s) are under 30px tall: '
  + small.map(s => s.t).join(', '));

/* 3. The page must not scroll sideways at any width the product actually meets. */
for (const w of [1440, 1280, 900, 620, 390]) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.waitForTimeout(160);
  const over = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('overflow at ' + w + 'px:', over);
  if (over > 1) fails.push('the page scrolls sideways at ' + w + 'px by ' + over + 'px');
}

/* 4. The chips must never cover the Check button, which is the one control on
      the page that has to stay reachable. */
await p.setViewportSize({ width: 390, height: 900 });
await p.waitForTimeout(200);
const clash = await p.evaluate(() => {
  const g = document.getElementById('kbGo').getBoundingClientRect();
  return [...document.querySelectorAll('#kbCtx .ctxchip')].some(c => {
    const r = c.getBoundingClientRect();
    return !(r.bottom <= g.top || r.top >= g.bottom || r.right <= g.left || r.left >= g.right);
  });
});
if (clash) fails.push('a chip overlaps the Check button on a phone');

await b.close();
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
