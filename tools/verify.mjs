/**
 * 4orm IQ build check.
 *
 *   node tools/verify.mjs [path/to/previous/index.html]
 *
 * Every check here exists because the thing it looks for actually shipped broken
 * at least once. The declaration diff in particular: removing an inline panel
 * silently took a variable with it twice, and the page died on load with a blank
 * console and no error anyone could see.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '';
const fails = [];
const warn = [];

/* ---------------------------------------------------------------- syntax */
try {
  new Function(script);
} catch (e) {
  fails.push('the inline script does not parse: ' + e.message);
}

/* ------------------------------------------------------------ duplicates */
const ids = [...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]);
const dupIds = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
if (dupIds.length) fails.push('duplicate element ids: ' + dupIds.join(', '));

const fns = [...script.matchAll(/\nfunction\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
const dupFns = [...new Set(fns.filter((v, i) => fns.indexOf(v) !== i))];
if (dupFns.length) fails.push('duplicate function names, the later one silently wins: ' + dupFns.join(', '));

/* --------------------------------------------------------- dead references */
const declared = new Set([
  ...fns,
  ...[...script.matchAll(/\nvar\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1])
]);
const idRefs = [...new Set([...script.matchAll(/\bid\("([A-Za-z0-9_-]+)"\)/g)].map(m => m[1]))];
const missing = idRefs.filter(r => !ids.includes(r));
if (missing.length) fails.push('script reaches for elements that do not exist: ' + missing.join(', '));

/* -------------------------------------------------------------- anchors */
const anchors = [...new Set([...html.matchAll(/href="#([A-Za-z0-9_-]+)"/g)].map(m => m[1]))];
const deadAnchors = anchors.filter(a => !ids.includes(a));
if (deadAnchors.length) fails.push('anchors pointing nowhere: ' + deadAnchors.join(', '));

/* ------------------------------------------------------------ house rules */
if (/[—–]/.test(html)) fails.push('an em dash or en dash is present');
const banned = ['not just', 'genuinely', 'substantially', 'delve', 'seamless',
                'robust', 'crucial', 'vital', 'holistic', 'underscore', 'testament'];
const hits = banned.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(html));
if (hits.length) fails.push('banned words: ' + hits.join(', '));

/* -------------------------------------------- the rules that are the product */
/* A trust score in our own voice is a failure. The same words inside a verbatim
   quote from a retrieved source are the opposite: that is us showing a reader what
   a reputation service said, which is the whole point. Strip quotes before testing. */
const ownVoice = html.replace(/quote:"[^"]*"/g, '').replace(/&ldquo;[\s\S]*?&rdquo;/g, '');
if (/trust\s*score\s*\d/i.test(ownVoice)) fails.push('a trust score appears in our own copy');
if (/\bORANGE\b|\bBLACK\b/.test(script.replace(/#[0-9A-Fa-f]{6}/g, ''))) {
  warn.push('a verdict word outside RED, GREY, YELLOW, GREEN may be present');
}
['RED', 'GREY', 'YELLOW', 'GREEN'].forEach(v => {
  if (!script.includes('"' + v + '"')) warn.push('verdict ' + v + ' is not referenced');
});

/* ------------------------------- the board and the categories agree with the api */
const catCount = (script.match(/\{id:"\d\d", key:"C/g) || []).length;
if (catCount !== 10) fails.push('there are ' + catCount + ' categories, not 10');

const schema = fs.readFileSync(path.join(root, 'api', '_schema.js'), 'utf8');
if (!/minItems:\s*10/.test(schema) || !/maxItems:\s*10/.test(schema)) {
  fails.push('api/_schema.js does not require exactly 10 categories');
}
const retrieval = fs.readFileSync(path.join(root, 'api', '_retrieval.js'), 'utf8');
if (!/ALL_CATS\s*=\s*\[[^\]]*'C10'/.test(retrieval)) {
  fails.push('api/_retrieval.js ALL_CATS does not include C10');
}

const boardBlock = script.slice(script.indexOf('var SOURCES = ['), script.indexOf('var TOTAL_SOURCES'));
const regNames = [...boardBlock.matchAll(/items:\[([^\]]*)\]/g)]
  .flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
const stated = (html.match(/Registers <b>(\d+)<\/b>/) || [])[1];
if (stated && Number(stated) !== regNames.length) {
  fails.push('the header says ' + stated + ' registers, the board holds ' + regNames.length);
}

/* -------------------------------------------- every board register documented */
const regInfo = script.slice(script.indexOf('var REGINFO = {'), script.indexOf('\n};', script.indexOf('var REGINFO = {')));
const undocumented = regNames.filter(n => !regInfo.includes('"' + n + '"'));
if (undocumented.length) fails.push('board registers with no reference entry: ' + undocumented.join(', '));

/* -------------------------------------- declaration diff against a prior build */
const prev = process.argv[2];
if (prev && fs.existsSync(prev)) {
  const before = fs.readFileSync(prev, 'utf8');
  const decl = t => new Set([...t.matchAll(/\n(?:var|function)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
  const lost = [...decl(before)].filter(x => !decl(html).has(x));
  if (lost.length) warn.push('declarations no longer present: ' + lost.join(', ') +
    '  (intended removals are fine; anything you did not mean to remove is a bug)');
}

/* ----------------------------------------------------------------- report */
const line = s => console.log('  ' + s);
console.log('\n4orm IQ build check');
console.log('  categories        ' + catCount);
console.log('  board registers   ' + regNames.length);
console.log('  functions         ' + fns.length);
console.log('  element ids       ' + ids.length);
if (warn.length) { console.log('\nWorth a look'); warn.forEach(line); }
if (fails.length) {
  console.log('\nFAILED');
  fails.forEach(line);
  process.exit(1);
}
console.log('\nPASSED\n');
