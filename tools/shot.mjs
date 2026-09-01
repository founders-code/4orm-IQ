import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html');
await p.waitForTimeout(1400);
/* Freeze the flicker at three points in the cycle so the range is visible in
   stills rather than guessed at. */
for (const [name, t] of [['bright','0s'],['mid','-7.2s'],['dip','-7.13s']]) {
  await p.evaluate((delay) => {
    const l = document.querySelector('#room .lit');
    l.style.animationPlayState = 'paused';
    l.style.animationDelay = delay;
  }, t);
  await p.waitForTimeout(120);
  await p.screenshot({ path: '/tmp/room-'+name+'.png' });
}
await b.close();
console.log('shots taken');
