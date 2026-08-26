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

console.log('three pills removed:', !doc.querySelector('.hls'));
console.log('page width token:', html.includes('max-width:1560px'));

window.__KBYS__.check('investhelm.com');
setTimeout(()=>doc.getElementById('waitOk').click(),300);
await new Promise(r=>setTimeout(r,6500));

const band=doc.getElementById('summaryBand');
console.log('\nsummary band on:', band.classList.contains('on'));
console.log('left holds the verdict:', !!band.querySelector('.sbleft #kbVerdict'));
const rail=doc.getElementById('sbRight');
console.log('right rail cards:', rail.children.length);
[...rail.children].forEach(c=>console.log('  '+c.querySelector('.n').textContent+'  '+c.querySelector('.v').textContent+'  |  '+c.querySelector('.sbx').textContent));
console.log('ten-check dots:', rail.querySelectorAll('.sbdots i').length);
rail.children[0].click();
await new Promise(r=>setTimeout(r,60));
console.log('rail card opens:', doc.getElementById('infoKind').textContent);
doc.getElementById('infoClose').click();

// order on the page
const order=[...doc.querySelector('.cbmain').children].map(n=>n.className.split(' ')[0]||n.tagName.toLowerCase());
console.log('\nheader order:', order.join(' -> '));

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
process.exit(errs.length?1:0);
