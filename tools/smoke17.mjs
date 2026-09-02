/* The counter tells the truth or says nothing. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const P='/home/claude/kbys/build/4orm-iq/index.html';
const html=fs.readFileSync(P,'utf8');

async function run(stats, label){
  const errs=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/',
   beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
    w.fetch=(u)=>{
      if(String(u).indexOf('/api/counter')>-1){
        if(stats==='fail') return Promise.reject(new Error('down'));
        if(stats==='500')  return Promise.resolve({ok:false,status:500,json:()=>Promise.resolve({})});
        return Promise.resolve({ok:true,json:()=>Promise.resolve(stats)});
      }
      return Promise.reject(new Error('no'));
    };
    w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));}});
  const {window}=dom, doc=window.document;
  window.console.error=(...a)=>errs.push(a.join(' '));
  window.Element.prototype.scrollTo=function(){};
  await new Promise(r=>setTimeout(r,700));
  const row=doc.getElementById('servedRow');
  const shown=row.classList.contains('on');
  const value=shown?doc.getElementById('servedN').textContent:'-';
  console.log(label.padEnd(38)+' shown: '+String(shown).padEnd(6)+
    ' value: '+value.padEnd(8)+'  errors: '+errs.length);
  if(errs.length) FAIL.push(label.trim()+' put an error on the page: '+errs[0].slice(0,100));
  dom.window.close();
  return {shown, value};
}
/* A probe that prints and exits zero is not a probe. */
const FAIL=[];
const expect=(r,want,label)=>{
  if(r.shown!==want)
    FAIL.push(label.trim()+': the counter is '+(r.shown?'shown':'hidden')+' and should be '+(want?'shown':'hidden'));
};

console.log('CHECKS RUN');
/* A real number is shown. Everything else says nothing at all, because a
   counter that guesses is worse than no counter. */
expect(await run({available:true, checks:1487, people:1102, since:'2026-08-01'}, '  a real count'),
       true,  'a real count');
expect(await run({available:true, checks:0, since:null},                  '  a real zero'),
       true,  'a real zero');
expect(await run({available:false, reason:'no_database_configured'},      '  no database configured'),
       false, 'no database configured');
expect(await run({available:false, reason:'unavailable'},                 '  database unreachable'),
       false, 'database unreachable');
expect(await run('fail',                                                  '  endpoint down'),
       false, 'endpoint down');
expect(await run('500',                                                   '  endpoint errors'),
       false, 'endpoint errors');
expect(await run({checks:9999},                                           '  a payload without available:true'),
       false, 'a payload without available:true');
expect(await run({available:true, checks:'lots'},                         '  a payload with a non number'),
       false, 'a payload with a non number');

const seeded = /servedN"[^>]*>\s*[1-9]/.test(html) || html.indexOf('servedN">0<')===-1;
const timed  = /setInterval\([^)]*[Ss]erved/.test(html);
if(seeded) FAIL.push('the page ships with a seed value in the counter, which is a number nobody earned');
if(timed)  FAIL.push('something increments the counter on a timer');
console.log('\nno seed value anywhere in the page:', !seeded);
console.log('nothing climbs on a timer:', !timed);
console.log('\n' + (FAIL.length ? 'FAILED' : 'PASSED'));
FAIL.forEach(f=>console.log('  '+f));
process.exit(FAIL.length?1:0);
