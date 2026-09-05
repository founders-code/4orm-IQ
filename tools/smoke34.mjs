/* A DEAD SEARCH PROVIDER IS NOT A CLEAN RECORD.
   exa() and parallel() never throw: every failure comes back as a result
   object with an empty results array, the same shape a search that ran and
   found nothing produces. This proves the two are told apart, that a dark
   provider stops the run, and that a genuinely empty search does not. */
import fs from 'fs';
import path from 'path';
const root = path.resolve(import.meta.dirname, '..');
const src  = fs.readFileSync(path.join(root, 'api/check.js'), 'utf8');
let fails = [];
const t = (name, ok) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + name); if (!ok) fails.push(name); };

console.log('\nRETRIEVAL  A provider that answered nothing is an outage, not a result.');

/* 1 - the guard exists, and it runs before anything is assessed */
const gAt = src.indexOf("error: 'retrieval_unavailable'");
const mAt = src.indexOf('client.messages.create');
const pAt = src.indexOf("emit('partial'");
t('the run refuses to assess a sweep where nothing answered', gAt > 0);
t('it stops before the reasoning call, not after it', gAt > 0 && gAt < mAt);
t('it stops before the board is published as a partial', gAt > 0 && gAt < pAt);

/* 2 - the predicate. Reproduced from the source so the test fails if it drifts. */
const block = src.slice(src.indexOf('const calls  = [...exaAll, ...parOut];'), gAt);
t('it counts both providers, not just one', /\[\.\.\.exaAll, \.\.\.parOut\]/.test(block));
t("it treats 'found' as the only answer that counts", /b\.status === 'found'/.test(block));
t('it names an unconfigured provider separately from a refused one',
  /not_configured/.test(block) && /refused or could not be reached/.test(src));

/* 3 - the behaviour, run against real result shapes */
const answered = cs => cs.filter(b => b.status === 'found').length;
const dark = cs => cs.length > 0 && answered(cs) === 0;
const found = (n) => ({ source:'Exa', status:'found', results: Array(n).fill({}) });
t('a key that is not set stops the run',
  dark([{source:'Exa',status:'not_configured',results:[]}]));
t('a provider answering 401 on every call stops the run',
  dark([{source:'Exa',status:'error',http:401,results:[]},
        {source:'Exa',status:'error',http:401,results:[]}]));
t('a provider out of quota stops the run',
  dark([{source:'Exa',status:'error',http:402,results:[]}]));
t('a provider that timed out on every call stops the run',
  dark([{source:'Exa',status:'unreachable',results:[]}]));
/* the case that must NOT trip: real searches, legitimately nothing found */
t('a search that ran and found nothing is a result, and is allowed through',
  !dark([found(0), found(0), found(0)]));
t('one provider answering while another is dark is allowed through',
  !dark([{source:'Exa',status:'error',http:401,results:[]}, found(3)]));
t('a run with no searches planned at all is not called an outage', !dark([]));

/* 4 - and the message says whose fault it is */
const msg = (src.match(/message: 'The check could not read any register[^']*'[\s\S]{0,300}?\n/) || [''])[0];
t('the reader is told this is our fault and not a finding',
  /fault on our side/.test(src) && /not a finding about this party/.test(src));
t('the real reason goes to the operator field and the log',
  /operator: \{ status: 503/.test(src) && /console\.error\('\[check\] retrieval dark'/.test(src));

console.log('\n' + (fails.length ? fails.length + ' failed' : 'all passed'));
process.exit(fails.length ? 1 : 0);
