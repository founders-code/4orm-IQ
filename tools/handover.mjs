/* THE HANDOVER, FRAME BY FRAME.
 * Anything dark on screen between the waiting screen and the white report is
 * the flash. Sampled every animation frame across the whole transition. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:1440,height:900} });
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(800);
await p.evaluate(()=>window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(2200);
await p.evaluate(()=>{
  window.__F=[]; const t0=performance.now();
  const tick=()=>{
    const box=document.getElementById('waitBox'), rpt=document.getElementById('rpt');
    const cs=getComputedStyle(box), rs=rpt?getComputedStyle(rpt):null;
    window.__F.push([Math.round(performance.now()-t0),
      document.body.dataset.stage,
      +parseFloat(cs.opacity).toFixed(2),
      rs?+parseFloat(rs.opacity).toFixed(2):null,
      rpt? (rpt.getBoundingClientRect().height>0?1:0) : 0]);
    if(performance.now()-t0<5000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
/* Let it land on its own. The button is disabled until the assessment is
   ready, and once the report is up the overlay is gone so a click on that id
   lands on the document underneath it. */
for(let i=0;i<40;i++){
  if(!await p.evaluate(()=>document.getElementById('waitBox').classList.contains('on'))) break;
  await p.evaluate(()=>{ const x=document.getElementById('waitOk'); if(x && !x.disabled) x.click(); });
  await p.waitForTimeout(400);
}
await p.waitForTimeout(3000);
const F = await p.evaluate(()=>window.__F);
/* a frame is bad if the overlay has faded but the report is not up yet */
const bad = F.filter(f => f[2] < 0.98 && (f[1] !== 'report' || !f[4]));
console.log('frames', F.length, '| dark frames', bad.length);
if(bad.length) console.log('  first:', JSON.stringify(bad.slice(0,4)));
const hand = F.filter(f=>f[1]==='report');
console.log('report up at frame', F.indexOf(hand[0]), 'overlay opacity then', hand[0]&&hand[0][2]);
await b.close();
process.exit(bad.length?1:0);
