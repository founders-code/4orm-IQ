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

console.log('console top padding 64px:', html.includes('.console{position:relative;padding:64px'));
console.log('find support pulses:', html.includes('@keyframes helppulse'));
console.log('horizontal pill row gone:', !doc.getElementById('quickRow') && !html.includes('.quickrow{'));
console.log('three pills above search gone:', !doc.querySelector('.hls'));

window.__KBYS__.check('investhelm.com');
setTimeout(()=>doc.getElementById('waitOk').click(),300);
await new Promise(r=>setTimeout(r,6500));

const band=doc.getElementById('summaryBand');
console.log('\nband columns:', [...band.children].map(c=>c.className).join(' | '));
console.log('gauges in the band:', !!band.querySelector('.sbgauges #dial1'), '| both dials:', !!band.querySelector('#dial1') && !!band.querySelector('#dial2'));
console.log('dial values:', doc.getElementById('dial1v').textContent, doc.getElementById('dial2v').textContent);
const rail=doc.getElementById('sbRight');
console.log('right rail cards:', rail.children.length);
[...rail.children].forEach(c=>console.log('  '+c.querySelector('.n').textContent+'  '+c.querySelector('.v').textContent));

// stat cells clickable
const cells=[...doc.querySelectorAll('#statstrip .scell')];
console.log('\nstat cells:', cells.length, '| clickable:', cells.filter(c=>c.getAttribute('role')==='button').length);
cells.find(c=>c.getAttribute('role')==='button').click();
await new Promise(r=>setTimeout(r,60));
console.log('  brief opens:', doc.getElementById('infoKind').textContent, '|', doc.getElementById('infoTitle').textContent);
console.log('  has points:', (doc.getElementById('infoBody').innerHTML.match(/snaprow/g)||[]).length);
console.log('  has a jump button:', !!doc.querySelector('#infoBody button.gateok'));
doc.getElementById('infoClose').click();

// register modal: reading guidance and the separation
doc.querySelector('#brows .src[data-reg="Corporations Canada"]').click();
await new Promise(r=>setTimeout(r,60));
let b=doc.getElementById('infoBody').innerHTML;
console.log('\nregister modal:');
['How to read this one','If it has them','If it does not','Look at first']
 .forEach(t=>console.log((b.includes(t)?'  found  ':'  MISSING')+'  '+t));
console.log('  plain tier word not Tier A:', !b.includes('>Tier A<'));
doc.getElementById('infoClose').click();

// check modal leads with the finding
/* THE MODAL IS TWO STEPS NOW.
   A tile opens the short read: the question, what was found, and how much was
   behind it. The full working, with the rules and the table of records, is
   behind "Open the full check". These probes were reading the short read and
   looking for the full one, so both printed false on every run for builds.
   They now click through, which is also what a reader does. */
const MISS9=[];
const say9=(label,ok)=>{ console.log((ok?'  ok      ':'  FAILED  ')+label); if(!ok) MISS9.push(label); };
doc.querySelectorAll('#tiles .tile')[3].click();
await new Promise(r=>setTimeout(r,60));
{
  const short=doc.getElementById('infoBody').textContent;
  say9('the short read says what was found before anything else',
    /\d+ records? behind this, from \d+ registers? in scope/.test(short));
  const open=[...doc.querySelectorAll('#infoBody button')].find(x=>/Open the full check/.test(x.textContent));
  say9('the short read offers the full working', !!open);
  if(open){
    open.click();
    await new Promise(r=>setTimeout(r,90));
    b=doc.getElementById('infoBody').innerHTML;
    const t=doc.getElementById('infoBody').textContent;
    const m=t.match(/\d+ records? found|\d+ records? behind/);
    const iFind=m?t.indexOf(m[0]):-1;
    const iRule=t.search(/How this check is decided|How this is decided|The rule/i);
    say9('the full check puts the records before the rules',
      iFind>-1 && (iRule===-1 || iFind<iRule));
    say9('the tiers are in plain words, not letters',
      (/Official record|Customer reports|Verified data|Open web/.test(t)) && !/>Tier [ABCD]</.test(b));
  }
}
doc.getElementById('infoClose').click();

// reviews label
const revCard=[...rail.children].find(c=>c.querySelector('.n').textContent.includes('Reviews'));
console.log('\nreviews label:', revCard.querySelector('.n').textContent);

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
if(errs.length) MISS9.push('page errors: '+errs[0].slice(0,120));
console.log('\n' + (MISS9.length ? 'FAILED' : 'PASSED'));
MISS9.forEach(f=>console.log('  '+f));
process.exit(MISS9.length?1:0);
