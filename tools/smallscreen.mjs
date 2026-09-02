/* THE PHONE, AND THE SHORT WINDOW.
 *
 * Four rounds of review shot the desktop and passed. Every defect that was left
 * was a defect of a narrow or a SHORT viewport, and the two are not the same
 * thing: 390x844 is the device, 390x664 is the device with a browser's chrome
 * on it, and only the second is what a person actually holds.
 *
 * What this file caught, and exists to keep caught:
 *   the answer "No. A regulator has recorded a problem" set twelve lines deep
 *   at one to three characters a line, and the domain broken as
 *   "atlanticglobalweal / th.com", because a nowrap label at 220px left the
 *   value 24 pixels inside a card the grid had pinned to 340;
 *   the education dots, the only control on the waiting screen, hanging five
 *   pixels off the bottom of a 360x640 window;
 *   the caption carrying the register counts cut off by an overflow on every
 *   window shorter than a full device;
 *   the register web drawn at zero height, and then drawn sliced through the
 *   middle of a glyph when a floor was put under it;
 *   a finding's text column at 126 pixels, thirteen characters a line, because
 *   flex-wrap without a basis wraps nothing.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const fails=[];
console.log('THE IDENTITY ROWS, WHERE THE CARD IS NARROW');
/* 1. the identity rows */
for (const [w,h] of [[1440,1000],[1080,900],[900,900],[820,900],[700,900],[640,900],[480,900],[390,844],[360,780]]) {
  const p = await b.newPage({ viewport:{width:w,height:h} });
  await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
  await p.waitForTimeout(700);
  await p.evaluate(()=>window.__KBYS__.check('atlanticglobalwealth.com'));
  await p.waitForTimeout(2600);
  for(let i=0;i<6;i++){ if(!await p.evaluate(()=>document.getElementById('waitBox').classList.contains('on'))) break;
    await p.click('#waitOk'); await p.waitForTimeout(400); }
  await p.waitForTimeout(600);
  const r = await p.evaluate(()=>{
    const out={};
    /* widest value column and its line count */
    let worst=null;
    for(const row of document.querySelectorAll('#rpReport .rp-idrow')){
      const v=row.querySelector('.rp-idv'); if(!v) continue;
      const cs=getComputedStyle(v), lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.4;
      const lines=Math.round(v.getBoundingClientRect().height/lh);
      const wd=Math.round(v.getBoundingClientRect().width);
      if(!worst||wd<worst.w) worst={w:wd,lines,k:row.querySelector('.rp-idk').textContent.trim()};
    }
    out.idv=worst;
    /* horizontal overflow */
    out.scroll=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  const bad = r.idv && (r.idv.w < 150 || r.idv.lines > 3);
  console.log(String(w).padStart(5)+'  narrowest value '+String(r.idv.w).padStart(4)+'px / '+r.idv.lines+' lines  ('+r.idv.k+')   hscroll '+r.scroll+(bad?'   <-- BAD':''));
  if(bad) fails.push(w+': value column '+r.idv.w+'px over '+r.idv.lines+' lines');
  if(r.scroll>0) fails.push(w+': the page scrolls sideways by '+r.scroll+'px');
  await p.close();
}
console.log('THE WAITING SCREEN ON A SHORT WINDOW');
for (const [w,h] of [[390,844],[390,664],[414,716],[360,780],[360,640],[430,700],[820,900],[820,760],[820,600],[768,650],[821,760]]) {
  const p = await b.newPage({ viewport:{width:w,height:h} });
  await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
  await p.waitForTimeout(700);
  await p.evaluate(()=>window.__KBYS__.check('atlanticglobalwealth.com'));
  await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const body=document.querySelector('.waitbody').getBoundingClientRect();
    const inside=e=>{ if(!e) return 'absent'; const s=getComputedStyle(e);
      if(s.display==='none') return 'hidden';
      const k=e.getBoundingClientRect();
      if(k.height===0) return 'ZERO HEIGHT';
      return k.bottom<=body.bottom+1 && k.top>=body.top-1 ? 'visible' : 'CLIPPED'; };
    /* The caption sits OUTSIDE .waitbody now, on purpose, so it is measured
       against the panel rather than against the column it left. */
    const box=document.getElementById('waitBox').getBoundingClientRect();
    const capEl=document.getElementById('netCap');
    const capR=capEl?capEl.getBoundingClientRect():null;
    const cap = !capEl ? 'absent'
      : getComputedStyle(capEl).display==='none' ? 'hidden'
      : capR.height===0 ? 'ZERO HEIGHT'
      : (capR.bottom<=box.bottom+1 && capR.top>=box.top-1) ? 'visible' : 'CLIPPED';
    return { cap,
             dots:inside(document.getElementById('eduDots')),
             card:inside(document.getElementById('eduCard')),
             svg:inside(document.getElementById('netSvg')) };
  });
  const bad = ['cap','dots','card'].filter(k=>r[k]!=='visible' && r[k]!=='hidden');
  if(r.svg==='ZERO HEIGHT'||r.svg==='CLIPPED') bad.push('svg='+r.svg);
  console.log(`  ${w}x${h}  card ${r.card}  dots ${r.dots}  caption ${r.cap}  web ${r.svg}` + (bad.length?'   <-- BAD':''));
  if(bad.length) fails.push(w+'x'+h+': '+bad.map(k=>k+' '+(r[k]||'')).join(', '));
  await p.close();
}
console.log('\nTHE FINDINGS MEASURE ON A PHONE');
for (const w of [1440,640,560,480,390,360]) {
  const p = await b.newPage({ viewport:{width:w,height:900} });
  await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
  await p.waitForTimeout(700);
  await p.evaluate(()=>window.__KBYS__.check('atlanticglobalwealth.com'));
  await p.waitForTimeout(2600);
  for(let i=0;i<6;i++){ if(!await p.evaluate(()=>document.getElementById('waitBox').classList.contains('on'))) break;
    await p.click('#waitOk'); await p.waitForTimeout(380); }
  await p.waitForTimeout(500); await p.click('#rpToFound'); await p.waitForTimeout(500);
  const r = await p.evaluate(()=>{
    const b=document.querySelector('#rpFound .rp-find .rp-b');
    return b?Math.round(b.getBoundingClientRect().width):0; });
  const bad = w<=640 ? r<250 : r<400;
  console.log(`  ${String(w).padStart(5)}  finding text column ${r}px` + (bad?'   <-- BAD':''));
  if(bad) fails.push(w+': the finding text column is '+r+'px');
  await p.close();
}
await b.close();
console.log('\n'+(fails.length?'FAILED':'PASSED'));
fails.forEach(f=>console.log('  '+f));
process.exit(fails.length?1:0);
