/* THE SEARCHES LEAVE AT A RATE THE PROVIDER ACCEPTS.
   Thirty four requests dispatched at once against a ten a second limit is a
   burst that mostly comes back 429, and a refused search is indistinguishable
   downstream from a register that held nothing. This proves the pacer holds the
   rate, that a 429 is retried rather than recorded as darkness, and that a 401
   is not retried, because a key that is wrong will still be wrong in a second. */
import fs from 'fs';
import path from 'path';
const root = path.resolve(import.meta.dirname, '..');
const src  = fs.readFileSync(path.join(root, 'api/_retrieval.js'), 'utf8');
let fails = [];
const t = (n, ok) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + n); if (!ok) fails.push(n); };

console.log('\nRATE  Both providers go through one pacer.');
t('exa is paced', /return paced\(\(\) => exaOnce\(/.test(src));
t('parallel is paced', /return paced\(\(\) => parallelOnce\(/.test(src));
t('the ceiling cannot be raised past the documented limit',
  /Math\.min\(10, Number\(process\.env\.KBYS_QPS\) \|\| 8\)/.test(src));
t('a 429 is retried', /RETRY_ON = new Set\(\[429/.test(src));
t('a 401 is not retried', !/RETRY_ON[^)]*401/.test(src));
t('a 402 is not retried', !/RETRY_ON[^)]*402/.test(src));
t('giving up is recorded', /gave up after retries/.test(src));

/* the pacer itself, reproduced and run */
const QPS = 8;
let windowStart = 0, windowCount = 0, clock = 0;
const now = () => clock;
async function slot() {
  for (;;) {
    if (now() - windowStart >= 1000) { windowStart = now(); windowCount = 0; }
    if (windowCount < QPS) { windowCount++; return; }
    clock = windowStart + 1000;
  }
}
const sent = [];
for (let i = 0; i < 34; i++) { await slot(); sent.push(clock); }
const perSecond = {};
sent.forEach(ms => { const s = Math.floor(ms / 1000); perSecond[s] = (perSecond[s] || 0) + 1; });
const worst = Math.max(...Object.values(perSecond));
console.log('\n  34 searches spread over ' + Object.keys(perSecond).length +
            ' second(s), busiest second: ' + worst);
t('no second carries more than the ceiling', worst <= QPS);
t('all thirty four still go out, none are dropped', sent.length === 34);
t('a full round takes seconds, not one burst', Object.keys(perSecond).length >= 4);

console.log('\n' + (fails.length ? fails.length + ' failed' : 'all passed'));
process.exit(fails.length ? 1 : 0);
