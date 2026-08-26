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

const fns = [...script.matchAll(/(?:^|\n)[ \t]*function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
const dupFns = [...new Set(fns.filter((v, i) => fns.indexOf(v) !== i))];
if (dupFns.length) fails.push('duplicate function names, the later one silently wins: ' + dupFns.join(', '));

/* --------------------------------------------------------- dead references */
/* Function expressions assigned to a name shadow a declaration just as
   silently, so they are counted too. */
const fnExprs = [...script.matchAll(/(?:^|\n)[ \t]*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function\b/g)].map(m => m[1]);
const allFns = fns.concat(fnExprs);
const dupAll = [...new Set(allFns.filter((v, i) => allFns.indexOf(v) !== i))];
if (dupAll.length && !dupFns.length)
  fails.push('a name is declared as both a function and a function expression: ' + dupAll.join(', '));

const topVars = [...script.matchAll(/(?:^|\n)var\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
const dupVars = [...new Set(topVars.filter((v, i) => topVars.indexOf(v) !== i))];
if (dupVars.length) fails.push('duplicate top level var names, the later one silently wins: ' + dupVars.join(', '));
const idRefs = [...new Set([...script.matchAll(/\bid\("([A-Za-z0-9_-]+)"\)/g)].map(m => m[1]))];
const missing = idRefs.filter(r => !ids.includes(r));
if (missing.length) fails.push('script reaches for elements that do not exist: ' + missing.join(', '));

/* -------------------------------------------------------------- anchors */
const anchors = [...new Set([...html.matchAll(/href="#([A-Za-z0-9_-]+)"/g)].map(m => m[1]))];
const deadAnchors = anchors.filter(a => !ids.includes(a));
if (deadAnchors.length) fails.push('anchors pointing nowhere: ' + deadAnchors.join(', '));

/* -------------------------------------------- the silent override check
   Three outages in this project came from the same shape: the same property
   declared twice on the same selector inside the same at-rule, where the later
   one wins and nothing errors. This walks every rule block in the stylesheet
   and reports any selector that sets a layout property more than once at the
   same breakpoint. */
const styleBlock = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || '';
{
  const WATCH = ['grid-template-columns','grid-template-rows','display','position',
                 'transform','flex-direction','width','max-width'];
  const seen = new Map();          /* "media||selector||prop" -> count */
  let media = '';
  let depth = 0;
  const src = styleBlock;
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf('@media', i);
    const brace = src.indexOf('{', i);
    if (brace < 0) break;
    if (at >= 0 && at < brace) {
      media = src.slice(at, brace).replace(/\s+/g, ' ').trim();
      i = brace + 1; depth = 1;
      continue;
    }
    const selector = src.slice(i, brace).replace(/\s+/g, ' ').trim().replace(/^\}+/, '').trim();
    const close = src.indexOf('}', brace);
    if (close < 0) break;
    const body = src.slice(brace + 1, close);
    if (selector && !selector.startsWith('@')) {
      selector.split(',').map(x => x.trim()).filter(Boolean).forEach(sel => {
        WATCH.forEach(prop => {
          const n = (body.match(new RegExp('(?:^|;|\\s)' + prop + '\\s*:', 'g')) || []).length;
          if (!n) return;
          const key = (depth ? media : '') + '||' + sel + '||' + prop;
          seen.set(key, (seen.get(key) || 0) + n);
        });
      });
    }
    i = close + 1;
    if (depth && src.slice(i, i + 2).trim().startsWith('}')) { depth = 0; media = ''; i = src.indexOf('}', i) + 1; }
  }
  const clashes = [...seen.entries()].filter(([, n]) => n > 1)
    .map(([k]) => { const [m, sel, prop] = k.split('||'); return (m ? m + ' ' : '') + sel + ' { ' + prop + ' }'; });
  if (clashes.length) fails.push('a layout property is declared more than once on the same selector, the later one silently wins:\n      ' + clashes.join('\n      '));
}

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
if (/\bORANGE\b|\bBLACK\b/.test(html.replace(/#[0-9A-Fa-f]{6}/g, ''))) {
  fails.push('a verdict word outside RED, GREY, YELLOW, GREEN is present');
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
