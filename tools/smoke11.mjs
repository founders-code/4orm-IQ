/* The four board states, the new gap words, the wait clock and the branding. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const P='/home/claude/kbys/build/4orm-iq/index.html';
const html=fs.readFileSync(P,'utf8');
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

console.log('logo inlined, not a file path:', html.includes('<img src="data:image/png;base64,') && !html.includes('assets/logo.png'));
console.log('favicon inlined:', html.includes('rel="icon" type="image/png"') && html.includes('apple-touch-icon'));
console.log('no dead asset path left:', !/href="assets\//.test(html) && !/src="assets\//.test(html));
console.log('no onerror handler hiding brand:', !html.includes('onerror='));
console.log('logo in the directory header:', !!doc.querySelector('.dirhd .dirbrand img'));

window.__KBYS__.check('investhelm.com');
await new Promise(r=>setTimeout(r,400));
console.log('\nwait clock present:', !!doc.getElementById('waitClock'));
console.log('progress bar has aria:', doc.getElementById('waitBarWrap')?.getAttribute('aria-valuenow')!==null);
console.log('progress steps in tens:', /^(0|10|20|30|40|50|60|70|80|90|100)%$/.test(doc.getElementById('waitPct').textContent));
console.log('focus moved into the dialog:', doc.activeElement && doc.activeElement.id==='waitOk');
console.log('US number present:', html.includes('1-877-382-4357') && html.includes('1-800-225-5324'));
console.log('out of hours path present:', html.includes("Your bank's card and fraud line"));
const edu=doc.getElementById('eduCard');
console.log('education card is toned:', !!edu.getAttribute('data-tone'), '| cites a source:', !!edu.querySelector('.esrc'));
doc.getElementById('waitOk').click();
console.log('acknowledged line is green:', doc.getElementById('waitFine').classList.contains('done'));
await new Promise(r=>setTimeout(r,6200));

const b=window.__KBYS__.current ? null : null;
const rail=doc.getElementById('sbRight');
console.log('\nrail cards:', rail.children.length);
rail.children[2].click(); await new Promise(r=>setTimeout(r,60));
let m=doc.getElementById('infoBody').textContent;
['Reached, and returned a record','Reached, nothing on file','Could never have applied here','Never asked, or we could not get in']
  .forEach(t=>console.log((m.includes(t)?'  found  ':'  MISSING')+'  '+t));
console.log('  reaching a register and finding nothing is a result:', m.includes('Reaching a register and finding nothing is a result'));
doc.getElementById('infoClose').click(); await new Promise(r=>setTimeout(r,30));

rail.children[5].click(); await new Promise(r=>setTimeout(r,60));
m=doc.getElementById('infoBody').textContent;
console.log('\ngap reasons in plain words:', !/no_match_key|licence_required|not_applicable/.test(m));
console.log('  separates could not reach from could never apply:', m.includes('Could never have applied'));
doc.getElementById('infoClose').click();

console.log('\nlegend states:', [...doc.querySelectorAll('.legend li')].map(x=>x.textContent.trim()).join(' | '));
console.log('green light is qualified on the board:', doc.querySelector('.legend .lx').textContent.includes('never a guarantee'));
console.log('provenance shown on a seeded result:', doc.getElementById('kbProv').style.display!=='none');
console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log('  '+e));
dom.window.close(); process.exit(0);
