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
/* Typing alone must not put a control on the page. */
if (await p.$('#kbChat:not([hidden])')) fails.push('the thread opens while somebody is typing');
await p.click('#kbGo');
await p.waitForTimeout(2400);
await p.locator('.pill', { hasText: 'A vehicle' }).first().click();
await p.waitForTimeout(1500);

/* 1. Nothing in the thread may overlap anything else in it. Two boxes sharing
      pixels is the signature of a discarded layout property. */
const boxes = await p.$$eval('#kbChat > *', els => els.map(e => {
  const r = e.getBoundingClientRect();
  return { cls: e.className, top: r.top, bottom: r.bottom, h: r.height };
}));
console.log('thread children:', boxes.length);
if (boxes.length < 4) fails.push('the thread lost a message');
for (let i = 1; i < boxes.length; i++) {
  const gap = boxes[i].top - boxes[i - 1].bottom;
  if (gap < -1) fails.push('"' + boxes[i].cls + '" overlaps the message above it by '
    + Math.abs(Math.round(gap)) + 'px');
}
/* A thread has two sides. What the person said sits on the right, what the
   page said sits on the left, and that is the whole reason it reads as a
   conversation rather than a stack of banners. It is also the first thing to
   break, because the landing rule sets display:block on this element and a
   block column silently left-aligns everything while every line of code still
   reads correctly. Measure the sides. */
const sides = await p.evaluate(() => {
  const c = document.getElementById('kbChat');
  const box = c.getBoundingClientRect();
  const pick = sel => [...c.querySelectorAll(sel)].map(e => e.getBoundingClientRect());
  const me = pick('.bub.me'), them = pick('.bub.them');
  return {
    me: me.length, them: them.length,
    meRight: me.every(r => Math.abs(r.right - box.right) < 2),
    themLeft: them.every(r => Math.abs(r.left - box.left) < 2),
  };
});
if (!sides.me || !sides.them) fails.push('the thread has only one side to it');
if (!sides.meRight) fails.push('what the person said is not on the right, so the thread is not '
  + 'laying out as a conversation');
if (!sides.themLeft) fails.push('what the page said is not on the left');

/* The bar and the accepts line are hidden in script. The hidden ATTRIBUTE
   loses to any display rule written with a class, so measure the box. */
const stillUp = await p.evaluate(() => ['kbForm', 'kbAccepts'].filter(id => {
  const e = document.getElementById(id);
  return e && e.getBoundingClientRect().height > 0;
}));
if (stillUp.length) fails.push('hidden but still on screen: ' + stillUp.join(', '));

/* 2. Every chip has to be big enough to hit on a phone. */
const small = await p.$$eval('#kbChat .pill', els => els
  .map(e => ({ t: e.textContent.trim(), h: e.getBoundingClientRect().height }))
  .filter(x => x.h < 30));
if (small.length) fails.push(small.length + ' pill(s) are under 30px tall: '
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
  return [...document.querySelectorAll('#kbChat .pill')].some(c => {
    const r = c.getBoundingClientRect();
    return !(r.bottom <= g.top || r.top >= g.bottom || r.right <= g.left || r.left >= g.right);
  });
});
if (clash) fails.push('a pill overlaps the Check button on a phone');

await b.close();
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
