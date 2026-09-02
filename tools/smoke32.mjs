/* THE BAR ON THE PATH A CUSTOMER ACTUALLY TAKES.
 *
 * smoke31 drives the demo, which is over in under three seconds. The live path
 * is a two minute run whose middle is a single reasoning call with nothing in
 * it but an eight second heartbeat, and that is where the bar was dead: the
 * ceiling was raised only when a heartbeat arrived, so the bar walked to it in
 * half a second and then stood still for the other seven and a half. Measured,
 * in a row: 4763, 7380, 7466, 7466 and 7556 milliseconds, between ninety and
 * ninety three per cent. The reader called it "out to lunch" and was right.
 *
 * The curve was always a function of elapsed time. The ticker reads it as one
 * now, and the heartbeat only re-anchors the clock. This is the proof, and it
 * fails if anybody ever wires the creep back to the event.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);

await p.evaluate(() => {
  window.__W = []; const t0 = performance.now();
  const bar = document.getElementById('waitBar');
  const tick = () => {
    window.__W.push([Math.round(performance.now() - t0), parseFloat(bar.style.width) || 0]);
    if (performance.now() - t0 < 60000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await p.evaluate(() => window.__KBYS__.waitOpen('imacademy.com'));
for (const s of ['plan', 'retrieve', 'retrieved', 'round2', 'research', 'reason']) {
  await p.waitForTimeout(1200);
  await p.evaluate(x => window.__KBYS__.onLiveEvent({ t: 'phase', v: {
    step: x, label: x, searches: 8, categories: 10, ok: 6, of: 104, pages: 58 } }), s);
}
/* The reasoning call, at the cadence the server actually sends. */
let ms = 0;
for (let i = 0; i < 5; i++) {
  ms += 8000;
  await p.evaluate(m => window.__KBYS__.onLiveEvent({ t: 'tick', v: {
    ms: m, label: 'Cross-examining the evidence' } }), ms);
  await p.waitForTimeout(8000);
}

const W = await p.evaluate(() => window.__W);
const fails = [];
if (!W.length) fails.push('the bar was never painted');
else {
  const first = W.find(x => x[1] > 0);
  if (!first || Math.round(first[1]) !== 1)
    fails.push('the bar starts at ' + (first ? first[1] : 'nothing') + ' rather than 1%');

  let back = null, lastT = W[0][0], lastV = W[0][1], worst = { d: 0, v: 0, t: 0 };
  for (const [t, v] of W) {
    if (v < lastV - 0.001 && back === null) back = lastV + ' to ' + v;
    if (Math.abs(v - lastV) > 0.0001) {
      const d = t - lastT;
      if (d > worst.d) worst = { d: d, v: lastV, t: lastT };
      lastT = t; lastV = v;
    }
  }
  const tail = W[W.length - 1][0] - lastT;
  const distinct = new Set(W.map(x => x[1])).size;

  if (back) fails.push('the bar goes backwards: ' + back);
  /* Two seconds. Below that the bar reads as alive; the defect this exists to
     catch was seven and a half. */
  if (worst.d > 2000)
    fails.push('the bar stands still for ' + worst.d + 'ms at ' + worst.v.toFixed(2) +
      '% (at ' + worst.t + 'ms into the run)');
  if (tail > 2000)
    fails.push('the bar stands still for the last ' + tail + 'ms of the run, at ' + lastV.toFixed(2) + '%');
  if (lastV >= 100)
    fails.push('the bar reached 100% while the run was still going. Only a finished result writes a hundred');
  if (distinct < 80)
    fails.push('only ' + distinct + ' distinct widths across a forty second reasoning call, which is a bar that steps rather than moves');

  console.log('start ' + (first ? first[1] : 0) + '%, longest stall ' + worst.d + 'ms at ' +
    worst.v.toFixed(2) + '%, trailing ' + tail + 'ms, ' + distinct + ' distinct widths, ends at ' +
    lastV.toFixed(2) + '%');
}
if (errs.length) fails.push('page errors: ' + errs[0]);
await b.close();
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
