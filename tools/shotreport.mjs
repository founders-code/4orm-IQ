/* The three screens of the report, plus sources and method reached from the
   landing, where there is no result to go back to. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(1000);

/* From the landing, before any check has been run. */
await p.click('#navSources');
await p.waitForTimeout(500);
await p.screenshot({ path:'/tmp/r-sources-landing.png', fullPage:false });
console.log('back button says:', await p.textContent('#rpBackToReportT'));
await p.click('#rpBackToReport');
await p.waitForTimeout(400);
console.log('returned to:', await p.evaluate(()=>document.body.getAttribute('data-stage')));

await p.evaluate(()=>window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(3000);
/* Acknowledge once, then again only if the panel is still up. Clicking a
   handle that is no longer on screen waits thirty seconds and then fails. */
for (let i = 0; i < 6; i++) {
  const up = await p.evaluate(()=>document.getElementById('waitBox').classList.contains('on'));
  if (!up) break;
  await p.click('#waitOk'); await p.waitForTimeout(500);
}
await p.waitForTimeout(1200);
const at = async () => p.evaluate(()=>[...document.querySelectorAll('#rpt .rp-sheet')]
  .filter(s=>!s.hidden).map(s=>s.id));
console.log('screen 1:', await at());
await p.screenshot({ path:'/tmp/r1.png', fullPage:true });
await p.click('#rpToFound'); await p.waitForTimeout(700);
console.log('screen 2:', await at());
await p.screenshot({ path:'/tmp/r2.png', fullPage:true });
await p.click('#rpToAct'); await p.waitForTimeout(700);
console.log('screen 3:', await at());
await p.screenshot({ path:'/tmp/r3.png', fullPage:true });
await p.click('#rpActBack'); await p.waitForTimeout(500);
console.log('back from act:', await at());
await p.click('#rpFoundBack'); await p.waitForTimeout(500);
console.log('back from found:', await at());
await p.click('#rpToSources_report'); await p.waitForTimeout(500);
console.log('sources from report:', await at(), '| back says:', await p.textContent('#rpBackToReportT'));
await p.click('#rpBackToReport'); await p.waitForTimeout(500);
console.log('back to:', await at());
const over = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
console.log('overflow', over, '| errors', errs.length, errs.slice(0,2));
await b.close();
