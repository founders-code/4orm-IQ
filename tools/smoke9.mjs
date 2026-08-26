import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?debug=1',
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
doc.querySelectorAll('#tiles .tile')[3].click();
await new Promise(r=>setTimeout(r,60));
b=doc.getElementById('infoBody').innerHTML;
const m=b.match(/\d+ records? found/); const iFind=m?b.indexOf(m[0]):-1;
const iRule=b.indexOf('How this check is decided');
console.log('\ncheck modal: records before rules:', iFind>-1 && iFind<iRule);
console.log('  plain tier words in the table:', b.includes('Official record')||b.includes('Customer reports'));
doc.getElementById('infoClose').click();

// reviews label
const revCard=[...rail.children].find(c=>c.querySelector('.n').textContent.includes('Reviews'));
console.log('\nreviews label:', revCard.querySelector('.n').textContent);

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
process.exit(errs.length?1:0);
