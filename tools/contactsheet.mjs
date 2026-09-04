/* SWEEP: keep. This renders every screen in every state onto one sheet so a
   person can look at the whole product at once. It asserts nothing on purpose:
   its output is for eyes, and the eyes are the check. */
/* EVERY SCREEN, EVERY STATE, LOOKED AT.
 *
 * This is the thing that was missing. Thirty-seven checks passed on a page
 * whose nine document packs had eight unstyled classes and rendered as a wall
 * of plain sentences, because no test that reads behaviour can see that a page
 * looks unfinished. This one produces the pictures; a person looks at them.
 *
 * Run it, then open /tmp/sheet and go through them.
 */
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = '/tmp/sheet';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const W = Number(process.argv[2] || 1440), H = Number(process.argv[3] || 1000);
const tag = process.argv[4] || (W + 'x' + H);
const errs = [];
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', e => errs.push(String(e)));
const shot = async (n, full) => {
  await p.screenshot({ path: `${OUT}/${tag}-${n}.png`, fullPage: !!full });
  console.log('  ' + tag + '-' + n);
};
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);

await shot('01-landing');
await p.click('[data-dir="open"]'); await p.waitForTimeout(700);
await shot('02-support', true);
await p.click('#dirClose').catch(()=>p.click('.dirclose'));
await p.waitForTimeout(500);
await p.click('#navSources'); await p.waitForTimeout(600);
await shot('03-sources-from-landing', true);
await p.click('#rpBackToReport'); await p.waitForTimeout(500);

/* the thread */
await p.evaluate(()=>{ const i=document.getElementById('kbInput');
  i.value='Goliath Ventures'; i.dispatchEvent(new Event('input',{bubbles:true})); });
await p.evaluate(()=>document.getElementById('kbForm').requestSubmit());
await p.waitForTimeout(2200);
await shot('04-thread');
for (const label of ['An investment','I have not sent anything yet']) {
  const btn = await p.$(`#kbChat button:has-text("${label}")`);
  if (btn) { await btn.click(); await p.waitForTimeout(1400); }
}
await shot('05-thread-answered');

/* the wait */
await p.waitForTimeout(1200);
await shot('06-wait');

/* the report */
/* Let the check land on its own rather than clicking through, which is what a
   reader does anyway. The button is disabled until the assessment is ready. */
for (let i=0;i<40;i++){
  if(!await p.evaluate(()=>document.getElementById('waitBox').classList.contains('on'))) break;
  await p.evaluate(()=>{ const b=document.getElementById('waitOk'); if(b && !b.disabled) b.click(); });
  await p.waitForTimeout(400);
}
await p.waitForTimeout(1200);
await shot('07-result', true);
await p.click('#rpToFound'); await p.waitForTimeout(600);
await shot('08-found', true);
await p.click('#rpToAct'); await p.waitForTimeout(600);
await p.evaluate(()=>document.querySelectorAll('#rpAct details').forEach(d=>d.open=true));
await p.waitForTimeout(400);
await shot('09-act', true);

/* every one of the nine packs */
const paks = await p.$$('#rpAct .rp-pak');
for (let i=0;i<paks.length;i++){
  await paks[i].click(); await p.waitForTimeout(500);
  await p.evaluate(()=>{ const x=document.getElementById('rpPvBody'); if(x) x.scrollTop=0; });
  await shot('10-pack-' + String(i+1).padStart(2,'0'));
  const btm = await p.evaluate(()=>{ const x=document.getElementById('rpPvBody');
    return x ? x.scrollHeight > x.clientHeight : false; });
  if (btm) {
    await p.evaluate(()=>{ const x=document.getElementById('rpPvBody'); x.scrollTop=x.scrollHeight; });
    await p.waitForTimeout(250);
    await shot('10-pack-' + String(i+1).padStart(2,'0') + 'b');
  }
  await p.click('#rpPvX'); await p.waitForTimeout(400);
}

await p.click('#rpToSources_act'); await p.waitForTimeout(600);
await shot('11-sources', true);
await p.click('#rpBackToReport'); await p.waitForTimeout(500);
await p.click('#rpDownloadSummary'); await p.waitForTimeout(800);
await shot('12-summary', true);
await p.click('#sumClose'); await p.waitForTimeout(500);
await p.click('#rpOpenRecord'); await p.waitForTimeout(1600);
/* the room introduces itself the first time it is opened */
await shot('13a-walkthrough');
for (let i=0;i<7;i++){
  if (await p.evaluate(()=>document.getElementById('wk').hidden)) break;
  await p.click('#wkNext'); await p.waitForTimeout(500);
}
await p.waitForTimeout(300);
await shot('13-console', true);

/* Back to the report, then the new check control, then the way back in. The
   three screens that used to have no picture at all. */
await p.click('#navBackReport'); await p.waitForTimeout(700);
/* the data room returns to the screen it was opened from, whichever that was,
   so walk back with whatever back control is actually on screen until the
   result is up. The new check pill lives only there. */
for (let i=0;i<4;i++){
  if (await p.evaluate(()=>!document.getElementById('rpReport').hidden)) break;
  const back = await p.$('#rpt .rp-sheet:not([hidden]) .rp-back');
  if (!back) break;
  await back.click(); await p.waitForTimeout(600);
}
await p.click('#rpNewCheck'); await p.waitForTimeout(900);
await shot('14-after-new-check');
await p.click('#lastOpen'); await p.waitForTimeout(900);
await shot('15-resumed', true);

console.log('\npage errors:', errs.length, errs[0] || '');
await b.close();
