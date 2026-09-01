/* What this measures, and why it is neither getBBox() nor getBoundingClientRect().
   getBBox() on a rotated <text> reports the box BEFORE the transform, so every
   clip check that used it read the wrong rectangle and passed while names ran
   off the frame. getBoundingClientRect() reports the AXIS-ALIGNED box around
   the rotated one, which for a label lying at forty-five degrees is far larger
   than the label and reports collisions that nobody can see. So this takes the
   pre-transform box, pushes its four corners through the element's own screen
   matrix, and compares the resulting quadrilaterals with the separating axis
   test. That is the shape a reader actually sees. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);
await p.evaluate(()=>window.__KBYS__.check('investhelm.com'));
await p.waitForTimeout(1400);
const out = await p.evaluate(()=>{
  const svg = document.getElementById('netSvg');
  const box = svg.getBoundingClientRect();
  const root = svg.getScreenCTM();
  const corners = el => {
    const bb = el.getBBox(), m = el.getScreenCTM();
    return [[bb.x,bb.y],[bb.x+bb.width,bb.y],[bb.x+bb.width,bb.y+bb.height],[bb.x,bb.y+bb.height]]
      .map(([x,y])=>({ x: m.a*x + m.c*y + m.e, y: m.b*x + m.d*y + m.f }));
  };
  const sat = (A,B) => {
    for (const poly of [A,B]) {
      for (let i=0;i<poly.length;i++){
        const p1=poly[i], p2=poly[(i+1)%poly.length];
        const ax=-(p2.y-p1.y), ay=p2.x-p1.x;
        let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;
        for(const q of A){ const v=q.x*ax+q.y*ay; a0=Math.min(a0,v); a1=Math.max(a1,v); }
        for(const q of B){ const v=q.x*ax+q.y*ay; b0=Math.min(b0,v); b1=Math.max(b1,v); }
        if (a1 < b0 + 1 || b1 < a0 + 1) return false;
      }
    }
    return true;
  };
  const labs = [...svg.querySelectorAll('text.netname')]
    .map(t=>({ n:t.getAttribute('aria-label'), c:corners(t) }));
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9; const clipped=[];
  for(const L of labs){
    let out=false;
    for(const q of L.c){
      minX=Math.min(minX,q.x); minY=Math.min(minY,q.y);
      maxX=Math.max(maxX,q.x); maxY=Math.max(maxY,q.y);
      if(q.x<box.left-0.5||q.x>box.right+0.5||q.y<box.top-0.5||q.y>box.bottom+0.5) out=true;
    }
    if(out) clipped.push(L.n);
  }
  const ov=[];
  for(let i=0;i<labs.length;i++)for(let j=i+1;j<labs.length;j++)
    if(sat(labs[i].c,labs[j].c)) ov.push(labs[i].n+' / '+labs[j].n);
  const cards=document.getElementById('eduCard');
  return {
    box:{w:Math.round(box.width),h:Math.round(box.height),ratio:+(box.width/box.height).toFixed(2)},
    used:{w:Math.round(maxX-minX),h:Math.round(maxY-minY)},
    fill:Math.round((maxX-minX)/box.width*100)+'% wide, '+Math.round((maxY-minY)/box.height*100)+'% tall',
    labels:labs.length, clipped:clipped.length, clippedNames:clipped.slice(0,10),
    overlaps:ov.length, overlapNames:ov.slice(0,10),
    cardsBottom: cards ? Math.round(cards.getBoundingClientRect().bottom) : null,
    netTop: Math.round(box.top), labelTop: Math.round(minY)
  };
});
console.log(out);
await b.close();
