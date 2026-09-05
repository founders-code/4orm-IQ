/* The header rearrangement, the clickable evidence lines, the bigger triage
   pills, the brand placement, and leaving the wait screen after every card. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?demo=1&debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
Object.defineProperty(window.HTMLElement.prototype,'offsetTop',{get(){return 0;},configurable:true});
await new Promise(r=>setTimeout(r,900));

const FAIL=[];
const say=(label,ok,detail)=>{ console.log('  '+label+': '+(detail===undefined?ok:detail));
  if(!ok) FAIL.push(label); };

console.log('BRAND');
/* Every one of these is the real file. Nothing here may ever be redrawn. */
const lock=doc.querySelector('.cbtitle .tlead h1 .iqlock img.iqmark');
say('the 4ormIQ lockup is in the headline', !!lock);
say('and it is the asset, not a redrawing',
    !!lock && /^data:image\/png;base64,/.test(lock.getAttribute('src')||''));
say('the corner mark is the asset too',
    !!doc.querySelector('.navpill img[src^="data:image/png;base64,"]'));
say('the corner mark is hidden while the lockup is up',
    /body\[data-stage="landing"\] \.navpill\{display:none\}/.test(html));
say('the corner mark has a size on the console',
    /\.navpill img\{height:\d+px/.test(html));
say('find support carries the mark',
    /\.dirbrand img\{height:\d+px;width:\d+px/.test(html));
/* The chips and the type pills came off on purpose. If either comes back it is
   a revert, not a feature, and this is where it gets caught. */
say('the identifier chips are still gone', !doc.querySelector('.idchip'));
say('the type pills are still gone', !doc.querySelector('.tbtn'));

console.log('\nHEADER');
say('the figures sit under the bar',
  !!(doc.getElementById('kbForm').compareDocumentPosition(doc.getElementById('statstrip')) & 4));
say('the sentence under the bar still lists what it takes',
  /company[\s\S]*website[\s\S]*email[\s\S]*wallet/i.test(
    (doc.getElementById('kbAccepts')||{textContent:''}).textContent));
say('metarow gone', !doc.querySelector('.metarow'));

/* THE WAITING SCREEN HAS ONE WAY OFF IT.
   It used to have two: the acknowledgement, and a "Close and keep looking"
   button that appeared once every card had been seen. Two controls side by
   side, one of which walked a reader past the disclaimer without reading it,
   and on a phone they competed for the same thumb. This asserts the property
   that replaced it rather than the button that is gone: exactly one control
   leaves this screen, and it is the acknowledgement. */
window.__KBYS__.check('investhelm.com');
await new Promise(r=>setTimeout(r,320));
console.log('\nWAIT SCREEN');
say('the second way off the screen is gone', !doc.getElementById('waitBrowse'));
const ok=doc.getElementById('waitOk');
say('the acknowledgement is there and live', !!ok && !ok.disabled);
say('and it says what pressing it does',
  (doc.getElementById('waitHint')||{textContent:''}).textContent.trim().length > 10);
const total=doc.querySelectorAll('#eduDots button').length;
for(let i=0;i<total;i++){ doc.querySelectorAll('#eduDots button')[i].click(); await new Promise(r=>setTimeout(r,15)); }
say('reading every card still does not open a second exit', !doc.getElementById('waitBrowse'));
ok.click(); await new Promise(r=>setTimeout(r,120));
say('acknowledging leaves the panel up while the sweep runs',
  doc.getElementById('waitBox').classList.contains('on'));
say('and the hint stops once it has been pressed',
  (doc.getElementById('waitHint')||{hidden:true}).hidden === true);
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

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log('  '+e.slice(0,200)));
if(errs.length) FAIL.push('page errors: '+errs[0].slice(0,140));
dom.window.close();
console.log('\n' + (FAIL.length ? 'FAILED' : 'PASSED'));
FAIL.forEach(f=>console.log('  '+f));
process.exit(FAIL.length?1:0);
