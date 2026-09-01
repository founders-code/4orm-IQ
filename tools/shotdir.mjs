/* Find support, on the light ground. Shot from the landing, where most people
   reach it, and from the report, where the pill also lives. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(1000);
await p.click('[data-dir="open"]');
await p.waitForTimeout(700);
await p.screenshot({ path:'/tmp/d1.png' });
await p.evaluate(()=>document.getElementById('dirPane').scrollTo({top:900}));
await p.waitForTimeout(400);
await p.screenshot({ path:'/tmp/d2.png' });
await p.evaluate(()=>document.getElementById('dirPane').scrollTo({top:2400}));
await p.waitForTimeout(400);
await p.screenshot({ path:'/tmp/d3.png' });
console.log('phone numbers visible:', await p.evaluate(()=>document.querySelectorAll('#dirPane a[href^="tel:"]').length));
console.log('sections:', await p.evaluate(()=>document.querySelectorAll('#dirPane .dsec').length));
console.log('errors', errs.length);
await b.close();
