/* THE COUNTER IS OFF THE LANDING PAGE.
   It showed a number read off the chained log, and when the number stopped
   arriving the row simply never appeared, which is the correct failure but a
   confusing one to look at. It was taken off deliberately. This asserts it
   stayed off, and that the quiet way into the back office that sits over the
   landing light is invisible, pressable, and silent to a screen reader. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1');
await p.waitForTimeout(900);

const gone = await p.evaluate(() => ({
  row: !!document.getElementById('servedRow'),
  n:   !!document.getElementById('servedN'),
  fns: ['paintServed', 'loadServed', 'bumpServed'].filter(f => typeof window[f] === 'function')
}));
console.log('counter on the page:', JSON.stringify(gone));
if (gone.row || gone.n) fail('the checks-run counter is back in the markup');
if (gone.fns.length) fail('counter functions are still defined: ' + gone.fns.join(', '));

/* the way in */
const led = await p.evaluate(() => {
  const a = document.querySelector('.lampgo');
  if (!a) return null;
  const cs = getComputedStyle(a), r = a.getBoundingClientRect();
  /* the bulb's own glow is centred a little below the top edge */
  const dot = { left:innerWidth/2-8, right:innerWidth/2+8, top:40, bottom:52,
                width:16, height:16 };
  return {
    href: a.getAttribute('href'),
    opacity: cs.opacity, display: cs.display, visibility: cs.visibility,
    w: Math.round(r.width), h: Math.round(r.height),
    tab: a.getAttribute('tabindex'), aria: a.getAttribute('aria-hidden'),
    /* it has to actually sit over the light, not near it */
    overDot: r.left <= dot.left + 2 && r.right >= dot.right - 2
             && r.top <= dot.top + 2 && r.bottom >= dot.bottom - 2,
    /* and it has to be the thing under the cursor at the light's centre */
    hit: document.elementFromPoint(dot.left + dot.width / 2, dot.top + dot.height / 2) === a
  };
});
console.log('the way in:', JSON.stringify(led));
if (!led) fail('there is no way into the back office from the landing light');
if (led.href !== 'admin.html') fail('the landing light does not point at the back office');
if (led.opacity !== '0') fail('the hit area is visible, and it is meant not to be');
if (led.display === 'none' || led.visibility === 'hidden')
  fail('the hit area is not rendered, so it cannot be pressed');
if (led.w < 20 || led.h < 20) fail('the hit area is smaller than a fingertip');
if (!led.overDot) fail('the hit area does not cover the light');
if (!led.hit) fail('something else is on top of the hit area, so the press lands elsewhere');
if (led.tab !== '-1') fail('the hit area is in the tab order of a consumer page');
if (led.aria !== 'true') fail('the hit area is announced to screen readers');

/* and the lamp itself is untouched */
const lit = await p.evaluate(() => {
  const b = getComputedStyle(document.querySelector('#room .bulb'));
  const l = getComputedStyle(document.querySelector('#room .lit'));
  return { w: b.width, h: b.height, anim: l.animationName,
           roomHits: getComputedStyle(document.getElementById('room')).pointerEvents };
});
console.log('the lamp itself:', JSON.stringify(lit));
if (lit.w !== '240px' || lit.h !== '230px') fail('the lamp changed size');
if (lit.anim !== 'roomflicker') fail('the lamp stopped drifting');
if (lit.roomHits !== 'none') fail('the room started catching clicks');

if (errs.length) fail('page errors ' + errs.slice(0, 2).join(' | '));
console.log('PASSED');
await b.close();
