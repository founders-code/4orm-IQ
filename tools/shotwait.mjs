import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(1200);
await p.evaluate(()=>{const l=document.querySelector('#room .lit'); if(l){l.style.animationPlayState='paused';l.style.animationDelay='0s';}});
await p.screenshot({ path:'/tmp/w-landing.png' });
await p.fill('#kbInput','atlanticglobalwealth.com');
await p.waitForTimeout(300);
await p.screenshot({ path:'/tmp/w-typing.png' });
await p.click('#kbGo');
await p.waitForTimeout(2400);
await p.screenshot({ path:'/tmp/w-chat.png' });
const pick = async t => { const l=p.locator('.pill',{hasText:t}).first(); await l.waitFor({timeout:8000}); await l.click(); };
await pick('An investment'); await p.waitForTimeout(1400);
await pick('I have not sent anything yet'); await p.waitForTimeout(3500);
await p.screenshot({ path:'/tmp/w-wait.png' });
const over = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
/* Measure the labels where they actually land. getBBox on a rotated <text>
   reports its box BEFORE the rotation, so every earlier clip check here was
   reading the wrong rectangle and passing while names ran off the frame.
   Screen rectangles are the truth. */
const clip = await p.evaluate(() => {
  const svg = document.getElementById('netSvg'); if (!svg) return 'no svg';
  const box = svg.getBoundingClientRect();
  const bad = [];
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  svg.querySelectorAll('text.netname').forEach(n => {
    const q = n.getBoundingClientRect();
    l = Math.min(l, q.left); r = Math.max(r, q.right);
    t = Math.min(t, q.top);  b = Math.max(b, q.bottom);
    if (q.left < box.left - 1 || q.right > box.right + 1 ||
        q.top < box.top - 1 || q.bottom > box.bottom + 1) bad.push(n.textContent);
  });
  return { labels: svg.querySelectorAll('text.netname').length,
           clipped: bad.length, first: bad[0] || null,
           box: { w: Math.round(box.width), h: Math.round(box.height) },
           used: { w: Math.round(r - l), h: Math.round(b - t) },
           fill: +(((r - l) / box.width) * 100).toFixed(0) + '% wide, '
               + +(((b - t) / box.height) * 100).toFixed(0) + '% tall' };
});
console.log('overflow',over,'| net',JSON.stringify(clip),'| errors',errs.length, errs[0]||'');
await b.close();
