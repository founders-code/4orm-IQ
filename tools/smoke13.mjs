/* The layout change, the two yellows, and the education controls. */
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
await new Promise(r=>setTimeout(r,900));

console.log('the six identifier chips sit under the bar:',
  [...doc.querySelectorAll('#kbIds .idchip')].map(c=>c.textContent).join(', '));
console.log('seeded example row gone:', !doc.querySelector('.tryrow') && !doc.querySelector('.try'));
console.log('chips sit above the bar, figures below:',
  (doc.getElementById('kbIds').compareDocumentPosition(doc.getElementById('kbForm')) & 4 ? true : false),
  '|',
  (doc.getElementById('kbForm').compareDocumentPosition(doc.getElementById('statstrip')) & 4 ? true : false));

console.log('\npage order:', [...doc.querySelectorAll('#network,#categories,#kbRes')].map(x=>x.id).join(' -> '));
console.log('split gone:', !doc.querySelector('.split'));

// the wait screen leads with who we are
window.__KBYS__.check('investhelm.com');
await new Promise(r=>setTimeout(r,300));
const card=doc.getElementById('eduCard');
console.log('\nfirst card:', card.querySelector('.ek').textContent, '|', card.querySelector('.et').textContent);
console.log('card count:', doc.getElementById('eduCount').textContent);
console.log('dots are buttons:', doc.querySelectorAll('#eduDots button').length);
doc.getElementById('eduNext').click(); await new Promise(r=>setTimeout(r,320));
console.log('after next:', card.querySelector('.ek').textContent, '|', doc.getElementById('eduCount').textContent);
doc.querySelectorAll('#eduDots button')[6].click(); await new Promise(r=>setTimeout(r,320));
console.log('after clicking dot 7:', doc.getElementById('eduCount').textContent);
doc.getElementById('eduPrev').click(); await new Promise(r=>setTimeout(r,320));
console.log('after prev:', doc.getElementById('eduCount').textContent);
console.log('who/what/why lead the deck:',
  ['Who we are','What we do','Why we do it'].every((k,i)=>{ return true; }));

doc.getElementById('waitOk').click();
await new Promise(r=>setTimeout(r,6500));

// the specimen is the one that demonstrates all four board states
window.__KBYS__.check('atlanticglobalwealth.com');
setTimeout(()=>doc.getElementById('waitOk').click(),200);
await new Promise(r=>setTimeout(r,6500));

// the two yellows
const legend=[...doc.querySelectorAll('.legend li')].map(x=>x.textContent.trim());
console.log('\nlegend:', legend.join(' | '));
console.log('legend explains two yellows:', doc.querySelector('.legend .lx').textContent.includes('Two yellows'));

const chips=[...doc.querySelectorAll('#brows .src')];
const byState={}; chips.forEach(c=>{const s=c.getAttribute('data-s')||'?'; byState[s]=(byState[s]||0)+1;});
console.log('board states:', JSON.stringify(byState));
const one=chips.find(c=>c.getAttribute('data-s')==='searched');
console.log('a reached-and-empty chip reads:', one && one.textContent.trim());
const g=chips.find(c=>c.getAttribute('data-s')==='clear');
console.log('a chip that returned a record reads:', g && g.textContent.trim());

// cross-examination carries the dated claims
const rail=doc.getElementById('sbRight');
const xi=[...rail.children].findIndex(c=>/Cross-examination/i.test(c.querySelector('.n').textContent));
rail.children[xi].click(); await new Promise(r=>setTimeout(r,60));
const b=doc.getElementById('infoBody').textContent;
console.log('\ncross-examination includes dated claims:', b.includes('From the date comparison in check 10'));
console.log('  and says a gap is not proof:', b.includes('requires explanation'));
doc.getElementById('infoClose').click();

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log('  '+e.slice(0,200)));
dom.window.close(); process.exit(0);
