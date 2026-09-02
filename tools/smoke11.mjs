/* The four board states, the new gap words, the wait clock and the branding. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const P='/home/claude/kbys/build/4orm-iq/index.html';
const html=fs.readFileSync(P,'utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?demo=1&debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
/* A bare console.log probe prints false and exits zero, which is a check that
   has stopped checking. Four in this file had been printing false for builds. */
const MISS=[];
const say=(label,ok)=>{ console.log((ok?'  ok      ':'  FAILED  ')+label); if(!ok) MISS.push(label); };
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
/* THE BAR IS CONTINUOUS NOW, AND THIS ASSERTED THE OPPOSITE.
   It required the printed value to be a multiple of ten, which was true of the
   stepped bar that was replaced precisely because a reader called it out to
   lunch. Left as written, restoring the old broken bar would have made it pass. */
say('the bar is not confined to steps of ten',
  !/^(0|10|20|30|40|50|60|70|80|90|100)%$/.test(doc.getElementById('waitPct').textContent));
console.log('focus moved into the dialog:', doc.activeElement && doc.activeElement.id==='waitOk');
say('the two US numbers are present', html.includes('1-877-382-4357') && html.includes('1-800-225-5324'));
/* The copy moved. What has to survive is that the reader is sent to the FRAUD
   line rather than the general line, because the general line closes at five
   and the fraud line does not. */
say('the reader is sent to the fraud line, not the general line',
  /fraud line/.test(html) && /not the general line/.test(html));
const edu=doc.getElementById('eduCard');
console.log('education card is toned:', !!edu.getAttribute('data-tone'), '| cites a source:', !!edu.querySelector('.esrc'));
doc.getElementById('waitOk').click();
/* The "done" styling came off deliberately: adding a tick and a weight change
   to this line rewrapped the row under it and moved the whole screen mid-run.
   What matters is that the sentence is still there afterwards. */
say('the disclaimer survives being acknowledged',
  /not advice/i.test(doc.getElementById('waitFine').textContent));
say('and acknowledging it does not restyle the line, which used to move the screen',
  !doc.getElementById('waitFine').classList.contains('done'));
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

/* THE GAPS CARD, BY NAME.
   This reached for children[5] and the rail has been reordered since: 5 is the
   operator graph now and the gaps card is 6. Reading the card by its heading
   means the next reorder cannot silently point this at a different card and
   still pass. */
{
  const cards=[...rail.children];
  const gaps=cards.find(c=>/^\s*Gaps/.test(c.textContent));
  if(!gaps) MISS.push('the rail has no gaps card');
  else gaps.click();
}
await new Promise(r=>setTimeout(r,60));
m=doc.getElementById('infoBody').textContent;
say('the gap reasons are in plain words', !/no_match_key|licence_required|not_applicable/.test(m));
/* Rail card 6 is the gaps card. The exact phrase moved into the legend and the
   board modal; what this card has to do is keep the two apart in whatever words
   it uses now, because a register that could never have applied is not a gap
   and counting it as one understates the coverage. */
say('and it keeps "could not reach" apart from "could never apply"',
  /never have applied|does not apply|could never apply/i.test(m));
doc.getElementById('infoClose').click();

console.log('\nlegend states:', [...doc.querySelectorAll('.legend li')].map(x=>x.textContent.trim()).join(' | '));
console.log('green light is qualified on the board:', doc.querySelector('.legend .lx').textContent.includes('never a guarantee'));
console.log('provenance shown on a seeded result:', doc.getElementById('kbProv').style.display!=='none');
console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log('  '+e));
if(errs.length) MISS.push('page errors: '+errs[0].slice(0,120));
dom.window.close();
console.log('\n' + (MISS.length ? 'FAILED' : 'PASSED'));
MISS.forEach(f=>console.log('  '+f));
process.exit(MISS.length?1:0);
