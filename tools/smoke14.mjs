/* The header rearrangement, the clickable evidence lines, the bigger triage
   pills, the brand placement, and leaving the wait screen after every card. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
Object.defineProperty(window.HTMLElement.prototype,'offsetTop',{get(){return 0;},configurable:true});
await new Promise(r=>setTimeout(r,900));

console.log('BRAND');
console.log('  hero mark is inside the title block:', !!doc.querySelector('.cbtitle .tlead img.heromark'));
console.log('  hero mark is centred on landing:', html.includes('body[data-stage="landing"] .heromark{display:block;height:120px;width:auto;margin:0 auto 26px}'));
console.log('  corner mark hidden on landing:', html.includes('body[data-stage="landing"] .navpill{display:none}'));
console.log('  corner mark is 4x on the console:', html.includes('.navpill img{height:88px'));
console.log('  find support carries the mark, bigger:', html.includes('.dirbrand img{height:44px;width:44px'));

console.log('\nHEADER');
console.log('  chips sit above the bar:',
  doc.querySelector('.cbtitle #kbIds') && (doc.getElementById('kbIds').compareDocumentPosition(doc.getElementById('kbForm')) & 4) ? true : false);
console.log('  chips:', [...doc.querySelectorAll('#kbIds .idchip')].map(c=>c.textContent).join(', '));
console.log('  five figures sit under the bar:',
  (doc.getElementById('kbForm').compareDocumentPosition(doc.getElementById('statstrip')) & 4) ? true : false);
console.log('  metarow gone:', !doc.querySelector('.metarow'));

// wait screen: every card, then leave
window.__KBYS__.check('investhelm.com');
await new Promise(r=>setTimeout(r,320));
console.log('\nWAIT SCREEN');
const browse=doc.getElementById('waitBrowse');
console.log('  leave button hidden before all cards seen:', browse.style.display==='none');
const total=doc.querySelectorAll('#eduDots button').length;
for(let i=0;i<total;i++){ doc.querySelectorAll('#eduDots button')[i].click(); await new Promise(r=>setTimeout(r,15)); }
console.log('  after every card, leave button offered:', browse.style.display!=='none', '|', browse.textContent);
browse.click(); await new Promise(r=>setTimeout(r,120));
console.log('  clicking it closes the panel:', !doc.getElementById('waitBox').classList.contains('on'));
console.log('  and says the check is still running:', doc.getElementById('waitFine').textContent);
await new Promise(r=>setTimeout(r,6500));
console.log('  the result still arrived:', !!window.__KBYS__.current(), '|', doc.getElementById('modeLbl').textContent);

console.log('\nEVIDENCE COMPOSITION');
const bars=[...doc.querySelectorAll('#bars .bar')];
console.log('  lines:', bars.length, '| clickable:', bars.filter(b=>b.classList.contains('clik')).length);
bars[0].click(); await new Promise(r=>setTimeout(r,60));
let b=doc.getElementById('infoBody').textContent;
console.log('  a line opens a brief:', doc.getElementById('infoKind').textContent, '|', doc.getElementById('infoTitle').textContent);
console.log('  with points:', doc.querySelectorAll('#infoBody .snaprow').length, '| and a jump:', !!doc.getElementById('barJump'));
doc.getElementById('infoClose').click(); await new Promise(r=>setTimeout(r,30));

console.log('\nSTAT CARDS');
const cells=[...doc.querySelectorAll('.scell')];
console.log('  five wide:', cells.length, '| all clickable:', cells.filter(c=>c.getAttribute('role')==='button').length);
console.log('  captions are toned:', [...new Set(cells.map(c=>c.getAttribute('data-t')))].join(','));

console.log('\nTRIAGE');
doc.querySelector('[data-dir="open"]').click(); await new Promise(r=>setTimeout(r,320));
console.log('  pill text size:', html.includes('.tbtn .tt{font-size:17px'));
console.log('  pills:', doc.querySelectorAll('.tbtn').length);

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log('  '+e.slice(0,200)));
dom.window.close(); process.exit(0);
