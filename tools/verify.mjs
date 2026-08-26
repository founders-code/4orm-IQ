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
if (boardBlock.indexOf('GENERATED:SOURCES') === -1 && script.indexOf('GENERATED:SOURCES') === -1) {
  fails.push('the board is not generated from the catalogue. Run tools/sync-catalogue.mjs.');
}
const regNames = [...boardBlock.matchAll(/items:\[([^\]]*)\]/g)]
  .flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
/* No count is typed into the page any more. If one ever comes back, catch it. */
const typed = html.match(/Registers <b>(\d+)<\/b>/);
if (typed) fails.push('a register count is typed into the header. It must be computed: ' + typed[1]);

/* ------------------------------------- the console and the catalogue agree
   The board in index.html is GENERATED from api/_catalogue.js. If somebody
   edits one without running tools/sync-catalogue.mjs the two drift, and a
   board that says one number while the API plans against another is the exact
   disagreement that has cost this project three outages. */
{
  const cat = await import('../api/_catalogue.js');
  const ref = await import('../api/_reference.js');

  const catNames = cat.CATALOGUE.filter(x => x.enabled).map(x => x.display_name);
  const onlyBoard = regNames.filter(n => !catNames.includes(n));
  const onlyCat   = catNames.filter(n => !regNames.includes(n));
  if (onlyBoard.length || onlyCat.length) {
    fails.push('index.html and api/_catalogue.js disagree about the board. Run tools/sync-catalogue.mjs.' +
      (onlyBoard.length ? '\n      only in the page: ' + onlyBoard.join(', ') : '') +
      (onlyCat.length   ? '\n      only in the catalogue: ' + onlyCat.join(', ') : ''));
  }
  if (regNames.length !== cat.TOTAL_SOURCES) {
    fails.push('the board holds ' + regNames.length + ' registers, the catalogue counts ' + cat.TOTAL_SOURCES);
  }
  const noRef = catNames.filter(n => !ref.REFERENCE[n]);
  if (noRef.length) fails.push('sources with no reference entry: ' + noRef.join(', '));

  /* Every source must route somewhere and fail to a gap, never to silence. */
  const badFail = cat.CATALOGUE.filter(x => x.failure_behavior !== 'gap');
  if (badFail.length) fails.push('a source whose failure is not published as a gap: ' +
    badFail.map(x => x.source_id).join(', '));
  const badVert = cat.CATALOGUE.filter(x =>
    !x.verticals.every(v => v === 'ALL' || cat.VERTICALS.includes(v)));
  if (badVert.length) fails.push('a source routed to a vertical that does not exist: ' +
    badVert.map(x => x.source_id).join(', '));
  const dupIds2 = cat.CATALOGUE.map(x => x.source_id)
    .filter((v, i, a) => a.indexOf(v) !== i);
  if (dupIds2.length) fails.push('duplicate source_id in the catalogue: ' + [...new Set(dupIds2)].join(', '));
  const dupNames = catNames.filter((v, i, a) => a.indexOf(v) !== i);
  if (dupNames.length) fails.push('duplicate display_name in the catalogue: ' + [...new Set(dupNames)].join(', '));
}

/* -------------------------------------------- every board register documented */
const regInfo = script.slice(script.indexOf('var REGINFO = {'), script.indexOf('\n};', script.indexOf('var REGINFO = {')));
const undocumented = regNames.filter(n => !regInfo.includes('"' + n + '"'));
if (undocumented.length) fails.push('board registers with no reference entry: ' + undocumented.join(', '));

/* --------------------- every specimen record carries a plain language sentence.
   The schema makes `plain` required on every evidence record, because that one
   sentence is what a reader who has never opened a registry actually reads. The
   demo corpus is hand written, so nothing enforced it there and it silently had
   none at all: the whole plain language layer was invisible in the showroom. */
