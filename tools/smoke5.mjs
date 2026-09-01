import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?demo=1&debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(cb,0);
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
await new Promise(r=>setTimeout(r,900));

console.log('verdict hidden before a check:', !doc.getElementById('verdictWrap').classList.contains('on'));

// click a register light on the idle board
const chip = doc.querySelector('#brows .src[data-reg="FinCEN MSB"]');
chip.click();
await new Promise(r=>setTimeout(r,60));
let body=doc.getElementById('infoBody').innerHTML;
console.log('\nregister modal open:', doc.getElementById('infoBox').classList.contains('on'));
console.log('  title:', doc.getElementById('infoTitle').textContent);
console.log('  describes it:', body.includes('money services business register'));
console.log('  says not run yet:', body.includes('has not been run yet'));
console.log('  links out:', body.includes('fincen.gov'));
doc.getElementById('infoClose').click();

// run a seeded check, then open a category tile
window.__KBYS__.check('investhelm.com'); setTimeout(()=>doc.getElementById('waitOk').click(),200); setTimeout(()=>doc.getElementById('waitOk').click(),4200);
await new Promise(r=>setTimeout(r,6000));
console.log('\nverdict shown after a check:', doc.getElementById('verdictWrap').classList.contains('on'), '| in the band:', !!doc.querySelector('.sbleft #verdictWrap'));
console.log('verdict text:', doc.getElementById('kbBadgeT').textContent);

const tiles=doc.querySelectorAll('#tiles .tile');
console.log('tiles:', tiles.length);
tiles[9].click();                       // category 10
await new Promise(r=>setTimeout(r,60));
body=doc.getElementById('infoBody').innerHTML;
console.log('\ncategory modal open:', doc.getElementById('infoBox').classList.contains('on'));
console.log('  kind:', doc.getElementById('infoKind').textContent, '| title:', doc.getElementById('infoTitle').textContent);
console.log('  state:', doc.getElementById('infoState').textContent);
['How this check is decided','records found','registers behind this check','ICANN RDAP']
  .forEach(t=>console.log((body.includes(t)?'  found  ':'  MISSING')+'  '+t));
doc.getElementById('infoClose').click();

// register that carries a result now
doc.querySelector('#brows .src[data-reg="ICANN RDAP Date"]').click();
await new Promise(r=>setTimeout(r,60));
body=doc.getElementById('infoBody').innerHTML;
console.log('\nlit register modal state:', doc.getElementById('infoState').textContent);
console.log('  carries the record:', body.includes('2026-02-22'));

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
process.exit(errs.length?1:0);
