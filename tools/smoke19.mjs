/* SR-001 ENFORCEMENT, MEASURED
 *
 * A guard that reads the source proves the code is present. This one runs the
 * page twice, once with enforcement off and once on, and counts what the board
 * actually draws. The control is only real if turning it on changes what a
 * reader sees. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const base = fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');

async function run(enforce){
  const html = base.replace(/var SR001_ENFORCE = (true|false);/,'var SR001_ENFORCE = '+enforce+';');
  const errs=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?debug=1',
    beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
      w.print=()=>{}; w.URL.createObjectURL=()=>'blob:t'; w.URL.revokeObjectURL=()=>{};
      w.addEventListener('error',e=>errs.push(e.error?.stack||e.message)); }});
  const {window}=dom, doc=window.document;
  window.Element.prototype.scrollTo=function(){};
  await new Promise(r=>setTimeout(r,900));
  const chips=[...doc.querySelectorAll('#brows .src')];
  const states={};
  chips.forEach(c=>{const s=c.getAttribute('data-s')||'?'; states[s]=(states[s]||0)+1;});
  const warn=doc.getElementById('srWarn');
  const shown=warn && warn.style.display!=='none';
  dom.window.close();
  return {chips:chips.length, states, banner:!!shown, errs:errs.length};
}

const off=await run(false), on=await run(true);
console.log('ENFORCEMENT OFF');
console.log('  chips        ', off.chips);
console.log('  states       ', JSON.stringify(off.states));
console.log('  banner shown ', off.banner);
console.log('\nENFORCEMENT ON  (register has nothing enabled)');
console.log('  chips        ', on.chips);
console.log('  states       ', JSON.stringify(on.states));
console.log('  banner shown ', on.banner);

const fails=[];
if(off.chips===0 || on.chips===0) fails.push('the board did not render in one of the two runs');
if(off.banner!==true)  fails.push('enforcement is off and the page does not warn');
if(on.banner!==false)  fails.push('enforcement is on and the page still warns');
/* The measurement that matters: with nothing enabled, every register must be
   out of scope. Any chip in another state is a source running without a row. */
const policy = on.states['policy']||0;
if(policy !== on.chips)
  fails.push('enforcement is on and nothing is enabled, yet ' + (on.chips-policy)
    + ' of ' + on.chips + ' registers are not marked out of scope');
if((off.states['policy']||0) !== 0)
  fails.push('enforcement is off and ' + off.states['policy'] + ' registers are still excluded');
if(off.errs||on.errs) fails.push('page errors: '+(off.errs+on.errs));

console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f=>console.log('  '+f));
process.exit(0);
