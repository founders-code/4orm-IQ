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
      if(String(u).indexOf('/api/stats')>-1){
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
  console.log(label.padEnd(38)+' shown: '+String(shown).padEnd(6)+
    ' value: '+(shown?doc.getElementById('servedN').textContent:'-')+
    '  errors: '+errs.length);
  dom.window.close();
  return {shown, doc, window};
}

console.log('CUSTOMERS SERVED');
await run({available:true, runs:1487, parties:1102, since:'2026-08-01'}, '  a real count');
await run({available:true, runs:0, since:null},                          '  a real zero');
await run({available:false, reason:'no_database_configured'},            '  no database configured');
await run({available:false, reason:'unavailable'},                       '  database unreachable');
await run('fail',                                                        '  endpoint down');
await run('500',                                                         '  endpoint errors');
await run({runs:9999},                                                   '  a payload without available:true');
await run({available:true, runs:'lots'},                                 '  a payload with a non number');

console.log('\nno seed value anywhere in the page:',
  !/servedN"[^>]*>\s*[1-9]/.test(html) && html.indexOf('servedN">0<')>-1);
console.log('nothing climbs on a timer:', !/setInterval\([^)]*[Ss]erved/.test(html));
console.log('the demo never counts:', /if\(LIVE\) bumpServed\(\);/.test(html));
process.exit(0);
