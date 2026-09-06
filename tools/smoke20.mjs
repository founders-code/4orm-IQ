/* The back office rendered against a synthetic payload in the shape the metrics
   route actually returns, so the whole board is exercised before a database
   exists. It also asserts the one thing this page must never grow: a column,
   label or table showing what was searched or who a check was about. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const html = fs.readFileSync('/home/claude/kbys/build/4orm-iq/admin.html', 'utf8');

const payload = {
  build:{ api:'20260905.0838', page:'20260905.0838', match:true },
  systems:{ search:'ok', reason:'ok', connectors:'warn', rdap:'ok', db:'ok', chain:'ok',
            policy:'ok', retention:'ok', auth:'ok', deploy:'ok' },
  registers:{ down:{ 1:3, 2:5 }, quiet:{ 0:2, 5:1, 9:4 } },
  documents:{ hra:'warn', mg:'warn', lr:'warn', pub:'bad', sub:'bad', vend:'warn',
              ret:'warn', ir:'warn', sec:'bad', cou:'warn' },
  window_days:30, generated:new Date().toISOString(),
  runs:{ attempted:1842, completed:1731, incomplete:74, suppressed:311, barred:26,
         avg_ms:96400, ran_unenforced:0 },
  completion_pct:94.0, incomplete_pct:4.0, people:1103,
  by_outcome:[{outcome:'COMPLETED',n:1731},{outcome:'BLOCKED_PURPOSE',n:58},
              {outcome:'BLOCKED_INPUT',n:41},{outcome:'ERROR',n:3}],
  by_input:[{input_type:'WEBSITE',n:912},{input_type:'COMPANY',n:604}],
  by_day:Array.from({length:30},(_,i)=>({day:'2026-08-'+String(i+1).padStart(2,'0'),
          attempted:40+Math.round(Math.sin(i/3)*22+i), completed:36+Math.round(Math.sin(i/3)*20+i)})),
  sources:{ attempts:198000, ok:189200, failed:8800, out_of_scope:5400, success_pct:95.6,
    worst:[{source_id:'OPENCORPORATES',display_name:'OpenCorporates',attempts:1800,ok:1120,failed:680,ok_pct:62.2},
           {source_id:'SEDAR_PLUS',display_name:'SEDAR+',attempts:1650,ok:1290,failed:360,ok_pct:78.2},
           {source_id:'JUSTIA',display_name:'Justia Dockets',attempts:1400,ok:1204,failed:196,ok_pct:86.0},
           {source_id:'UK_COMPANIES_HOUSE',display_name:'Companies House',attempts:1710,ok:1625,failed:85,ok_pct:95.0}] },
  rights:[{kind:'CHALLENGE',opened:7,closed:6,avg_days:11.4},{kind:'ACCESS',opened:3,closed:3,avg_days:8.0}],
  deletion:{ days_run:30, days_failed:0, deleted:41200 },
  incidents:{ total:1, pi:0, rrosh:0, reported:0 },
  chain:{ height:1842, head_hash:'9f2c4ae1bb70d3f5a8c19e4472bd6013fe8a2c5d7b41903e6ca8df2145b7ce80',
          updated_at:new Date().toISOString(),
          schemas:[{hash_schema:'v1',n:1200},{hash_schema:'v2',n:642}],
          last_verify:{ at:new Date().toISOString(), height:1842, intact:true, broken_at:null, ms:412 } },
  policy:{ head:{ height:3, version:'2026-09-01',
                  head_hash:'c71b0e4d99aa2f6318bd45c0a7e2f19d3b8046ca5127ee9034fb7a6d21c805ef' },
    history:[{ seq:3, version:'2026-09-01', effective_from:'2026-09-01', change_kind:'RULE_CHANGED',
               summary:'Row hashes carry a schema marker.',
               reason:'Recorded fields have to grow without invalidating earlier hashes.',
               sources_enabled:121, sources_total:153, enforcement_on:true }] },
  pulse:{ label_at:25, rows:[
    { identifier_hash:'a41f77c9e0b3', input_type:'COMPANY', label:null, n:9, was:6,
      adverse:0, clean:7, incomplete:2, first_seen:'2026-09-06T09:12:00Z' }] }
};

const errs = [];
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
  url:'https://4ormiq.com/admin.html?demo=0',
  beforeParse(w){
    /* Clerk is not present here. The page is driven through its own paint path,
       because what is under test is the board, not the auth library. */
    w.fetch = () => Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(payload) });
    w.requestAnimationFrame = f => setTimeout(f, 0);
    w.addEventListener('error', e => errs.push(e.error?.stack || e.message));
  }});
