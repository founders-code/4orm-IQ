/* THE THINGS THAT FLASH, AND THE THING THAT NAVIGATES.
   Three complaints, measured rather than eyeballed:
   the address bar keeps a parameter this build stopped honouring; the console
   is visible under a half transparent scrim on the way to the waiting screen;
   and nothing on the landing may be able to submit the form and reload. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

/* A URL somebody has bookmarked from the old build. */
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?live=1&demo=1&debug=1');
await p.waitForTimeout(900);
const url = await p.evaluate(() => location.search);
console.log('address bar after load:', url);
if (/live=1/.test(url)) fail('the dead live=1 parameter is still in the address bar');
if (!/demo=1/.test(url) || !/debug=1/.test(url))
  fail('cleaning the address bar threw away a parameter that still means something');
const nav = await p.evaluate(() => performance.getEntriesByType('navigation').length);
if (nav !== 1) fail('cleaning the address bar caused a navigation');

/* Nothing in the search form can submit and reload. */
const untyped = await p.evaluate(() =>
  [...document.querySelectorAll('#kbForm button')].filter(x => !x.getAttribute('type')).length);
if (untyped) fail(untyped + ' button(s) in the search form would submit and reload the page');

/* The way to the waiting screen. The scrim must be fully opaque on the frame
   the console appears underneath it, not a third of a second later. */
await p.evaluate(() => { window.__seen = []; });
await p.evaluate(() => {
  const scrim = document.getElementById('waitScrim');
  const tick = () => {
    if (document.body.getAttribute('data-stage') === 'console')
      window.__seen.push(+getComputedStyle(scrim).opacity);
    if (window.__seen.length < 30) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(600);
const seen = await p.evaluate(() => window.__seen);
const worst = seen.length ? Math.min(...seen) : 1;
console.log('scrim opacity while the console is behind it, worst frame:', worst.toFixed(3));
if (!seen.length) fail('the console never came up behind the waiting screen, so nothing was measured');
if (worst < 0.98) fail('the console is visible through the scrim at opacity ' + worst.toFixed(2)
  + ', which is the flash on the way to the waiting screen');

if (errs.length) fail('page errors ' + errs.slice(0, 2).join(' | '));
console.log('PASSED');
await b.close();
