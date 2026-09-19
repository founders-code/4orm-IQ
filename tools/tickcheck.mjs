/* ============================================== THE FIRST SENTENCE IS READABLE
   The strip under the landing block used to begin at rest, with the first
   figure already sitting at the left edge. The page loaded, the line started
   moving, and half of the first sentence was gone before anybody had looked at
   it: the one line the strip leads with was the one line nobody could read.

   This checks the three things that fixes it. The rail starts beyond the right
   edge. It arrives moving at the speed it keeps, so the join cannot be seen.
   And it runs at the slower speed, because a line that cannot be finished is
   the same failure at any starting point. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:1280,height:1000} });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(600);

const fails = [];
const m = await p.evaluate(() => {
  const rail = document.getElementById('tickRail');
  const mask = rail.parentNode;
  const cs = getComputedStyle(rail);
  const strip = document.getElementById('tickRow');
  const sp = getComputedStyle(strip);
  return {
    start: cs.getPropertyValue('--tickstart').trim(),
    inDur: cs.getPropertyValue('--tickin').trim(),
    runDur: cs.getPropertyValue('--tickdur').trim(),
    anim: cs.animationName,
    maskW: mask.clientWidth,
    railW: rail.scrollWidth / 2,
    padTop: sp.paddingTop, padBot: sp.paddingBottom,
    firstLeft: rail.getBoundingClientRect().left - mask.getBoundingClientRect().left
  };
});

/* It comes in from beyond the right edge, by the width of the window it runs
   in, and not by a percentage of a rail that is twice that wide. */
if (!/^\d+px$/.test(m.start)) fails.push('the entrance does not start from a measured width: ' + m.start);
else {
  const px = parseFloat(m.start);
  if (Math.abs(px - m.maskW) > 2)
    fails.push('the rail starts ' + Math.round(px) + 'px out, the strip is ' + m.maskW + 'px wide');
}
if (!/tickin/.test(m.anim) || !/tickrun/.test(m.anim))
  fails.push('the strip does not run both the entrance and the loop: ' + m.anim);

/* The entrance is the same speed as the loop, so nothing changes pace at the
   join. Both are compared as points per second against the same constant. */
const SPEED = 56;
const inS = parseFloat(m.inDur), runS = parseFloat(m.runDur);
if (Math.abs(m.maskW / inS - SPEED) > 2)
  fails.push('the entrance moves at ' + (m.maskW / inS).toFixed(1) + ' points a second, the loop at ' + SPEED);
if (Math.abs(m.railW / runS - SPEED) > 2)
  fails.push('the loop moves at ' + (m.railW / runS).toFixed(1) + ' points a second, not ' + SPEED);
/* Seven per cent slower than the sixty it ran at before. */
if (Math.round(SPEED) !== Math.round(60 * 0.93))
  fails.push('the speed is no longer seven per cent off the old one');

/* Taller, and the room taken below rather than above. */
const top = parseFloat(m.padTop), bot = parseFloat(m.padBot);
if (Math.abs(top - 11) > 0.5) fails.push('the strip grew upwards: the top padding is now ' + top + 'px');
if (bot <= top) fails.push('the strip is not taller downwards: ' + top + 'px above, ' + bot + 'px below');

/* And the first sentence starts off screen, not mid-line. */
await p.reload();
await p.waitForTimeout(120);
const at0 = await p.evaluate(() => {
  const rail = document.getElementById('tickRail');
  const mask = rail.parentNode;
  return rail.getBoundingClientRect().left - mask.getBoundingClientRect().left;
});
if (at0 < mAt(m)) fails.push('the first figure is already inside the strip when the page loads, at '
  + Math.round(at0) + 'px of ' + m.maskW);
function mAt(x){ return x.maskW * 0.5; }

if (errs.length) fails.push('page errors: ' + errs.join(' | '));

console.log('\nTHE READER STRIP\n');
console.log('  starts          ' + m.start + ' out, the strip is ' + m.maskW + 'px wide');
console.log('  entrance        ' + m.inDur + ' at ' + (m.maskW / inS).toFixed(1) + ' points a second');
console.log('  loop            ' + m.runDur + ' at ' + (m.railW / runS).toFixed(1) + ' points a second');
console.log('  height          ' + top + 'px above, ' + bot + 'px below');
console.log('');
if (fails.length) {
  console.log('FAILED'); fails.forEach(f => console.log('  ' + f)); console.log('');
  await b.close(); process.exit(1);
}
console.log('PASSED  the strip starts off the right edge and can be read from its first word\n');
await b.close();
