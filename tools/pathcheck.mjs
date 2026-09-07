/* THE PATH MAP, AGAINST THE HANDOVER'S OWN ACCEPTANCE CHECKS.
   Section 8 of the handover pack, run rather than eyeballed. Two boxes at
   0.82 scale can look separate and still overlap. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:1920,height:1080} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.goto('file:///home/claude/kbys/build/4orm-iq/admin.html?demo=1', { waitUntil:'load' });
await p.waitForTimeout(2400);

/* Revision 3's own acceptance checks, run on BOTH data sets. The trouble data
   has longer readings and is what catches an overflow. */
const probe = ()=>{
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
  const svg=document.querySelector('#pathmap svg'), vb=svg.viewBox.baseVal;
  /* a lane plate shaved by the left edge of the viewBox */
  const clip=[...svg.querySelectorAll('.lanelab,.lanesub')]
    .filter(t=>t.getBBox().x < vb.x).map(t=>t.textContent);
  /* THE STAIRCASE RULE. Below the retrieval foot bar no flow segment may
     travel leftwards. Taps and the second-pass loop are exempt: a reading is
     not the flow, and the loop is the one deliberate return. */
  const backwards=[...svg.querySelectorAll('path.pipe')].filter(x=>{
    const c=x.getAttribute('class'); if(/tap|loop/.test(c)) return false;
    const pts=[...x.getAttribute('d').matchAll(/([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)/g)]
      .map(m=>[+m[2], +m[3]]);
    if(pts[0][1] < 654) return false;
    for(let i=1;i<pts.length;i++) if(pts[i][0] < pts[i-1][0]-0.5) return true;
    return false; }).map(x=>x.getAttribute('d'));
  /* an arrowhead into a reading says the reading is a stage */
  const arrowIntoMeter=[...svg.querySelectorAll('path.pipe.tap')]
    .filter(x=>x.getAttribute('marker-end')).length;
  return { count:nodes.length, clicky:document.querySelectorAll('#pathmap .nnode.clicky').length,
    meters:document.querySelectorAll('#pathmap .nnode[data-kind="meter"]').length,
    panellamps:document.querySelectorAll('#house .pgl').length,
    fullbtn:document.querySelectorAll('#fullbtn').length,
    registry:document.querySelectorAll('#registry .regrow').length,
    gauges:document.querySelectorAll('#gauges .gauge').length,
    hits, over, clip, backwards, arrowIntoMeter }; };

const info = await p.evaluate(probe);

const fails=[];
/* The handover's numbers, moved on twice since it was written. The two lamps
   that watch this panel rather than the check left the drawing header for the
   masthead, where a lamp about the panel belongs, and the header now carries
   the full-screen control instead. The dials went from five to six when the
   one register number that was answering two different questions was split
   into how wide we looked and how often an ask came back. */
const want={count:46, clicky:43, panellamps:2, gauges:6, meters:5};
for (const k of Object.keys(want))
  if (info[k]!==want[k]) fails.push(k+' is '+info[k]+', the handover says '+want[k]);
if (info.hits.length) fails.push('boxes overlap: '+info.hits.join(', '));
if (info.over.length) fails.push('text outside its box: '+info.over.slice(0,5).join(' | '));
console.log('nodes', info.count, '| clickable', info.clicky, '| panel lamps', info.panellamps,
            '| dials', info.gauges, '| overlaps', info.hits.length, '| text overruns', info.over.length);
if (info.fullbtn !== 1) fails.push('the full screen control is not on the drawing header');
if (info.clip.length) fails.push('a lane plate is shaved at the left edge: ' + info.clip.join(', '));
if (info.backwards.length)
  fails.push(info.backwards.length + ' flow segment(s) below the retrieval foot bar travel leftwards. '
    + 'The staircase rule is what stops the eye going backwards: ' + info.backwards[0]);
if (info.arrowIntoMeter) fails.push('an arrowhead points into a reading, which says the reading is a stage');

/* AGAIN ON THE TROUBLE DATA. Longer readings, and it is what catches an
   overflow that the clear data hides. */
{
  await p.evaluate(()=>paint(normalise(TROUBLE)));
  await p.waitForTimeout(600);
  const t = await p.evaluate(probe);
  console.log('on trouble data: nodes', t.count, '| overlaps', t.hits.length,
    '| text overruns', t.over.length, '| backwards', t.backwards.length);
  if (t.count !== 46) fails.push('the trouble board draws ' + t.count + ' nodes, not 46');
  if (t.hits.length) fails.push('boxes overlap on the trouble data: ' + t.hits.join(', '));
  if (t.over.length) fails.push('text runs outside its box on the trouble data: ' + t.over.slice(0,4).join(' | '));
  if (t.backwards.length) fails.push('the trouble board turns back to the left: ' + t.backwards[0]);
  if (t.clip.length) fails.push('a lane plate is shaved on the trouble data');
  await p.evaluate(()=>paint(normalise(CLEAR)));
  await p.waitForTimeout(500);
}

/* 4. every node opens onto something */
const empty = await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('#pathmap .nnode.clicky').forEach(g=>{
    g.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const b=document.getElementById('shB');
    if(!b || b.textContent.trim().length < 60) out.push(g.getAttribute('data-id')); });
  document.querySelectorAll('#house .pgl').forEach(b2=>{
    b2.click(); const b=document.getElementById('shB');
    if(!b || b.textContent.trim().length < 60) out.push(b2.getAttribute('data-open')); });
  return out; });
