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
        schemas:[{hash_schema:"v1",n:1200},{hash_schema:"v2",n:642}],
        last_verify:{at:new Date().toISOString(),height:1842,intact:true,broken_at:null,ms:412}},
 by_sector:[{sector:"INVESTMENT",n:900},{sector:"UNDECLARED",n:942}],
 policy:{head:{height:3,head_hash:"c71b0e4d99aa2f6318bd45c0a7e2f19d3b8046ca5127ee9034fb7a6d21c805ef",
               updated_at:new Date().toISOString()},
   history:[
     {seq:3,at:new Date().toISOString(),version:"2026-09-01",effective_from:"2026-09-01",
      change_kind:"RULE_CHANGED",summary:"Row hashes carry a schema marker.",
      reason:"Recorded fields have to grow without invalidating earlier hashes.",
      evidence_url:null,author:"4orm Finance",sources_enabled:175,sources_total:153,
      enforcement_on:true,manifest_generated:"2026-09-01"},
     {seq:2,at:new Date().toISOString(),version:"2026-08-31",effective_from:"2026-08-31",
      change_kind:"SOURCE_ADDED",summary:"Two provincial registers added.",
      reason:"Coverage gap in Atlantic Canada.",
      evidence_url:"https://example.org/notice",author:"4orm Finance",
      sources_enabled:173,sources_total:153,enforcement_on:true,manifest_generated:"2026-08-31"},
     {seq:1,at:new Date().toISOString(),version:"2026-08-29",effective_from:"2026-08-29",
      change_kind:"INITIAL",summary:"First recorded rule set.",reason:null,
      evidence_url:null,author:"4orm Finance",sources_enabled:170,sources_total:153,
      enforcement_on:true,manifest_generated:"2026-08-29"}]}};
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
/* The rule history. A version string on every run row that points at nothing
   is worse than no version string, so the page has to show what it points at. */
if(!/every time they changed/i.test(out.textContent)) fails.push('the rule history panel is gone');
if(!/2026-09-01/.test(out.textContent)) fails.push('the rule versions are not shown');
if(!/c71b0e4d99aa/.test(out.textContent)) fails.push('the rule chain head is not shown');
if(!/SOURCE_ADDED/.test(out.textContent)) fails.push('what kind of change it was is not shown');
if(!/Coverage gap in Atlantic Canada/.test(out.textContent)) fails.push('the reason for a change is not shown');
if(!/example\.org\/notice/.test(out.innerHTML)) fails.push('the evidence for a change is not linked');
if(!/v1[\s\S]{0,40}v2/.test(out.textContent)) fails.push('the hash schemas in use are not shown');
/* Markup without styling has shipped here before: every class the panel emits
   must resolve to a rule, or the panel renders in document flow looking broken. */
for(const cls of ['tw','q'])
  if(!new RegExp('\\.'+cls+'[{ ,:]').test(html)) fails.push('.'+cls+' is used but has no CSS rule');
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
  'by_outcome','by_input','by_day','sources','rights','deletion','incidents','people','chain',
  /* Vetted 2026-09-01. by_sector is the category a check was run under, which is
     a shape, not a subject. policy is the rule history: what WE decided and
     when, carrying nothing about any party we checked. */
  'by_sector','policy']);
const extra = Object.keys(payload).filter(k => !ALLOWED.has(k));
if(extra.length) fails.push('the metrics response has grown key(s) nobody vetted: '+extra.join(', '));

const api = fs.readFileSync('/home/claude/kbys/build/4orm-iq/api/admin-metrics.js','utf8');
if(/select[\s\S]{0,400}identifier/i.test(api))
  fails.push('the metrics endpoint selects an identifier column');
/* The rule history is about us, not about anybody we checked, and it must stay
   that way: it is the one table on this page with free text in it. */
if(/\bpolicy\b[\s\S]{0,300}\b(identifier|subject|party|searched)\b/i.test(api))
  fails.push('the rule history has grown a field that could name a party');
/* 2. THE SCHEMA LOCK, ACROSS BOTH FILES.
      This read only db/telemetry.sql, and the privacy notice pointed at it as
      the guarantee that no column names a subject. It was true of that file
      and false of the product: db/schema.sql declared "identifier text not
      null" on an index, and the run store wrote the whole rendered payload
      beside it. A guard that reads one of two schemas is a guard that can be
      satisfied while the promise it stands for is broken, so it now reads
      both, and the corpus schema carries two extra bans of its own. */
const SCHEMAS = [
  ['db/telemetry.sql', ['identifier','subject','party','query']],
  /* identifier_hash is allowed and identifier is not, which is the whole
     point of migration 004: a repeat can be recognised, the string cannot be
     recovered. payload and headline are banned because a stored render is a
     stored result, and the notice says results are not kept. */
  ['db/schema.sql',    ['identifier','subject','party','payload','headline']],
  ['db/schema.neon.sql',['identifier','subject','party','payload','headline']],
];
for (const [file, banned] of SCHEMAS) {
  const sql = fs.readFileSync('/home/claude/kbys/build/4orm-iq/'+file,'utf8');
  const body = sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
  for (const bad of banned)
    if (new RegExp('^\\s+'+bad+'\\s','im').test(body))
      fails.push(file+' has grown a "'+bad+'" column, which rebuilds the person-level file');
}
/* And the write path itself. The schema can be clean while the code writes a
   name into a column that does not announce itself. */
const store = fs.readFileSync('/home/claude/kbys/build/4orm-iq/api/_store.js','utf8');
if(!/PERSON_NODE_TYPES\s*=\s*new Set\(/.test(store))
  fails.push('the corpus write path no longer declares which node types carry a person');
const setAt = store.indexOf('PERSON_NODE_TYPES = new Set(');
const setBody = setAt < 0 ? '' : store.slice(setAt, setAt + 400);
for(const t of ['PERSON','DIRECTOR','OFFICER','PROMOTER','ADVISER'])
  if(!new RegExp("'"+t+"'").test(setBody))
    fails.push('the corpus write path stopped refusing '+t+' nodes');
if((store.match(/isPersonNode\(/g)||[]).length < 4)
  fails.push('the person refusal is no longer applied at every write into the graph');
if(/JSON\.stringify\(payload\)/.test(store))
  fails.push('the run store writes the whole render payload again');
if(!/function identifierHash/.test(store) || !/process\.env\.CORPUS_SALT/.test(store))
  fails.push('the search string is no longer hashed with a required salt before it is written');
if(/trim\(identifier,\s*\d+\)/.test(store))
  fails.push('the run store writes the search string verbatim');
if(errs.length) fails.push('page errors: '+errs.length);

console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f=>console.log('  '+f));
dom.window.close(); process.exit(0);
