/* THE BAR ON THE PATH SOMEBODY ACTUALLY WATCHES.
 * smoke25 drives the live event stream. This watches a real demo run frame by
 * frame, which is the path that was broken: the demo loop calls waitProgress
 * once per register, roughly every twenty milliseconds, and the ticker used to
 * be destroyed and recreated on every one of those calls, so it never fired.
 * The bar sat at two and a half per cent for two and a third seconds and then
 * jumped to a hundred. Nothing about that is visible in a phase-level test.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);

await p.evaluate(() => {
  window.__W = [];
  const bar = document.getElementById('waitBar');
  const t0 = performance.now();
  const tick = () => {
    window.__W.push([Math.round(performance.now() - t0), parseFloat(bar.style.width) || 0,
                     document.getElementById('waitBox').classList.contains('on')]);
    if (performance.now() - t0 < 9000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(9300);
const w = (await p.evaluate(() => window.__W)).filter(x => x[2]);
if (w.length < 30) fail('the waiting screen was never up long enough to measure');

const first = w[0][1];
let back = null, stallMs = 0, stallAt = null, hundredBefore = null;
let lastChangeT = w[0][0], lastV = w[0][1];
for (const [t, v] of w) {
  if (v < lastV - 0.001) back = [t, lastV, v];
  if (Math.abs(v - lastV) > 0.001) {
    if (t - lastChangeT > stallMs) { stallMs = t - lastChangeT; stallAt = lastV; }
    lastChangeT = t; lastV = v;
  }
}
const done = await p.evaluate(() => !!(window.__KBYS__.current()));
const hundredAt = w.find(x => x[1] >= 100);
console.log('first painted width      ', first + '%');
console.log('longest stall            ', stallMs + 'ms at ' + (stallAt || 0).toFixed(1) + '%');
console.log('distinct widths painted  ', new Set(w.map(x => x[1])).size);
console.log('reached 100 at           ', hundredAt ? hundredAt[0] + 'ms' : 'not during the wait');

if (first < 1) fail('the bar starts below one per cent');
if (first > 8) fail('the bar starts at ' + first + '%, which is a jump rather than a start');
if (back) fail('the bar went backwards at ' + back[0] + 'ms, ' + back[1] + '% to ' + back[2] + '%');
if (stallMs > 900) fail('the bar stood still for ' + stallMs + 'ms at ' + stallAt.toFixed(1)
  + '%, which reads as a page that has stopped');
if (new Set(w.map(x => x[1])).size < 25)
  fail('the bar painted only ' + new Set(w.map(x => x[1])).size
     + ' distinct widths across the whole wait, so it is stepping rather than building');
if (errs.length) fail('page errors ' + errs.slice(0, 2).join(' | '));
console.log('PASSED');
await b.close();
