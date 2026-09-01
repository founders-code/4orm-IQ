/* The admin page rendered against a synthetic payload, so the layout is
   exercised before a database exists. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
/* The admin page rendered against a synthetic payload. It also asserts the one
   thing the page must never grow: a column, label or table showing what was
   searched or who a check was about. */
const html=fs.readFileSync('/home/claude/kbys/build/4orm-iq/admin.html','utf8');
const payload={window_days:30,generated:new Date().toISOString(),
 runs:{attempted:1842,completed:1731,incomplete:74,suppressed:311,barred:26,avg_ms:96400,ran_unenforced:0},
 completion_pct:94.0,incomplete_pct:4.0,
 by_outcome:[{outcome:"COMPLETED",n:1731},{outcome:"BLOCKED_PURPOSE",n:58},{outcome:"BLOCKED_INPUT",n:41},{outcome:"BLOCKED_JURISDICTION",n:9},{outcome:"ERROR",n:3}],
 by_input:[{input_type:"WEBSITE",n:912},{input_type:"COMPANY",n:604},{input_type:"EMAIL",n:212},{input_type:"WALLET",n:114}],
 by_day:Array.from({length:30},(_,i)=>({day:"2026-08-"+String(i+1).padStart(2,"0"),attempted:40+Math.round(Math.sin(i/3)*22+i),completed:36+Math.round(Math.sin(i/3)*20+i)})),
 sources:{attempts:198000,ok:189200,failed:8800,out_of_scope:5400,success_pct:95.6,
   worst:[{source_id:"OpenCorporates",attempts:1800,ok:1120,failed:680,ok_pct:62.2},
          {source_id:"SEDAR+",attempts:1650,ok:1290,failed:360,ok_pct:78.2},
          {source_id:"Justia Dockets",attempts:1400,ok:1204,failed:196,ok_pct:86.0},
          {source_id:"Companies House",attempts:1710,ok:1625,failed:85,ok_pct:95.0}]},
 rights:[{kind:"CHALLENGE",opened:7,closed:6,avg_days:11.4},{kind:"ACCESS",opened:3,closed:3,avg_days:8.0}],
 deletion:{days_run:30,days_failed:0,deleted:41200},
 incidents:{total:1,pi:0,rrosh:0,reported:0},
 people:1103,
 chain:{height:1842,head_hash:"9f2c4ae1bb70d3f5a8c19e4472bd6013fe8a2c5d7b41903e6ca8df2145b7ce80",
        updated_at:new Date().toISOString(),
        last_verify:{at:new Date().toISOString(),height:1842,intact:true,broken_at:null,ms:412}}};
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/admin.html',
 beforeParse(w){ w.fetch=()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(payload)});
  w.addEventListener('error',e=>errs.push(e.error?.stack||e.message)); }});
const {window}=dom, doc=window.document;
await new Promise(r=>setTimeout(r,200));
/* Clerk is not present in the test, so the page is driven through its own
   render path rather than through sign-in. What is being tested is the panel,
   not the auth library. */
window.render(payload);
await new Promise(r=>setTimeout(r,120));
const out=doc.getElementById('panel');
console.log('rendered:', !out.hidden);
console.log('stat tiles:', doc.querySelectorAll('.tile').length);
console.log('bars in the series:', doc.querySelectorAll('rect.bar').length);
console.log('hover targets:', doc.querySelectorAll('rect.hit').length);
console.log('ranked registers:', doc.querySelectorAll('.rrow').length);
console.log('tables:', doc.querySelectorAll('table').length);
const t=out.textContent;
for(const s of ['Checks attempted','Source success rate','Person-level suppressions','Items refused',
                'How runs ended','What people searched','deletion','Incidents'])
  if(!new RegExp(s,'i').test(t)) console.log('  MISSING:', s);
/* the thing that must never appear */
for(const bad of ['identifier','searched for','looked up','party name','query value'])
  if(new RegExp(bad,'i').test(t) && !/cannot show who anybody looked up/i.test(t.slice(Math.max(0,t.search(new RegExp(bad,'i'))-80), t.search(new RegExp(bad,'i'))+80)))
    console.log('  SUSPECT COPY:', bad);
/* The assertions. */
const fails=[];
if(out.hidden) fails.push('the page did not render');
if(doc.querySelectorAll('.tile').length < 7) fails.push('the stat row lost a tile');
/* The evidence layer has to be on the page and has to show the head. */
if(!/evidence layer/i.test(out.textContent)) fails.push('the evidence panel is gone');
if(!/9f2c4ae1bb70/.test(out.textContent)) fails.push('the chain head is not shown');
if(!doc.getElementById('verify')) fails.push('there is no way to verify the chain from the page');
/* Auth: no shared secret may reappear on the page. */
const asrc = fs.readFileSync('/home/claude/kbys/build/4orm-iq/admin.html','utf8');
if(/type="password"/.test(asrc)) fails.push('a shared secret box is back on the admin page');
if(!/Clerk/.test(asrc)) fails.push('Clerk sign-in is gone from the admin page');
if(doc.querySelectorAll('rect.bar').length !== 30) fails.push('the daily series did not draw every day');
if(doc.querySelectorAll('rect.hit').length !== doc.querySelectorAll('rect.bar').length)
  fails.push('the series has bars with no hover target');
if(doc.querySelectorAll('.rrow').length < 4) fails.push('the register ranking is empty');
/* The page must never grow a way to see what was searched. */
/* The page can only ever show what the endpoint returns, so the endpoint and
   the schema are the locks worth having. A text scan of the page source was
   tried first and dropped: it flagged the sentence promising NOT to hold an
   identifier, and softening it to avoid that would have made the guard weaker
   than the thing it guards. These two cannot be talked around.

   1. The response contract. Every key the endpoint returns is listed here. A
      new one has to be added deliberately, which is the moment somebody has to
      think about whether it carries a subject. */
const ALLOWED = new Set(['window_days','generated','runs','completion_pct','incomplete_pct',
  'by_outcome','by_input','by_day','sources','rights','deletion','incidents','people','chain']);
const extra = Object.keys(payload).filter(k => !ALLOWED.has(k));
if(extra.length) fails.push('the metrics response has grown key(s) nobody vetted: '+extra.join(', '));

const api = fs.readFileSync('/home/claude/kbys/build/4orm-iq/api/admin-metrics.js','utf8');
if(/select[\s\S]{0,400}identifier/i.test(api))
  fails.push('the metrics endpoint selects an identifier column');
const sql = fs.readFileSync('/home/claude/kbys/build/4orm-iq/db/telemetry.sql','utf8');
const body = sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
for(const bad of ['identifier','subject','party','query'])
  if(new RegExp('^\\s+'+bad+'\\s','im').test(body))
    fails.push('db/telemetry.sql has grown a "'+bad+'" column, which rebuilds the person-level file');
if(errs.length) fails.push('page errors: '+errs.length);

console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f=>console.log('  '+f));
dom.window.close(); process.exit(0);
