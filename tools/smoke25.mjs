/* THE BAR, MEASURED WHILE THE REASONING CALL RUNS.
   The complaint that produced this test: the header bar climbs to ninety and
   then sits there for two minutes. A bar that has stopped is a page that has
   stopped, so this drives the heartbeat the server actually sends and reads the
   bar back at each beat. It must move every time, it must never go backwards,
   and it must never reach a hundred before a result exists. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);

const read = () => p.evaluate(() => window.__KBYS__.bar());
const fire = ev => p.evaluate(e => window.__KBYS__.onLiveEvent(e), ev);

await p.evaluate(() => window.__KBYS__.waitOpen('imacademy.com'));
await p.waitForTimeout(200);

const seen = [];
for (const step of ['plan','retrieve','retrieved','round2','research','reason']) {
  await fire({ t:'phase', v:{ step, label:step, searches:8, categories:10, ok:6, of:104, pages:58 } });
  await p.waitForTimeout(1200);
  seen.push([step, (await read()).wait]);
}
/* Six beats, eight seconds apart, the way the server sends them. */
for (const ms of [8000, 16000, 24000, 40000, 70000, 110000, 180000]) {
  await fire({ t:'tick', v:{ ms, label:'Cross-examining the evidence' } });
  await p.waitForTimeout(120);
  seen.push(['tick ' + Math.round(ms/1000) + 's', (await read()).wait]);
}
/* The partial result claims eighty and can land after ninety. */
await fire({ t:'partial', v:{ board:{}, counts:{ registers_reached:16, pages:58 } } });
await p.waitForTimeout(200);
seen.push(['partial (claims 80)', (await read()).wait]);

seen.forEach(([k,v]) => console.log('  ' + String(k).padEnd(22) + Math.round(v*10)/10 + '%'));

const vals = seen.map(x => x[1]);
let bad = null;
for (let i = 1; i < vals.length; i++) if (vals[i] < vals[i-1] - 0.001) bad = seen[i][0];
if (bad) { console.error('FAIL: the bar went backwards at ' + bad); process.exit(1); }

const ticks = seen.filter(x => String(x[0]).startsWith('tick')).map(x => x[1]);
for (let i = 1; i < ticks.length; i++)
  if (ticks[i] <= ticks[i-1] + 0.05) {
    console.error('FAIL: the bar did not move between heartbeats, which is exactly the parked bar');
    process.exit(1);
  }
if (Math.max(...vals) >= 100) { console.error('FAIL: the bar claimed a hundred before a result existed'); process.exit(1); }
if (Math.max(...vals) < 92) { console.error('FAIL: three minutes of waiting moved the bar less than two points'); process.exit(1); }
if (errs.length) { console.error('FAIL: page errors', errs.slice(0,2)); process.exit(1); }
console.log('PASSED');
await b.close();