if (empty.length) fails.push('these open onto nothing: '+empty.join(', '));
console.log('nodes opening onto nothing:', empty.length);

/* EVERY REGISTER OPENS, IN BOTH SIZES.
   All 121, walked. A name and a colour raise two questions and this is where
   they are answered: what the thing is, and what an empty answer from it
   would mean. */
{
  let opened = 0, noLink = 0, silent = [];
  for (let ci = 0; ci < 10; ci++) {
    await p.evaluate(i => window.openStage(i), ci);
    await p.waitForTimeout(60);
    const names = await p.evaluate(() =>
      [...document.querySelectorAll('#shB .plate')].map(x => x.getAttribute('data-reg')));
    for (const nm of names) {
      await p.evaluate(i => window.openStage(i), ci);
      await p.evaluate(n => { const b = [...document.querySelectorAll('#shB .plate')]
        .find(x => x.getAttribute('data-reg') === n); b && b.click(); }, nm);
      const card = await p.evaluate(() => ({
        t: document.getElementById('shT').textContent,
        body: document.getElementById('shB').innerText,
        link: !!document.querySelector('#shB .reglink'),
        back: !!document.getElementById('regBack') }));
      opened++;
      if (card.t !== nm) silent.push(nm + ' opened as "' + card.t + '"');
      else if (card.body.trim().length < 140) silent.push(nm + ' opened onto almost nothing');
      else if (!card.back) silent.push(nm + ' has no way back');
      if (!card.link) noLink++;
    }
  }
  console.log('registers opened', opened, '| computed here, no outside link', noLink);
  if (opened !== 121) fails.push('only ' + opened + ' of 121 registers open');
  if (silent.length) fails.push(silent.length + ' register card(s) are wrong: ' + silent.slice(0,4).join(' | '));
  /* The ones with no link are the ones we compute. If every register had a
     link, one of them would be borrowing somebody else's name. */
  if (noLink < 10 || noLink > 30)
    fails.push(noLink + ' registers have no outside address. Expected the computed ones, near 19.');
}

/* THE LEGEND, and full screen carrying the same clicks. */
{
  await p.evaluate(() => document.getElementById('shC').click());
  await p.click('#legendbtn'); await p.waitForTimeout(300);
  const leg = await p.evaluate(() => ({ t: document.getElementById('shT').textContent,
    rows: document.querySelectorAll('#shB dt').length }));
  if (leg.rows < 5) fails.push('the legend explains ' + leg.rows + ' things, expected at least five');
  await p.evaluate(() => document.getElementById('shC').click()); await p.waitForTimeout(200);

  await p.click('#fullbtn'); await p.waitForTimeout(600);
  await p.evaluate(() => { const g = [...document.querySelectorAll('#pathmap .nnode')]
    .find(x => x.getAttribute('data-id') === 'cat7'); g.dispatchEvent(new MouseEvent('click',{bubbles:true})); });
  await p.waitForTimeout(350);
  const fs2 = await p.evaluate(() => {
    const card = document.querySelector('.sheetcard').getBoundingClientRect();
    const sh = getComputedStyle(document.getElementById('sheet'));
    return { title: document.getElementById('shT').textContent,
      onscreen: card.width > 200 && card.top >= 0 && card.top < innerHeight,
      z: parseInt(sh.zIndex), pos: sh.position }; });
  console.log('full screen: category opens =', fs2.title, '| card on screen =', fs2.onscreen);
  if (!fs2.onscreen) fails.push('in full screen the card opens off screen or behind the drawing');
  if (fs2.z <= 70 || fs2.pos !== 'fixed') fails.push('in full screen the card is under the panel');
  await p.evaluate(() => document.getElementById('shC').click());
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
}

/* the lamp sheet is left open by the loop above and would swallow the clicks */
await p.evaluate(()=>{ const c=document.getElementById('shC'); c && c.click(); });
await p.waitForTimeout(400);

/* THE REGISTRY. Ten rows, the posture quoted rather than written, and shut
   means shut: a faded overlay that keeps its controls in the tab order is
   invisible and reachable at the same time. */
