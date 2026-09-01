/* THE FULL CLICK-THROUGH AUDIT
   Every register chip, every check tile, every rail card, every stat cell and
   every evidence line, opened one at a time. A control that opens an empty
   modal is worse than one that is missing, because it looks like it worked. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?demo=1&debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
  w.print=()=>{}; w.URL.createObjectURL=()=>'blob:t'; w.URL.revokeObjectURL=()=>{};
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
Object.defineProperty(window.HTMLElement.prototype,'offsetTop',{get(){return 0;},configurable:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await wait(900);

window.__KBYS__.check('atlanticglobalwealth.com');
setTimeout(()=>doc.getElementById('waitOk').click(),220);
await wait(6500);
const d=window.__KBYS__.current();
let fails=[];

/* ---------- every register chip ---------- */
const chips=[...doc.querySelectorAll('#brows .src')];
console.log('REGISTERS');
console.log('  chips on the board:', chips.length);
let empties=0, noState=0, states={};
for(const c of chips){
  const nm=c.getAttribute('data-reg')||c.textContent.trim();
  const st=c.getAttribute('data-s'); states[st]=(states[st]||0)+1;
  if(!st) noState++;
  c.click(); await wait(8);
  const body=doc.getElementById('infoBody');
  const txt=(body.textContent||'').trim();
  if(txt.length<120){ empties++; fails.push('register modal thin or empty: '+nm+' ('+txt.length+' chars)'); }
  if(!/How to read this one/.test(body.textContent)) fails.push('register has no reading guidance: '+nm);
  doc.getElementById('infoClose').click(); await wait(4);
}
console.log('  every chip opens a populated modal:', empties===0, empties?('('+empties+' thin)'):'');
console.log('  every chip carries a state:', noState===0);
console.log('  states on the board:', JSON.stringify(states));

/* ---------- every check tile ---------- */
console.log('\nTHE TEN CHECKS');
const tiles=[...doc.querySelectorAll('#tiles .tile')];
console.log('  tiles:', tiles.length);
for(let i=0;i<tiles.length;i++){
  /* Two steps now: the tile opens a short read, and the full check sits behind
     a button on it. Nobody is dropped into ten screens of registers because
     they wanted to know what a number meant. */
  tiles[i].click(); await wait(12);
  const brief=(doc.getElementById('infoBody').textContent||'');
  if(!/Check \d+\./.test(brief)) fails.push('tile '+(i+1)+' does not open a short read first');
  const openFull=[...doc.querySelectorAll('#infoBody button')]
    .find(x=>/Open the full check/.test(x.textContent));
  if(!openFull){ fails.push('tile '+(i+1)+' short read does not offer the full check'); continue; }
  openFull.click(); await wait(20);
  const b=doc.getElementById('infoBody');
  const t=b.textContent||'';
  const kind=doc.getElementById('infoKind').textContent;
  const okRecords=/records? found/i.test(t);
  const okRules=/The rules for this check, and which one applied/.test(t);
  const okRegs=/registers behind this check/.test(t);
  if(!okRecords||!okRules||!okRegs) fails.push('check '+kind+' missing: '+
    [!okRecords&&'records',!okRules&&'rules',!okRegs&&'registers'].filter(Boolean).join(', '));
  const iF=(t.match(/\d+ records? found/)||[''])[0];
  if(iF && t.indexOf(iF) > t.indexOf('The rules for this check, and which one applied')) fails.push('check '+kind+' puts rules before records');
  doc.getElementById('infoClose').click(); await wait(4);
}
console.log('  all ten open with records, rules and registers:', !fails.some(f=>/^check /.test(f)));

/* ---------- cross-examination ---------- */
console.log('\nCROSS-EXAMINATION');
const rail=doc.getElementById('sbRight');
const xi=[...rail.children].findIndex(c=>/Cross-examination/i.test(c.querySelector('.n').textContent));
rail.children[xi].click(); await wait(30);
let b=doc.getElementById('infoBody');
const rows=[...b.querySelectorAll('.snaprow')];
console.log('  claims listed:', rows.length);
const lights=rows.map(r=>r.querySelector('.sg')&&r.querySelector('.sg').getAttribute('data-s')).filter(Boolean);
console.log('  every claim carries a light:', lights.length===rows.length, '|', JSON.stringify(lights.reduce((a,x)=>{a[x]=(a[x]||0)+1;return a;},{})));
const bad=lights.filter(x=>!['RED','YELLOW','GREEN'].includes(x));
if(bad.length) fails.push('cross-examination light outside RED/YELLOW/GREEN: '+bad.join(','));
const noSource=rows.filter(r=>!/says:/.test(r.textContent)).length;
console.log('  every claim names the record that settles it:', noSource===0);
if(noSource) fails.push(noSource+' cross-examined claims name no adjudicating source');
console.log('  dated claims folded in:', /From the date comparison in check 10/.test(b.textContent));
doc.getElementById('infoClose').click(); await wait(6);

/* ---------- every rail card ---------- */
console.log('\nSUMMARY RAIL');
for(let i=0;i<rail.children.length;i++){
  const nm=rail.children[i].querySelector('.n').textContent;
  rail.children[i].click(); await wait(20);
  const t=(doc.getElementById('infoBody').textContent||'').trim();
  if(t.length<120) fails.push('rail card opens thin: '+nm+' ('+t.length+')');
  doc.getElementById('infoClose').click(); await wait(6);
}
console.log('  cards:', rail.children.length, '| all open populated:', !fails.some(f=>/^rail card/.test(f)));

/* ---------- stat cells and evidence lines ---------- */
console.log('\nFIGURES AND EVIDENCE LINES');
const cells=[...doc.querySelectorAll('.scell[role="button"]')];
for(const c of cells){
  c.click(); await wait(14);
  const t=(doc.getElementById('infoBody').textContent||'').trim();
  if(t.length<80) fails.push('stat brief thin: '+c.querySelector('.sl').textContent);
  doc.getElementById('infoClose').click(); await wait(4);
}
console.log('  stat cells:', cells.length, '| all open a brief:', !fails.some(f=>/^stat brief/.test(f)));
const bars=[...doc.querySelectorAll('#bars .bar')];
let barOk=0;
for(const bar of bars){
  if(!bar.classList.contains('clik')){ fails.push('evidence line not clickable: '+bar.querySelector('.bn').textContent.trim()); continue; }
  bar.click(); await wait(14);
  const t=(doc.getElementById('infoBody').textContent||'').trim();
  if(t.length<80) fails.push('evidence brief thin: '+bar.querySelector('.bn').textContent.trim()); else barOk++;
  doc.getElementById('infoClose').click(); await wait(4);
}
console.log('  evidence lines:', bars.length, '| all clickable and populated:', barOk===bars.length);
console.log('  five across:', window.getComputedStyle(doc.getElementById('bars')).gridTemplateColumns.split(' ').length);

/* ---------- the summary ---------- */
console.log('\nSUMMARY SHEET');
doc.getElementById('sumOpen').click(); await wait(60);
const st=doc.getElementById('sumBody').textContent||'';
console.log('  opens with content:', st.length>1500, '|', st.length, 'characters');
doc.getElementById('sumClose').click();

console.log('\n================ RESULT ================');
console.log(fails.length? 'FAILURES ('+fails.length+'):' : 'No broken control found.');
fails.slice(0,25).forEach(f=>console.log('  '+f));
console.log('page errors:', errs.length); errs.slice(0,5).forEach(e=>console.log('  '+e.slice(0,180)));
dom.window.close(); process.exit(0);
