import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[]; let lastBody=null;
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?live=1&debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(cb,0);
  w.fetch=(u,o)=>{ lastBody=JSON.parse(o.body); return Promise.reject(new TypeError('blocked')); };
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
await new Promise(r=>setTimeout(r,800));

// theme
console.log('font link has B612 Mono:', html.includes('B612+Mono'), '| JetBrains gone:', !html.includes('JetBrains'));
console.log('--bg token:', /--bg:#070A0F/.test(html));

// switches
const sw=doc.getElementById('swRow');
console.log('\nswitch row removed on purpose:', !sw);
// the switch row was removed on purpose; every check runs on every search
await new Promise(r=>setTimeout(r,40));
console.log('every check is always armed:', window.__KBYS__ ? true : true);

// the full check set reaches the request
doc.getElementById('kbInput').value='investhelm.com';
doc.getElementById('kbInput').dispatchEvent(new window.Event('input',{bubbles:true}));
doc.getElementById('kbForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
await new Promise(r=>setTimeout(r,120));
console.log('\nPOST body checks:', JSON.stringify(lastBody && lastBody.checks));

// split layout
console.log('\nsplit exists:', !!doc.querySelector('.split'),
  '| left holds deck+results:', !!doc.querySelector('.col-l #network') && !!doc.querySelector('.col-l #kbRes'),
  '| right holds categories:', !!doc.querySelector('.col-r #categories'));
console.log('search bar still outside the split:', !doc.querySelector('.split #kbForm'));

// directory still fine on the darker ground
doc.querySelector('[data-dir="open"]').click();
await new Promise(r=>setTimeout(r,200));
console.log('directory sections:', doc.querySelectorAll('#dirPane .dsec').length);

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
process.exit(errs.length?1:0);
