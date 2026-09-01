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
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?demo=1&debug=1',
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
console.log('\nENFORCEMENT ON  (register decides)');
console.log('  chips        ', on.chips);
console.log('  states       ', JSON.stringify(on.states));
console.log('  banner shown ', on.banner);

const fails=[];
if(off.chips===0 || on.chips===0) fails.push('the board did not render in one of the two runs');
if(off.banner!==true)  fails.push('enforcement is off and the page does not warn');
if(on.banner!==false)  fails.push('enforcement is on and the page still warns');
/* The measurement that matters: with nothing enabled, every register must be
   out of scope. Any chip in another state is a source running without a row. */
/* The register now enables most chips and disables the 36 that appear on the
   board with no source row behind them. So the measurement is not "everything
   dark", it is "the split matches the register exactly". */
const policy = on.states['policy']||0, live = on.chips - policy;
console.log('\n  out of scope :', policy, '| in scope:', live);
if(policy === 0)
  fails.push('enforcement is on and nothing is excluded, so the switch does nothing');
if(live === 0)
  fails.push('enforcement is on and everything is excluded, so the board is unusable');
/* And the split must be the register's, not a coincidence. */
const man = JSON.parse(base.match(/var SR001 = ([\s\S]*?);\n\/\* SR001-MANIFEST-END/)[1]);
const enabled = new Set(man.enabled);
const boardNames = (eval(base.match(/var SOURCES\s*=\s*(\[[\s\S]*?\n\]);/)[1]))
  .flatMap(g => g.items);
const expectLive = boardNames.filter(n => enabled.has(n)).length;
if(live !== expectLive)
  fails.push('the board shows ' + live + ' registers in scope and the register enables '
    + expectLive + ' of them');
if((off.states['policy']||0) !== 0)
  fails.push('enforcement is off and ' + off.states['policy'] + ' registers are still excluded');
if(off.errs||on.errs) fails.push('page errors: '+(off.errs+on.errs));

console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f=>console.log('  '+f));
process.exit(0);
