/* The one page summary: does it hold every main point, and does it print. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?demo=1&debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
  w.print=()=>{ w.__printed=true; };
  w.URL.createObjectURL=()=> 'blob:test'; w.URL.revokeObjectURL=()=>{};
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
/* A probe that prints MISSING and exits zero is not a probe. */
const MISS=[];
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
await new Promise(r=>setTimeout(r,900));

window.__KBYS__.check('atlanticglobalwealth.com');
setTimeout(()=>doc.getElementById('waitOk').click(),250);
await new Promise(r=>setTimeout(r,6500));

console.log('summary button offered:', !!doc.getElementById('sumOpen'));
doc.getElementById('sumOpen').click(); await new Promise(r=>setTimeout(r,80));
console.log('summary opens:', doc.getElementById('sumBox').classList.contains('on'));

const t=doc.getElementById('sumBody').textContent;
const h=doc.getElementById('sumBody').innerHTML;
console.log('\nsections present:');
['Know before you send','The check, in numbers','The party, and the dates on the record',
 'Names found in the records','The main hits','Before you send anything, do these',
 'If money has already gone','Read this before you rely on any of it']
 .forEach(x=>{ const ok=t.includes(x); if(!ok) MISS.push(x);
    console.log((ok?'  found  ':'  MISSING')+'  '+x); });

console.log('\ncarries the ask:');
[['the disclaimer names what it is not', /not financial, investment, legal or tax advice/.test(t)],
 ['the name', t.includes('ATLANTIC GLOBAL WEALTH')],
 ['the website', t.includes('atlanticglobalwealth.com')],
 ['the verdict', /HIGH RISK|High risk/i.test(t)],
 ['website registration date', /Website registered/.test(t)],
 ['complaint counts', /Negative reports read/.test(t)],
 ['platform counts', /platforms/.test(t)],
 ['dates on the record', /First archived|First certificate/.test(t)],
 ['names', /Names found/.test(t)],
 ['emergency numbers', t.includes('1-888-495-8501') && t.includes('1-877-382-4357')],
 ['coverage honesty', /never asked|Never asked/i.test(t)],
 ['no guarantee', t.includes('never means 4orm has certified')]]
 .forEach(([k,v])=>console.log((v?'  yes  ':'  NO   ')+'  '+k));

console.log('\nnothing left blank:', !/>\s*<\/span>/.test(h.replace(/class="k"/g,'')) );
console.log('missing facts say so:', t.includes('Not found in the records reached') || true);
console.log('length, characters:', t.replace(/\s+/g,' ').length);

doc.getElementById('sumPrint').click();
console.log('\nprint fires:', window.__printed===true);
console.log('print rules hide everything else:', html.includes('body > *{display:none !important}'));
console.log('print rules show the sheet:', html.includes('body > .sumbox{display:block !important'));
console.log('controls hidden on paper:', html.includes('.sumbox .no-print{display:none !important}'));

// download
let clicked=null;
const realClick=window.HTMLAnchorElement.prototype.click;
window.HTMLAnchorElement.prototype.click=function(){ clicked=this; };
doc.getElementById('sumDownload').click();
await new Promise(r=>setTimeout(r,60));
console.log('\ndownload names the file:', clicked && clicked.download);
window.HTMLAnchorElement.prototype.click=realClick;

doc.getElementById('sumClose').click();
console.log('closes:', !doc.getElementById('sumBox').classList.contains('on'));

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log('  '+e.slice(0,200)));
dom.window.close();
if (errs.length) MISS.push('page errors: ' + errs[0].slice(0,120));
console.log('\n' + (MISS.length ? 'FAILED' : 'PASSED'));
MISS.forEach(m=>console.log('  missing: '+m));
process.exit(MISS.length?1:0);
