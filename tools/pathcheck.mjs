/* THE PATH MAP, AGAINST THE HANDOVER'S OWN ACCEPTANCE CHECKS.
   Section 8 of the handover pack, run rather than eyeballed. Two boxes at
   0.82 scale can look separate and still overlap. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:1920,height:1080} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.goto('file:///home/claude/kbys/build/4orm-iq/admin.html?demo=1', { waitUntil:'load' });
await p.waitForTimeout(2400);

const info = await p.evaluate(()=>{
  const nodes=[...document.querySelectorAll('#pathmap .nnode')];
  const boxes=nodes.map(g=>{ const bb=g.querySelector('rect,path').getBBox();
    return {id:g.getAttribute('data-id'), x:bb.x, y:bb.y, w:bb.width, h:bb.height}; });
  const hits=[];
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i], c=boxes[j];
    if(a.x<c.x+c.w-0.5 && c.x<a.x+a.w-0.5 && a.y<c.y+c.h-0.5 && c.y<a.y+a.h-0.5)
      hits.push(a.id+' x '+c.id); }
  const over=[];
  nodes.forEach(g=>{ const box=g.querySelector('rect,path').getBBox();
    g.querySelectorAll('text').forEach(t=>{ const tb=t.getBBox();
      if(tb.x+tb.width > box.x+box.width-3 || tb.x < box.x-1)
        over.push(g.getAttribute('data-id')+' :: '+t.textContent.slice(0,40)); }); });
  return { count:nodes.length, clicky:document.querySelectorAll('#pathmap .nnode.clicky').length,
    house:document.querySelectorAll('#house .hl').length,
    gauges:document.querySelectorAll('#gauges .gauge').length, hits, over }; });

const fails=[];
const want={count:46, clicky:43, house:2, gauges:5};
for (const k of Object.keys(want))
  if (info[k]!==want[k]) fails.push(k+' is '+info[k]+', the handover says '+want[k]);
if (info.hits.length) fails.push('boxes overlap: '+info.hits.join(', '));
if (info.over.length) fails.push('text outside its box: '+info.over.slice(0,5).join(' | '));
console.log('nodes', info.count, '| clickable', info.clicky, '| header chips', info.house,
            '| dials', info.gauges, '| overlaps', info.hits.length, '| text overruns', info.over.length);

/* 4. every node opens onto something */
const empty = await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('#pathmap .nnode.clicky').forEach(g=>{
    g.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const b=document.getElementById('shB');
    if(!b || b.textContent.trim().length < 60) out.push(g.getAttribute('data-id')); });
  document.querySelectorAll('#house .hl').forEach(b2=>{
    b2.click(); const b=document.getElementById('shB');
    if(!b || b.textContent.trim().length < 60) out.push(b2.getAttribute('data-open')); });
  return out; });
if (empty.length) fails.push('these open onto nothing: '+empty.join(', '));
console.log('nodes opening onto nothing:', empty.length);

/* the chain still offers the walk */
const walk = await p.evaluate(()=>{ window.openLamp('m:chain');
  return !!document.getElementById('walkbtn'); });
if(!walk) fails.push('The chain no longer offers Verify the chain');
await p.evaluate(()=>{ const c=document.getElementById('shC'); c&&c.click(); });

/* 5. faults only leaves nothing lit but red */
await p.evaluate(()=>paint(normalise(TROUBLE)));
await p.waitForTimeout(500);
await p.click('#faultbtn'); await p.waitForTimeout(700);
const lit = await p.evaluate(()=>[...document.querySelectorAll('#pathmap path.pipe')]
  .filter(x=>parseFloat(getComputedStyle(x).opacity) > 0.06).map(x=>x.getAttribute('class')));
const litSet=[...new Set(lit)];
console.log('lit pipe classes in faults mode:', JSON.stringify(litSet));
const bad = litSet.filter(c=>!/dead/.test(c));
if (bad.length) fails.push('faults only leaves non-red pipework lit: '+bad.join(', '));
const readerLit = await p.evaluate(()=>{ const r=document.getElementById('reader');
  return parseFloat(getComputedStyle(r).opacity) > 0.5 && !r.classList.contains('fdim'); });
if(!readerLit) fails.push('faults only dimmed the reader screen');
await p.click('#faultbtn'); await p.waitForTimeout(400);

/* 6. no scrollbar at either size */
for (const [w,h] of [[1920,1080],[1440,900]]) {
  await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(700);
  const sc = await p.evaluate(()=>({ x:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    y:document.documentElement.scrollHeight-document.documentElement.clientHeight }));
  console.log(w+'x'+h, 'overflow x', sc.x, 'y', sc.y);
  if (sc.x>1 || sc.y>1) fails.push(w+'x'+h+' scrolls: x '+sc.x+' y '+sc.y);
}
console.log('errors:', errs.join(' | ') || 'none');
if (errs.length) fails.push('console/page errors: '+errs.join(' | '));
if (fails.length) { console.log('\nFAILED'); fails.forEach(f=>console.log('  '+f)); await b.close(); process.exit(1); }
console.log('\nPASSED');
await b.close();