const evCount = (script.match(/\{t:"[ABCD4]",src:"/g) || []).length;
const plainCount = (script.match(/\n\s*plain:"/g) || []).length;
if (evCount !== plainCount)
  fails.push(evCount + ' specimen evidence records but ' + plainCount + ' plain language sentences. ' +
    'The schema requires one on every record, and the demo corpus is hand written so nothing else enforces it.');

/* the plain sentence is written for a reader, so it has to be a sentence */
const shortPlain = [...script.matchAll(/plain:"((?:[^"\\]|\\.)*)"/g)]
  .map(m => m[1]).filter(t => t.length < 40);
if (shortPlain.length) fails.push('plain language sentences too short to say anything: ' + shortPlain.join(' | '));

/* --------------------------------------- the explainer note is green, everywhere.
   Light green is the signal that says "this is the part that explains it". If a
   note block drifts back to blue, blue stops meaning the product. */
const evplainRule = (styleBlock.match(/\.evplain\s*\{[^}]*\}/) || [''])[0];
if (!/--ok-bg/.test(evplainRule))
  fails.push('.evplain is no longer on the light green ground');
const shPlainRule = (styleBlock.match(/\.sh-plain\s*\{[^}]*\}/) || [''])[0];
if (!shPlainRule) fails.push('the printed summary has no plain language block');
else if (!/#E7F7EF/i.test(shPlainRule))
  fails.push('.sh-plain on the printed summary is no longer light green');

/* ------------------- the wait screen must let go of the reader by itself.
   It sat open after the sweep landed and waited to be dismissed, which reads
   as a hung page. The countdown is the thing that fixes it, so the call from
   waitFinish is checked rather than assumed. */
const wfStart = script.indexOf('function waitFinish');
/* the body only, to the first close at column zero. The helpers that follow
   share the name, and matching those would pass a build where the call is gone. */
const waitFin = script.slice(wfStart, script.indexOf('\n}', wfStart));
if (!/[^n]\s*waitAutoGo\s*\(/.test(waitFin))
  fails.push('waitFinish no longer starts the countdown off the disclaimer, so the panel will sit open');
if (!/function\s+waitAutoCancel/.test(script))
  fails.push('the countdown can no longer be held, so a reader mid card gets cut off');

/* ------------------------ the summary box is sized by the band, not by itself.
   The detail under the statement scrolls. If the verdict goes back into flow
   the copy pushes the box taller than the gauges beside it, which is the one
   thing the box was asked not to do. */
if (!/\.sbleft \.verdictwrap\{position:absolute;inset:0\}/.test(styleBlock.replace(/\s+/g, m => m.includes('\n') ? '\n' : ' ')))
  warn.push('check the summary band: the verdict may be back in flow and able to grow the box');
const vmoreRule = (styleBlock.match(/\.vmore\s*\{[^}]*\}/) || [''])[0];
if (!/overflow-y:\s*auto/.test(vmoreRule))
  fails.push('the summary detail no longer scrolls');

/* --------------------------------- two logos, both of them the real files.
   4orm Finance sits above the headline, 4ormIQ sits inside it. Neither is
   ever redrawn, so both must be image data and never text standing in. */
if (!/class="herofin landing-only" src="data:image\/png;base64,/.test(html))
  fails.push('the 4orm Finance logo above the headline is not the real image file');
if (!/class="iqmark" src="data:image\/png;base64,/.test(html))
  fails.push('the 4 in the headline lockup is not the real mark file');
if (!/<span class="iqlock"/.test(html))
  fails.push('the headline no longer carries the 4ormIQ lockup');
/* The "4orm" in the headline is the logo file with FINANCE masked off, so the
   mark and the letterforms are the real ones. IQ is the only type in it, and
   it is set at the weight of the logo's own strokes, not the headline's 800. */
const iqRule = (styleBlock.match(/\.iqiq\{[^}]*\}/) || [''])[0];
if (!/font-weight:\s*600/.test(iqRule))
  fails.push('IQ in the headline lockup is not at the logo\'s stroke weight, so it will read as too heavy');
const markRule = (styleBlock.match(/\.iqmark\{[^}]*\}/) || [''])[0];
if (!/vertical-align:\s*baseline/.test(markRule))
  fails.push('the headline mark is no longer anchored to the text baseline, which is what left it sitting low');
/* The Finance logo is deliberately off geometric centre, because the blue mark
   carries almost no contrast on this ground and the white letters carry it all.
   Losing the nudge puts it back to looking pushed right. */
const finRule = (styleBlock.match(/\.herofin\.landing-only\{[^}]*\}/) || [''])[0];
if (!/translateX\(-\d/.test(finRule))
  fails.push('the optical nudge on the 4orm Finance logo is gone, so it will read as sitting right of centre');
/* flex:none on .tlead. The console rule gives it flex:1 1 420px, and in a
   column flex container that basis is a height, which opens dead air under
   the paragraph. It has already done that once. */
if (!/\.cbtitle \.tlead\{flex:none/.test(styleBlock))
  fails.push('.tlead has lost flex:none on the landing, which reopens the gap under the paragraph');

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