/* THE REGISTRY. One control, one screen, and it is the white one: the list,
   what each document governs and where it stands, and the document itself.
   The dark panel that used to answer here is gone. */
{
  const shut = await p.evaluate(()=>{ const e=document.getElementById('docreg');
    return e.hasAttribute('inert') && e.getAttribute('aria-hidden')==='true'; });
  if (!shut) fails.push('the registry is shut and still in the tab order');
  await p.click('#regbtn'); await p.waitForTimeout(500);
  const reg = await p.evaluate(()=>({
    rows: document.querySelectorAll('#docreg .drrow').length,
    sup:  document.querySelectorAll('#docreg .drsrow').length,
    post: (document.querySelector('#docreg .drpost')||{innerText:''}).innerText,
    inert: document.getElementById('docreg').hasAttribute('inert'),
    kicker: document.getElementById('drK').textContent.trim(),
    ids:  [...document.querySelectorAll('#docreg .drrow .drid')].map(x=>x.textContent.trim()) }));
  console.log('registry rows', reg.rows, '| supporting', reg.sup, '|', reg.kicker);
  if (reg.rows !== 11) fails.push('the registry is '+reg.rows+' documents, not eleven');
  if (reg.sup !== 3) fails.push('the registry lists '+reg.sup+' supporting records, not three');
  if (reg.kicker !== 'The registry')
    fails.push('the screen the registry pill opens does not call itself the registry');
  if (reg.inert) fails.push('the registry is open and still inert');
  if (!/NOT READY FOR UNCONDITIONAL PUBLIC LAUNCH/.test(reg.post))
    fails.push('the registry does not carry the release posture');
  if (!/NO-GO/.test(reg.post)) fails.push('the release posture no longer says NO-GO');
  if (!reg.ids.includes('CDP-001')) fails.push('the counsel pack is not listed under its own id');
  if (!reg.ids.includes('PIA-001')) fails.push('the privacy assessment is not among the eleven');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  if (await p.evaluate(()=>document.getElementById('docreg').classList.contains('on')))
    fails.push('Escape does not close the registry');
}

/* FULL SCREEN. The drawing has to get bigger and come back. */
{
  const before = await p.evaluate(()=>Math.round(document.querySelector('.pathwrap').getBoundingClientRect().width));
  await p.click('#fullbtn'); await p.waitForTimeout(700);
  const after = await p.evaluate(()=>Math.round(document.querySelector('.pathwrap').getBoundingClientRect().width));
  console.log('map width', before, '->', after);
  if (after <= before) fails.push('full screen did not make the drawing bigger');
  if (!await p.evaluate(()=>document.getElementById('fullbtn').getAttribute('aria-pressed')==='true'))
    fails.push('the full screen control does not report its pressed state');

  /* AND THE TYPE IT PUTS ON THE GLASS.
     Full screen carries its own, larger set of label sizes, and a label that
     is bigger than the plate it sits on is worse than one that is too small.
     This measures every label against its own box on both datasets, and it
     reports what the tightest one has left, so the next person to raise a
     size can see how much room they are spending. */
  const labels = async (set) => {
    await p.evaluate(n => paint(normalise(window[n])), set);
    await p.waitForTimeout(450);
    return p.evaluate(() => {
      const out = [];
      document.querySelectorAll('#pathmap .nnode').forEach(g => {
        const box = g.querySelector('.nbox,.decbox,.regbox,.chipbox,.exitbox,.meterbox');
        if (!box) return;
        const bb = box.getBBox();
        g.querySelectorAll('text').forEach(t => {
          const tb = t.getBBox();
          const over = Math.max(0, bb.x - tb.x) + Math.max(0, (tb.x + tb.width) - (bb.x + bb.width));
          out.push({ t: t.textContent.slice(0, 26), over: Math.round(over * 10) / 10,
                     slack: Math.round((bb.width - tb.width) * 10) / 10 });
        });
      });
      out.sort((a, b) => a.slack - b.slack);
      return { over: out.filter(o => o.over > 0.5), tightest: out[0], n: out.length };
    });
  };
  for (const set of ['CLEAR', 'TROUBLE']) {
    const L = await labels(set);
    console.log('full screen labels on ' + set.toLowerCase() + ':', L.n,
      '| overruns', L.over.length, '| tightest "' + L.tightest.t + '" has ' + L.tightest.slack + ' units clear');
    if (L.over.length)
      fails.push('in full screen ' + L.over.length + ' label(s) run outside their own box on the '
        + set.toLowerCase() + ' data: '
        + L.over.slice(0, 3).map(o => '"' + o.t + '" by ' + o.over).join(', '));
  }
  await p.evaluate(() => paint(normalise(CLEAR))); await p.waitForTimeout(400);

  /* AND IT USES THE WHOLE WINDOW. The panel was inset, radiused and padded,
     which cost seventy points of height on a laptop, and the drawing is
     height bound at every width, so that came straight off the type. */
  const box = await p.evaluate(() => {
    const r = document.querySelector('.path').getBoundingClientRect();
    return { l: Math.round(r.left), t: Math.round(r.top),
             w: Math.round(r.width), h: Math.round(r.height),
             vw: window.innerWidth, vh: window.innerHeight };
  });
  if (box.l > 0 || box.t > 0 || box.w < box.vw || box.h < box.vh)
    fails.push('full screen does not fill the window: the panel is ' + box.w + 'x' + box.h
      + ' at ' + box.l + ',' + box.t + ' inside ' + box.vw + 'x' + box.vh);

  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  const back = await p.evaluate(()=>Math.round(document.querySelector('.pathwrap').getBoundingClientRect().width));
  if (Math.abs(back-before) > 4) fails.push('the board did not come back from full screen: '+before+' -> '+back);
}

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
