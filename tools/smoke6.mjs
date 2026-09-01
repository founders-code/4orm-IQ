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

console.log('progress bar present:', !!doc.getElementById('topBar'));
console.log('no gate on arrival:', !doc.getElementById('gateBox'), '| page not locked:', doc.body.style.overflow==='');

window.__KBYS__.check('investhelm.com');
await new Promise(r=>setTimeout(r,700));
const wb=doc.getElementById('waitBox');
console.log('\nwaiting screen opens on search:', wb.classList.contains('on'), '| locked:', doc.body.style.overflow==='hidden');
console.log('  subject shown:', doc.getElementById('waitQ').textContent);
console.log('  bar moving:', doc.getElementById('waitBar').style.width, '| phase:', doc.getElementById('waitPhase').textContent);
const edu=doc.getElementById('eduCard').textContent.replace(/\s+/g,' ');
console.log('  education card:', edu.slice(0,72)+'...');
console.log('  disclaimer inside it:', wb.textContent.includes('research tool, not advice'));
console.log('  support number:', wb.textContent.includes('1-888-495-8501'));
console.log('  can acknowledge while running:', !doc.getElementById('waitOk').disabled);
doc.getElementById('waitOk').click();
console.log('  acknowledging early does not close it:', wb.classList.contains('on'));
await new Promise(r=>setTimeout(r,6000));
console.log('  closes once done and acknowledged:', !wb.classList.contains('on'));

const q=doc.getElementById('quickRow');
console.log('\nhorizontal quick strip removed on purpose:', !q, '| rail cards:', doc.getElementById('sbRight').children.length);
[...doc.getElementById('sbRight').children].forEach(c=>console.log('  '+c.querySelector('.n').textContent+' = '+c.querySelector('.v').textContent));

const rail=doc.getElementById('sbRight');
function open(i){ rail.children[i].click(); return doc.getElementById('infoBody').innerHTML; }
let b=open(0);
console.log('\nthe ten checks:', doc.getElementById('infoKind').textContent, '| rows:', (b.match(/class="snaprow"/g)||[]).length);
b.includes('Adverse') && console.log('  has the summary cells');
doc.querySelectorAll('#infoBody .snaprow')[9].click();
console.log('  drilling into one opens:', doc.getElementById('infoKind').textContent, doc.getElementById('infoTitle').textContent);
doc.getElementById('infoClose').click();

b=open(1);
console.log('\nreviews:', doc.getElementById('infoKind').textContent);
['One and two star accounts read','Platforms carrying negative reports','Read for pattern, not volume','Where we looked']
 .forEach(t=>console.log((b.includes(t)?'  found  ':'  MISSING')+'  '+t));
doc.getElementById('infoClose').click();

b=open(3);
console.log('\ncross-examination:', doc.getElementById('infoKind').textContent);
doc.getElementById('infoClose').click();
b=open(2);
console.log('\nsource board rows:', (b.match(/class="snaprow"/g)||[]).length, '| kind:', doc.getElementById('infoKind').textContent);
doc.getElementById('infoClose').click();
b=open(4);
console.log('material issues:', (b.match(/class="snaprow"/g)||[]).length, 'rows');
doc.getElementById('infoClose').click();
b=open(5);
console.log('gaps:', doc.getElementById('infoKind').textContent);
doc.getElementById('infoClose').click();

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
process.exit(errs.length?1:0);
