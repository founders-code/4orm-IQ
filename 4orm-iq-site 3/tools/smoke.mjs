import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html','utf8');
const errs = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://4ormiq.com/?live=1&debug=1',
  beforeParse(w){
    w.IntersectionObserver = class { constructor(){} observe(){} unobserve(){} disconnect(){} };
    w.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
    w.scrollTo = () => {};
    w.requestAnimationFrame = cb => setTimeout(cb,0);
    w.fetch = () => Promise.reject(new TypeError('blocked'));
    w.addEventListener('error', e => errs.push('window.error: ' + (e.error?.stack || e.message)));
  }
});
const { window } = dom;
const origErr = window.console.error;
window.console.error = (...a) => { errs.push('console.error: ' + a.join(' ')); origErr(...a); };

await new Promise(r => setTimeout(r, 900));

// Build a realistic live payload and drive the render path.
const payload = {
  name:'INVESTHELM', domain:'investhelm.com', verdict:'RED',
  headline:'Material contradictions found', statement:'The promotional material claims results that predate the domain.',
  idc:82, cov:64,
  reads:[['31','Sources checked'],['4','Jurisdictions touched'],['12','Verified facts'],['6','Concerns']],
  stats:[['31','','Sources returning a result',65,'a','of 48 that should have applied'],
         ['14','','Authoritative records',45,'a','government, regulator, court or registry'],
         ['5','','Claims cross-examined',100,'a','3 contradicted by the record'],
         ['6','','Material issues',100,'c','2 critical, 3 high'],
         ['17','','Sources not reached',35,'n','every one named further down this page']],
  bars:[['Tier A, authoritative',14,'a'],['Tier B, structured',6,'b'],['Tier D, open web',11,'c'],
        ['Sources not reached',17,'n'],['Claims cross-examined',5,'a'],['Material issues',6,'a']],
  barFoot:'31 sources returned a definitive result.',
  cats:{ c1:{state:'adverse',sum:'No corporate record found.',ev:[{t:'A',src:'ICANN RDAP',when:'2026-08-26',find:'Domain created 22 February 2026.',quote:'created: 2026-02-22',url:'https://rdap.org/domain/investhelm.com'}]} },
  claims:[{q:'$1.35 billion earned in 2025',s:'ICANN RDAP',r:'Domain created 2026-02-22',v:'RED'}],
  issues:[{t:'Claimed results predate the domain',x:'The site claims 2025 results on a domain created in 2026.',sev:'critical',tier:'A'}],
  bys:['Ask for the registration number and check it yourself.'],
  gaps:[['ASC Caution List','Register did not respond within the time limit.']],
  unresolved:['Who operates nexlares.com?'],
  reviews:{checked:15,carrying:0,reports:0,state:'manufactured',note:'No organic negative corpus was found.',rows:[]},
  ledger:[
    {platform:'Trustpilot',host:'trustpilot.com',board:'Trustpilot',searched:true,pages:2,urls:[]},
    {platform:'Forex Peace Army',host:'forexpeacearmy.com',board:'Forex Peace Army',searched:true,pages:0,urls:[]},
    {platform:'Reddit',host:'reddit.com',board:'Reddit',searched:true,pages:3,urls:[]},
    {platform:'WikiFX',host:'wikifx.com',board:null,searched:true,pages:0,urls:[]}
  ],
  retrieved:[
    {tier:'Exa',label:'C3 caution and warning lists',url:'https://www.bcsc.bc.ca/caution',title:'BCSC Caution List',date:'2026-03-01',host:'bcsc.bc.ca',reg:['BCSC Caution List'],snip:'Investhelm is not registered.'},
    {tier:'Parallel',label:'Negative review narratives',url:'https://www.reddit.com/r/scams/x',title:'Reddit thread',date:null,host:'reddit.com',reg:['Reddit'],snip:'Someone asked about this site.'}
  ],
  board:{'ICANN RDAP':'clear','BCSC Caution List':'adverse','Reddit':'clear','Trustpilot':'clear','Mail Config':'clear','Infrastructure Cluster':'adverse'},
  live:true, checked_at:new Date().toISOString(),
  pipeline:{connectors:{reached:3,unreached:1,siblings:1},
    exa:{calls:10,ok:9,results:38,cost_usd:0.11},
    parallel:{calls:3,ok:3,results:14},
    claude:{model:'claude-sonnet-5',input_tokens:41000,output_tokens:5200},
    ms:{retrieval:14200,exa:6100,total:38400},
    store:{stored:false,reason:'no_database'}}
};

try {
  window.__KBYS__.toResult(payload,'investhelm.com');
  console.log('toResult: ok');
} catch(e){ errs.push('toResult threw: ' + e.stack); }

await new Promise(r=>setTimeout(r,300));

{
  const bys = window.document.getElementById('kbBys').innerHTML;
  console.log('before you send still on the page:', bys.length>0);
  console.log('duplicated stacked sections gone:',
    !window.document.getElementById('kbRevSec') &&
    !window.document.getElementById('kbClaimSec') &&
    !window.document.getElementById('kbIssueSec') &&
    !window.document.getElementById('kbGapSec'));
}

try {
  window.__KBYS__.buildAudit(payload);
  const body = window.document.getElementById('arBody').innerHTML;
  console.log('buildAudit: ok, ' + body.length + ' chars');
  ['Section 05','Section 09','Section 10','Which platforms were swept','Forex Peace Army','bcsc.bc.ca','How this check was run','platforms swept']
    .forEach(t => console.log((body.includes(t)?'  found  ':'  MISSING') + '  ' + t));
  console.log('board count text: ' + window.document.getElementById('boardC').textContent);
} catch(e){ errs.push('buildAudit threw: ' + e.stack); }

// error path
try {
  window.__KBYS__.toResult(window.__KBYS__.errorResult('badinput.com','The request never reached the endpoint.'),'badinput.com');
  console.log('error path: ok');
} catch(e){ errs.push('error path threw: ' + e.stack); }

console.log('\n--- errors captured: ' + errs.length + ' ---');
errs.forEach(e => console.log(e.slice(0,400)));
process.exit(errs.length ? 1 : 0);
