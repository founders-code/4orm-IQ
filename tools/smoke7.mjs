import fs from 'fs'; import { JSDOM } from 'jsdom';
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs=[];
// fake NDJSON stream
const events = [
 {t:'phase',v:{step:'plan',label:'Planning the sweep',searches:16,objectives:3,categories:10}},
 {t:'phase',v:{step:'retrieve',label:'Reading the registers'}},
 {t:'phase',v:{step:'retrieved',label:'Registers read',ok:14,of:16,pages:58,ms:31000}},
 {t:'phase',v:{step:'round2',label:'Following what the first pass found',searches:5,seeds:{people:['Christopher Delgado']}}},
 {t:'phase',v:{step:'research',label:'Assembling what no single page answers'}},
 {t:'partial',v:{board:{'ICANN RDAP':'clear','DOJ Press':'adverse','IRS-CI':'adverse','Florida Sunbiz':'clear','FinCEN MSB':'clear','Reddit':'caution'},
   ledger:[{platform:'Trustpilot',host:'trustpilot.com',searched:true,pages:2,urls:[]}],
   retrieved:[{tier:'Exa',label:'C3',url:'https://justice.gov/x',title:'DOJ',date:null,host:'justice.gov',reg:['DOJ Press'],snip:'x'}],
   counts:{registers_reached:6,pages:58,platforms_searched:15,platforms_returning:3},ms:64000}},
 {t:'phase',v:{step:'reason',label:'Cross-examining the evidence'}},
 {t:'result',v:{name:'GOLIATH VENTURES',domain:'goliathventuresinc.com',verdict:'RED',headline:'High risk',
   statement:'Material contradictions found.',idc:95,cov:78,
   reads:[['31','Sources checked']],stats:[['31','','Sources returning a result',65,'a','of 64']],
   bars:[['Tier A',14,'a']],barFoot:'x',
   cats:{C1:{state:'RED',sum:'s',ev:[]},C2:{state:'RED',sum:'s',ev:[]},C3:{state:'RED',sum:'s',ev:[]},C4:{state:'RED',sum:'s',ev:[]},
         C5:{state:'RED',sum:'s',ev:[]},C6:{state:'GREEN',sum:'s',ev:[]},C7:{state:'YELLOW',sum:'s',ev:[]},C8:{state:'GREY',sum:'s',ev:[]},
         C9:{state:'RED',sum:'s',ev:[]},C10:{state:'RED',sum:'s',ev:[]}},
   claims:[],issues:[{t:'i',x:'y',sev:'critical',tier:'A'}],bys:['do a thing'],gaps:[['X','y']],unresolved:[],
   reviews:{checked:15,carrying:3,reports:22,state:'organic',note:'',rows:[]},
   ledger:[{platform:'Trustpilot',host:'trustpilot.com',searched:true,pages:2,urls:[]}],
   retrieved:[],board:{'ICANN RDAP':'clear','DOJ Press':'adverse','IRS-CI':'adverse','Florida Sunbiz':'clear','FinCEN MSB':'clear','Reddit':'caution'},
   live:true,pipeline:{exa:{calls:21,round1:16,round2:5,ok:19,results:58},parallel:{calls:3,ok:3,results:12},
     connectors:{reached:2,unreached:0,siblings:1},claude:{model:'claude-sonnet-5',input_tokens:52000,output_tokens:6100},
     ms:{total:118000},store:{stored:false,reason:'no_database'}}}}
];
const ndjson = events.map(e=>JSON.stringify(e)).join('\n')+'\n';
const seen=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?live=1&debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(cb,0);
  w.TextDecoder = TextDecoder;
  w.fetch=()=>{
    const chunks=ndjson.split('\n').filter(Boolean).map(l=>new TextEncoder().encode(l+'\n'));
    let i=0;
    return Promise.resolve({ ok:true, status:200,
      headers:{get:()=>'application/x-ndjson; charset=utf-8'},
      body:{ getReader(){ return { read(){ return new Promise(res=>setTimeout(()=>{
        if(i<chunks.length) res({done:false,value:chunks[i++]}); else res({done:true,value:undefined});
      }, 40)); } }; } } });
  };
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
await new Promise(r=>setTimeout(r,900));
if(doc.getElementById('waitOk')) doc.getElementById('waitOk').click();
await new Promise(r=>setTimeout(r,600));


window.__KBYS__.check('goliath ventures');
setTimeout(()=>doc.getElementById('waitOk').click(),300);
const poll=setInterval(()=>seen.push(doc.getElementById('modeLbl').textContent),120);
await new Promise(r=>setTimeout(r,6000));
clearInterval(poll);
const uniq=[...new Set(seen)];
console.log('\nphases the user saw, in order:');
uniq.forEach(u=>console.log('  '+u));
console.log('\nboard after stream:', doc.getElementById('boardC').textContent);
console.log('verdict:', doc.getElementById('kbBadgeT').textContent, '| rail cards:', doc.getElementById('sbRight').children.length);
console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log(e.slice(0,300)));
process.exit(errs.length?1:0);
