import fs from 'fs'; import { JSDOM } from 'jsdom';
const html = fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?demo=1&debug=1',
  beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(cb,0);
    w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message))); }});
const {window}=dom;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
await new Promise(r=>setTimeout(r,900));

// demo mode: seeded corpus entity, no ledger / retrieved / pipeline
window.__KBYS__.check('investhelm.com'); setTimeout(()=>window.document.getElementById('waitOk').click(),200); setTimeout(()=>window.document.getElementById('waitOk').click(),4200);
await new Promise(r=>setTimeout(r,5200));
const cur=window.__KBYS__.current();
console.log('demo verdict:', cur && cur.verdict, '| has ledger:', !!(cur&&cur.ledger), '| has pipeline:', !!(cur&&cur.pipeline));
try { window.__KBYS__.buildAudit(cur); console.log('demo buildAudit ok,', window.document.getElementById('arBody').innerHTML.length,'chars'); }
catch(e){ errs.push('demo buildAudit threw: '+e.stack); }
console.log('board:', window.document.getElementById('boardC').textContent);
console.log('specimen path:'); 
window.__KBYS__.check('atlanticglobalwealth.com'); setTimeout(()=>window.document.getElementById('waitOk').click(),200); setTimeout(()=>window.document.getElementById('waitOk').click(),4200);
await new Promise(r=>setTimeout(r,5200));
try { window.__KBYS__.buildAudit(window.__KBYS__.current()); console.log('  specimen buildAudit ok'); }
catch(e){ errs.push('specimen threw: '+e.stack); }
console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
process.exit(errs.length?1:0);
