/* The thread on the landing, shot at each step.
   The four identifier chips and the context chip row are gone: the questions
   are asked in the thread after somebody submits, not under their cursor while
   they are still typing. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(1300);
await p.evaluate(()=>{const l=document.querySelector('#room .lit'); if(l){l.style.animationPlayState='paused';l.style.animationDelay='0s';}});
await p.screenshot({ path: '/tmp/ctx-0.png' });
await p.fill('#kbInput','atlanticglobalwealth.com');
await p.waitForTimeout(300);
/* Nothing may appear while somebody is typing. */
const early = await p.evaluate(()=>{
  const c = document.querySelector('.chat');
  return !!c && !c.hasAttribute('hidden') && c.getBoundingClientRect().height > 2;
});
console.log('thread opened before submit:', early, early ? '  <-- WRONG' : '');
await p.screenshot({ path: '/tmp/ctx-1.png' });
await p.click('#kbGo');
await p.waitForTimeout(2400);
await p.screenshot({ path: '/tmp/ctx-2.png' });
const pick = async t => { const l=p.locator('.pill',{hasText:t}).first(); await l.waitFor({timeout:9000}); await l.click(); };
await pick('A vehicle');
await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/ctx-3.png' });
/* A private seller holds no licence, and the thread has to ask before it can
   avoid reading that absence as a red flag. */
await pick('A private seller');
await p.waitForTimeout(1500);
await pick('I am just doing my homework');
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/ctx-4.png' });
console.log('context sent with the run:', JSON.stringify(await p.evaluate(()=>window.__KBYS__.runCtx())));
const overflow = await p.evaluate(()=>document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log('horizontal overflow:', overflow);
await b.close();
console.log('ok');
