/* Find support: the directory must not run the full width of a wide screen. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?demo=1&debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);}});
const {window}=dom, doc=window.document;
window.Element.prototype.scrollTo=function(){};
await new Promise(r=>setTimeout(r,700));

/* These were three string literals against a stylesheet that has since been
   rewritten twice, and they printed false while the file exited zero, which is
   a check that has stopped checking. They read the live rules now and they
   fail. */
const fails = [];
const rule = sel => (html.match(new RegExp('\\n\\' + sel + '\\{[^}]*\\}')) || [''])[0];
const cap = (sel, prop) => (rule(sel).match(new RegExp(prop + ':(\\d+)(?:px|ch)')) || [])[1];
{
  const dir = rule('.dirbox');
  const w = Number(cap('.dirbox', 'max-width'));
  if (!w) fails.push('the directory has no width cap, so it runs the whole of a wide screen');
  else if (w > 1400) fails.push('the directory is capped at ' + w + 'px, which is not a cap');
  if (!/margin-left:auto;margin-right:auto/.test(dir))
    fails.push('the directory is capped but not centred, so it sits against one edge');
  const right = Number(cap('.entry .eright', 'max-width'));
  if (!right) fails.push('the contact column is unbounded, so a long address sets the row width');
  const left = Number(cap('.entry .eleft', 'max-width'));
  if (!left) fails.push('the entry prose is unbounded, so a paragraph runs the full panel');
  console.log('directory capped and centred:', w + 'px, centred ' + /margin-left:auto/.test(dir));
  console.log('contact column bounded:', right + 'px');
  console.log('entry prose bounded:', left + 'ch');
}

Object.defineProperty(window.HTMLElement.prototype,'offsetTop',{get(){return 0;},configurable:true});
doc.querySelector('[data-dir="open"]').click();
await new Promise(r=>setTimeout(r,320));
const box=doc.querySelector('.dirbox');
console.log('directory opens:', !!box && box.classList.contains('on'));
console.log('sections still rendered at once:', doc.getElementById('dirPane').querySelectorAll('.dsec').length);
console.log('phone numbers still upfront:', doc.getElementById('dirPane').querySelectorAll('a.cv[href^="tel:"]').length);
if (!box || !box.classList.contains('on')) fails.push('the directory does not open');
if (!doc.getElementById('dirPane').querySelectorAll('.dsec').length)
  fails.push('the directory opened with no sections in it');
if (!doc.getElementById('dirPane').querySelectorAll('a.cv[href^="tel:"]').length)
  fails.push('the directory carries no phone numbers, which is the only reason it exists');
dom.window.close();
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
