/* Find support: the directory must not run the full width of a wide screen. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);}});
const {window}=dom, doc=window.document;
window.Element.prototype.scrollTo=function(){};
await new Promise(r=>setTimeout(r,700));

console.log('directory capped and centred:',
  html.includes('max-width:1080px;margin-left:auto;margin-right:auto'));
console.log('contact column bounded:', html.includes('min-width:250px;max-width:330px'));
console.log('entry prose bounded:', html.includes('min-width:min(100%,260px);max-width:62ch'));

Object.defineProperty(window.HTMLElement.prototype,'offsetTop',{get(){return 0;},configurable:true});
doc.querySelector('[data-dir="open"]').click();
await new Promise(r=>setTimeout(r,320));
const box=doc.querySelector('.dirbox');
console.log('directory opens:', !!box && box.classList.contains('on'));
console.log('sections still rendered at once:', doc.getElementById('dirPane').querySelectorAll('.dsec').length);
console.log('phone numbers still upfront:', doc.getElementById('dirPane').querySelectorAll('a.cv[href^="tel:"]').length);
dom.window.close(); process.exit(0);