const { window } = dom, doc = window.document;
await new Promise(r => setTimeout(r, 250));
window.paint(window.normalise(payload));
await new Promise(r => setTimeout(r, 150));

const lamps = [...doc.querySelectorAll('#board .pl')];
const state = s => lamps.filter(e => e.getAttribute('data-s') === s).length;
console.log('lamps:', lamps.length, JSON.stringify({ ok:state('ok'), warn:state('warn'), bad:state('bad') }));
console.log('flow nodes:', doc.querySelectorAll('#mimic .nnode').length);
console.log('dials:', doc.querySelectorAll('#gauges .gauge').length);
console.log('registers ranked:', doc.querySelectorAll('#rank .rblk').length);
console.log('clickable:', doc.querySelectorAll('.pl,.nnode.clicky,.gauge[data-info],.rblk').length);

const t = doc.getElementById('stage').textContent;

/* the thing that must never appear */
for (const bad of ['identifier','searched for','looked up','party name','query value'])
  if (new RegExp(bad, 'i').test(t)) console.log('  SUSPECT COPY:', bad);

const fails = [];
if (lamps.length !== 26) fails.push('the annunciator is not 26 lamps');
if (doc.querySelectorAll('#mimic .nnode').length !== 20) fails.push('the flow chart lost a node');
if (doc.querySelectorAll('#gauges .gauge').length !== 5) fails.push('a dial is missing');
if (!doc.querySelector('#days svg')) fails.push('the checks per day chart did not draw');
if (!/OpenCorporates/.test(t)) fails.push('the worst register list is not naming registers');
if (!/62\.2/.test(t)) fails.push('the worst register list lost its percentage');

/* Every lamp, every stage, every dial and every register opens onto something. */
let empty = [];
lamps.forEach(el => { el.dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  if (doc.getElementById('shB').textContent.trim().length < 80)
    empty.push(el.getAttribute('data-open')); });
for (let i = 0; i < 10; i++) { window.openStage(i);
  if (!doc.querySelectorAll('#shB .plate').length) empty.push('cat' + i); }
if (empty.length) fails.push('these opened onto nothing: ' + empty.join(', '));

/* The evidence layer and the rule history were panels on the old page. They are
   cards behind their own lamps now, and the head hash has to survive the move,
   because without it there is nothing for anybody to check the counter against. */
window.openLamp('m:chain');
const chainCard = doc.getElementById('shB').textContent;
if (!/9f2c4ae1bb70/.test(chainCard)) fails.push('the chain head is not shown anywhere');
if (!/v1 x1,200/.test(chainCard)) fails.push('the hash schemas are not shown');
window.openLamp('m:rulebook');
const ruleCard = doc.getElementById('shB').textContent;
if (!/c71b0e4d99aa/.test(ruleCard)) fails.push('the rule chain head is not shown');
if (!/schema marker/.test(ruleCard)) fails.push('the rule history is not shown');

/* Nothing marked hidden is ever drawn. A class that sets display once beat the
   hidden attribute and put the sign in gate on top of a working board. */
['boot','gate','err'].forEach(id => {
  const el = doc.getElementById(id);
  if (el && !el.hidden) return;
  if (el && window.getComputedStyle(el).display !== 'none')
    fails.push('#' + id + ' is hidden and still drawn');
});

console.log('--- errors:', errs.length, '---');
errs.slice(0, 3).forEach(e => console.log('   ', String(e).split('\n')[0]));
if (fails.length || errs.length) {
  console.log('\nFAILED'); fails.forEach(f => console.log('  ' + f)); process.exit(1);
}
console.log('\nPASSED');
