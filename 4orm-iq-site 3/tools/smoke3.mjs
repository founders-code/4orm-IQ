import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(cb,0);
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom; const doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
Object.defineProperty(window.HTMLElement.prototype,'offsetTop',{get(){return 0;},configurable:true});
window.Element.prototype.scrollTo = function(){};
await new Promise(r=>setTimeout(r,800));

// nav
const pill=doc.querySelector('.navpill'), help=doc.querySelector('[data-dir="open"]');
console.log('nav pill children:', pill.children.length, '| links gone:', !doc.querySelector('.navlinks'), '| run-a-check gone:', !doc.querySelector('.navcta'));
if(!help) throw new Error('find support is gone from the nav');
/* Targeted by what it does, not what it is called, so a restyle of the nav
   cannot break a test whose subject is still there and still working. */
console.log('find support sits in the nav:', !!help.closest('.nav'));
console.log('the nav is one set:', new Set([...doc.querySelectorAll('.nav button')]
  .map(b=>b.className.replace(/\s*gold\s*/,'').trim())).size === 1);
console.log('scoring section gone:', !doc.getElementById('scoring'), '| trust score copy gone:', !html.includes('There is no trust score'));

// directory
doc.querySelector('[data-dir="open"]').click();
await new Promise(r=>setTimeout(r,300));
const pane=doc.getElementById('dirPane');
const secs=pane.querySelectorAll('.dsec');
const entries=pane.querySelectorAll('.entry');
const tels=pane.querySelectorAll('a.cv[href^="tel:"]');
console.log('\ndirectory sections rendered at once:', secs.length);
console.log('entries visible without a click:', entries.length);
console.log('phone numbers visible without a click:', tels.length);
console.log('act-now band present:', !!pane.querySelector('.actnow'));
console.log('rail items:', doc.getElementById('dirRail').children.length);
console.log('title:', doc.getElementById('dirTitle').textContent);

// rail jump
doc.getElementById('dirRail').children[3].click();
await new Promise(r=>setTimeout(r,60));
console.log('rail click did not blank the pane:', pane.querySelectorAll('.dsec').length===secs.length);

// triage
pane.querySelector('.tbtn').click();
await new Promise(r=>setTimeout(r,60));
console.log('triage did not blank the pane:', pane.querySelectorAll('.dsec').length===secs.length,
            '| context note shown:', doc.getElementById('dirCtx').classList.contains('on'));

// filter
const q=doc.getElementById('dirQ');
q.value='securities'; q.dispatchEvent(new window.Event('input',{bubbles:true}));
await new Promise(r=>setTimeout(r,60));
let visSec=[...pane.querySelectorAll('.dsec')].filter(n=>n.style.display!=='none').length;
let visEnt=[...pane.querySelectorAll('.entry')].filter(n=>n.style.display!=='none').length;
console.log('\nfilter "securities": sections', visSec, 'entries', visEnt, '| title:', doc.getElementById('dirTitle').textContent);
q.value='zzzzz'; q.dispatchEvent(new window.Event('input',{bubbles:true}));
await new Promise(r=>setTimeout(r,60));
console.log('no-match message shown:', doc.getElementById('dirNone').style.display==='');
q.value=''; q.dispatchEvent(new window.Event('input',{bubbles:true}));
await new Promise(r=>setTimeout(r,60));
visSec=[...pane.querySelectorAll('.dsec')].filter(n=>n.style.display!=='none').length;
console.log('cleared: sections back to', visSec, '| act-now back:', pane.querySelector('.actnow').style.display==='');

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
process.exit(errs.length?1:0);
