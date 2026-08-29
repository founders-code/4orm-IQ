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


/* ======================================================================
   OPS-001 s.23 OUTPUT VALIDATOR AND PIA-001 CONTROLS

   Every check below names the clause it enforces. A control that lives only in
   a document is a control nobody can prove, and every one of these was proved
   by putting the prohibited thing back and watching the suite fail.
   ====================================================================== */
{
  const src = html;

  /* PIA-001 s.20 / OPS-001 s.8: person name and phone-for-person-lookup are
     not permitted inputs. */
  if (/ID_TYPES\s*=\s*\[[^\]]*"Person"/.test(src))
    fails.push('OPS-001 s.8: "Person" is offered as a search type again');
  if (/ID_TYPES\s*=\s*\[[^\]]*"Phone"/.test(src))
    fails.push('OPS-001 s.8: "Phone" is offered as a search type again');
  if (/placeholder="[^"]*person[^"]*"/i.test(src))
    fails.push('OPS-001 s.8: the search box still invites a person name');
  if (!/function inputAllowed\(/.test(src))
    fails.push('OPS-001 s.8: the input gate function is gone');
  if (!/BLOCKED_INPUT/.test(src))
    fails.push('OPS-001 s.8: the blocked-input map is gone');

  /* PIA-001 s.21: no persistent person-level graph reaches the page. */
  if (!/function rpPeople\(d\)\{\s*return \[\];\s*\}/.test(src))
    fails.push('PIA-001 s.21: rpPeople returns person nodes again');

  /* PIA-001 s.14: a name prints only from a source SR-001 authorised. */
  if (!/RP_PERSON_OUTPUT_SOURCES/.test(src))
    fails.push('PIA-001 s.14: the SR-001 person-output gate is gone');
  if (!/rpPersonOutputAllowed\(ev\[i\]\.sid \|\| ev\[i\]\.src\)/.test(src))
    fails.push('PIA-001 s.14: the name miner no longer consults the SR-001 gate');

  /* The Quebec subject rule. A geofence is about the reader; this is about the
     person being written about, which is what the statute is about. */
  if (!/function rpQcSubject\(/.test(src))
    fails.push('the Quebec subject rule is gone');
  if (!/if\(rpQcSubject\(ev\[i\]\)\) continue;/.test(src))
    fails.push('the Quebec subject rule is defined but never applied');

  /* Content age and dead items. */
  if (!/RP_DEAD/.test(src) || !/function rpBarred\(/.test(src))
    fails.push('the content-age and dead-item filter is gone');
  for (const w of ['dismissed','withdrawn','acquitted','not guilty'])
    if (!new RegExp(w, 'i').test((src.match(/var RP_DEAD =[^\n]*/)||[''])[0]))
      fails.push('the dead-item filter no longer catches "' + w + '"');
  if (!/RP_ADVERSE_YEARS\s*=\s*7\b/.test(src))
    fails.push('the seven year cap on adverse information has moved');
  if (!/var sieved=rpSieve\(d\.issues\|\|\[\]\)/.test(src))
    fails.push('rpFinds no longer sieves the findings before ranking them');
  if (!/found and not reported/.test(src))
    fails.push('items we refuse to publish are dropped silently instead of disclosed');

  /* The conditional imperative. The instruction is the authority's, or it is
     not made. */
  if (/return "Do not send any money\.";/.test(src))
    fails.push('the unconditional imperative is back in the verdict');
  if (/"Stop\. Do not send anything tonight\."/.test(src))
    fails.push('the unconditional stop instruction is back in the verdict');
  if (!/rpOfficialBody\(d\)\+" says do not send money/.test(src))
    fails.push('the RED verdict no longer attributes the instruction to a body');
  /* A call site is not an implementation. This guard passed once while the
     function it names did not exist, and the smoke suite caught it at runtime
     instead. Check the definition, not only the call. */
  if (!/function rpOfficialBody\(d\)\{/.test(src))
    fails.push('rpOfficialBody is called but not defined');

  /* Defamation by juxtaposition: the prior-warning block needs a specific
     identifier. */
  if (/'<div class="snaplist">'\+g\.priors\.map/.test(src))
    fails.push('the prior-warning block renders every prior, including weak ones');
  {
    const f = (src.match(/var priors = \(g\.priors\|\|\[\]\)\.filter\([\s\S]*?\n  \}\);/) || [''])[0];
    if (!f) fails.push('the specificity threshold on prior warnings is gone');
    else if (!/very high/.test(f) || !/\bhigh\b/.test(f))
      fails.push('the prior-warning filter no longer tests specificity, so a '
        + 'shared nameserver can put a firm beside a regulator warning again');
  }

  /* OPS-001 s.25 prohibited copy, in our own voice. */
  /* Two exemptions, both real. A verbatim quote from a retrieved source is us
     showing the reader what that source said, which is the opposite of the harm.
     And a sentence promising we will NEVER do the thing is not us doing it:
     "We never publish a trust score" has to survive a guard against trust
     scores, or the guard deletes the promise. */
  const ownVoice2 = src
    .replace(/quote:"[^"]*"/g, '')
    .replace(/&ldquo;[\s\S]*?&rdquo;/g, '')
    .split(/(?<=[.!?])\s+/)
    .filter(sent => !/\bnever\b/i.test(sent))
    .join(' ');
  const banned25 = [
    'trust score', 'reputation score', 'fraud probability',
    'this person is safe', 'is a scammer', 'bad actor',
    'high-risk individual', 'guaranteed safe', 'we checked everything',
    'no risk exists', 'you should invest'
  ];
  for (const phrase of banned25)
    if (new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(ownVoice2))
      fails.push('OPS-001 s.25 prohibited copy in our own voice: "' + phrase + '"');

  /* A promise we cannot perform is a promise we do not make. */
  if (/previous six months/.test(src))
    fails.push('the six month notification promise is back, and retention cannot support it');
  if (/two business days/.test(src) && /acknowledge/.test(src))
    fails.push('the two business day acknowledgement is back without instrumentation');
}

/* ---------------------------------------------------------------- SR-001
   The register controls the build, or it is a spreadsheet. These guards are
   what make it the first thing. */
{
  const src = html;
  if (!/SR001-MANIFEST-START/.test(src) || !/SR001-MANIFEST-END/.test(src))
    fails.push('SR-001: the generated manifest block is gone from the build');
  const man = (src.match(/SR001-MANIFEST-START[\s\S]*?var SR001 = ([\s\S]*?);\n\/\* SR001-MANIFEST-END/) || [])[1];
  if (!man) fails.push('SR-001: the manifest cannot be parsed');
  else {
    let m; try { m = JSON.parse(man); } catch { fails.push('SR-001: the manifest is not valid JSON'); }
    if (m) {
      if (!Array.isArray(m.enabled)) fails.push('SR-001: the manifest has no enabled list');
      /* Every source the build queries must be on the register. The generator
         refuses to write otherwise, and this is the second lock in case
         somebody edits CATS without regenerating. */
      const cats = eval((src.match(/var CATS\s*=\s*(\[[\s\S]*?\n\]);/) || [null,'[]'])[1].replace(/<\/?b>/g, ''));
      const inBuild = new Set();
      cats.forEach(c => (c.src || []).forEach(s => inBuild.add(String(s[0]).trim())));
      if (m.total && inBuild.size > m.total)
        fails.push('SR-001: the build queries ' + inBuild.size + ' sources and the register carries '
          + m.total + '. Re-run tools/sr001-build.mjs.');
      /* A name may print only from a source the register cleared for it, and
         the two gates must agree. */
      const po = Object.keys(m.personOutput || {}).length;
      const code = (src.match(/var RP_PERSON_OUTPUT_SOURCES = \{([^}]*)\}/) || [null,''])[1].trim();
      if (po === 0 && code !== '')
        fails.push('SR-001 clears no source for person-level output, but the build hardcodes some');
    }
  }
  if (!/function srEnabled\(name\)/.test(src))
    fails.push('SR-001: the enforcement function is gone');
  if (!/function srScope\(c\)/.test(src))
    fails.push('SR-001: srScope, the one place that answers which registers a check may use, is gone');
  if (!/srEnabled\(n\) \? \(status/.test(src))
    fails.push('SR-001: the board no longer marks an uncleared register out of scope');
  if (!/SR_OUT_OF_SCOPE = "policy"/.test(src))
    fails.push('SR-001: the out-of-scope board state is gone, and an uncleared register '
      + 'will read as one we reached');
  /* Both rules, not either. The chip needs its own border treatment and its
     own dot treatment, and a guard satisfied by one of the two passed while the
     other was renamed. */
  if (!/\.src\[data-s="policy"\]\{/.test(src))
    fails.push('SR-001: the out-of-scope chip has no styling, so it draws as ready');
  if (!/\.src\[data-s="policy"\] i\{/.test(src))
    fails.push('SR-001: the out-of-scope chip keeps a lit dot, which reads as reached');

  /* Fail visible. Enforcement off is allowed; enforcement off and silent is not. */
  const enforcing = /var SR001_ENFORCE = true;/.test(src);
  if (!enforcing) {
    if (!/id="srWarn"/.test(src))
      fails.push('SR-001 enforcement is off and the page does not say so');
    if (!/id\("srWarn"\)/.test(src))
      fails.push('SR-001 enforcement is off and the banner is never shown');
    if (process.argv.includes('--production'))
      fails.push('SR-001 enforcement is off. This build queries registers the '
        + 'register has not cleared, and must not be deployed.');
    else
      console.log('  NOTE  SR-001 enforcement is off. Run with --production before deploying.');
  }
}

/* ------------------------------------------------------------ house rules */
if (/[—–]/.test(html)) fails.push('an em dash or en dash is present');
const banned = ['not just', 'genuinely', 'substantially', 'delve', 'seamless',
                'robust', 'crucial', 'vital', 'holistic', 'underscore', 'testament'];
const hits = banned.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(html));
if (hits.length) fails.push('banned words: ' + hits.join(', '));

/* The experience behind this product is ours, told in the first person. Writing
   it as "our founders" puts a third party between the reader and the people who
   sat in those rooms, and it reads like a marketing page describing itself. */
{
  const prose = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/\bfounders\b/i.test(prose))
    fails.push('copy refers to "founders" in the third person, it should be "we"');
}

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

/* ------------------------------------------------ the report, and its stage
   The answer page runs on the same payload as the board. Each of these was
   proved by breaking it: remove the guard's subject and the check fails. */
if (!/id="rpt"/.test(html)) fails.push('the report section #rpt is gone');
if (!/body\[data-stage="report"\] #rpt\{display:block\}/.test(styleBlock))
  fails.push('the report stage no longer shows #rpt');
if (!/#rpt \.rp-wrap\{[^}]*max-width/.test(styleBlock))
  fails.push('#rpt .rp-wrap lost its max-width, so the report runs edge to edge');
{
  const unscoped = [...styleBlock.matchAll(/(?:^|[{}]\s*)(\.rp-[A-Za-z0-9_-]+[^{};]*)\{/g)]
    .map(m => m[1].trim()).filter(x => x);
  if (unscoped.length)
    fails.push('report rules not scoped to #rpt (the reset will outrank them): '
      + unscoped.slice(0, 4).join(', '));
}
if (/class="[^"]*\brp-rp-/.test(html))
  fails.push('a report class was prefixed twice (rp-rp-), so its rules never match');
{
  const packs = (script.match(/var RP_PACKS = \[/) || []).length;
  if (!packs) fails.push('the recipient packs are gone');
  const ids = (script.match(/"id": "(bank|card|police|cafc|bureau|bcsc|ic3|ftc|crypto)"/g) || []);
  if (ids.length !== 9) fails.push('expected 9 recipient packs, found ' + ids.length);
}
{
  const hand = (script.match(/toResult\(d,q\);\s*rpEnter\(d,q\);/g) || []).length;
  if (hand !== 2) fails.push('both run paths must open the report, found ' + hand + ' of 2');
}
if (!/rpEnter\(er,q\)/.test(script))
  fails.push('a failed live run no longer opens the report');
if (!/rpPickPlain\(pool,\s*x\)/.test(script))
  fails.push('findings lost their one-sentence-each pairing');
if (!/countApplicable\(d\)\|\|reached/.test(script))
  fails.push('the report stopped counting coverage the way the board counts it');
{
  /* The shell holds no party. Everything about the party is written at render
     time from the run's own payload, so a stale name can never survive a check. */
  const empties = ['rpIdent', 'rpWho', 'rpDom', 'rpSay', 'rpFigs', 'rpFinds', 'rpClaims',
                   'rpSteps', 'rpBundle', 'rpPaks', 'rpStamp'];
  for (const e of empties) {
    const m = new RegExp('id="' + e + '"[^>]*>([^<]*)<').exec(html);
    if (m && m[1].trim()) fails.push('the report shell has content baked into #' + e
      + ': ' + m[1].trim().slice(0, 40));
  }
}

/* ------------------------------------------- names, the verdict, the console
   A name printed on a page somebody hands to their bank must have come off a
   record that names it as a person, so the miner is held to official records
   carrying a role word. */
if (!/if\(ev\[i\]\.t!=="A"\) continue;/.test(script))
  fails.push('the name miner is reading past official records');
if (!/RP_ROLE\.test\(text\)/.test(script))
  fails.push('the name miner no longer requires a role word, so a company name can print as a person');
if (!/function rpOfficialNames/.test(script))
  fails.push('official record names are no longer separated out');
if (!/rpIdRow\(rpAgency\(off\[i\]\.src\)/.test(script))
  fails.push('official names lost the agency that holds them');
{
  const m = /#rpt \.rp-eyebrow\{[^}]*font-size:clamp\((\d+)px/.exec(styleBlock);
  if (!m || Number(m[1]) < 12)
    fails.push('the verdict is no longer set large enough to be the first thing read');
}
if (!/body\[data-stage="console"\] \.searchbox\{display:none\}/.test(
      styleBlock.replace(/\s*\n\s*/g, ''))) {
  const joined = styleBlock.replace(/\s+/g, '');
  if (!/body\[data-stage="console"\]\.cbtitle,body\[data-stage="console"\]\.cbmain\.idrow,body\[data-stage="console"\]\.searchbox\{display:none\}/.test(joined))
    fails.push('the board still carries the landing pitch, the type pills or the search bar');
}
if (!/id\("navNewCheck"\)/.test(script))
  fails.push('with the search bar off the board there is no way to start a new check');

/* --------------------------------- the packs, and the way into a dark card
   A question mark asks a question. It does not say there is a page of working
   behind the card, which is the thing a reader has to know. */
if (!/#rpt \.rp-pakgrid\{[^}]*grid-template-columns:1fr/.test(styleBlock))
  fails.push('the recipient packs are no longer one column top to bottom');
if (/<span class="statq" aria-hidden="true">\?<\/span>/.test(script))
  fails.push('a dark card still carries a question mark instead of Read more');
{
  /* The stat cells, the rail, the bars, and the rail again when a run settled
     nothing and every card renders empty. */
  const n = (script.match(/<span class="statq">Read more<\/span>/g) || []).length;
  if (n < 3) fails.push('a dark card lost its way in: Read more appears '
    + n + ' times, and it belongs on the stat cells, the rail and the bars');
}

/* --------------------------------------- the results page, in plain words
   The page is read by a frightened person on a phone. Every one of these was
   a real misreading found in review, not a style preference. */
{
  /* The tonight banner survives the securities rewrite, deliberately. It names
     no firm and recommends a pause rather than a decision about an investment,
     which is the distinction the whole verdict rewrite turns on. It used to
     appear twice: once here and once as the YELLOW verdict headline. The
     headline was entity specific and answered "should I send my money to this
     firm", so it went. This one stays and is required. */
  const n = (script.match(/Do not send anything tonight\./g) || []).length;
  if (n < 1) fails.push('the tonight banner is gone, which is the one line the '
    + 'page exists to deliver');
  const vw = (script.match(/function rpVerdictWord\(v,d\)\{[\s\S]*?\n\}/) || [''])[0];
  if (/Do not send anything tonight/.test(vw))
    fails.push('the tonight instruction is back inside the verdict headline, '
      + 'where it is a recommendation about a named firm');
}
if (!/id\("rpAlreadyBtn"\)/.test(script))
  fails.push('the reader who has already paid has no route again');
if (!/function rpRegistered/.test(script))
  fails.push('a registration no longer outranks a complaint');
if (!/function rpGoods/.test(script))
  fails.push('the page can only say what is wrong again');
{
  /* A registered firm with nothing official against it must not be written the
     same way as an unregistered one. */
  if (!/rpRegistered\(d\) && !rpHasOfficial\(d\)/.test(script))
    fails.push('the verdict stopped checking whether the firm is registered');
}
{
  const banned = [
    ['Not reached', 'read as "we did not get round to it"'],
    ['Nothing on file', 'read as good news'],
    ['Public concern identified', 'passive, and nobody is doing anything in it'],
    ['Official warning located', '"located" is what you do with lost keys'],
    ['Nothing adverse found', '"adverse" is a lawyer word and it reads as "you are fine"'],
    ['Take care', 'in British English that is how you end a phone call'],
    ['>Before you send<', 'a heading that presumes the reader is going to send'],
    ['Shares an identifier with', '"identifier" is not a word people use'],
    ['First trace anywhere', 'detective fiction'],
    ['Retrieval decides what was reached', 'an internal design principle on a consumer page'],
  ];
  /* Comments explain why a phrase was removed, so they are stripped before the
     check reads the script, or the explanation trips its own guard. */
  const prose = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const [phrase, why] of banned) {
    if (prose.includes('"' + phrase) || prose.includes(">" + phrase))
      fails.push('the results page says "' + phrase + '" again: ' + why);
  }
}

/* A run that settles nothing still fills the rail. An empty column beside the
   answer reads as a page that failed to load, not as an honest gap. */
if (!/if\(!d\.cats\)\{/.test(script))
  fails.push('a run with no checks renders an empty rail again');
{
  /* The empty rail must carry the same seven headings a full one does, so the
     layout does not change shape when a run settles nothing. */
  const m = /if\(!d\.cats\)\{[\s\S]*?var empty=\[([\s\S]*?)\n    \];/.exec(script);
  const body = m ? m[1] : '';
  const want = ['The ten checks','Reviews, what other people are saying','Source board',
                'Cross-examination','Material issues','Operator graph','Gaps'];
  const missing = want.filter(t => !body.includes('["' + t + '"') && !body.includes('["' + t + '",'));
  if (!m) fails.push('the empty rail cards are gone');
  else if (missing.length)
    fails.push('the empty rail is missing cards a full one has: ' + missing.join(', '));
}

/* --------------------------------- a check, opened, has to explain itself
   The rules told a reader what the rules are and never which one fired, and the
   register table carried our plumbing instead of what each register said. */
if (!/This is what happened here/.test(script))
  fails.push('the rules no longer mark the one that applied to this party');
if (!/var RULE_WORD/.test(script))
  fails.push('the rule badges print a colour again instead of an outcome');
if (!/var SRC_SAID/.test(script))
  fails.push('the register table stopped saying what each register returned');
if (/<th>Access<\/th>|<th>Terms<\/th>/.test(script))
  fails.push('the register table shows our plumbing again: Access and Terms mean nothing to a reader');
if (!/What it said about this party/.test(script))
  fails.push('the register table lost the column a reader opened it for');
/* A dot sized on an inline element never draws. That has shipped broken twice,
   but whether it draws depends on the parent being a flex container, which the
   stylesheet text cannot answer. It is measured in smoke18 instead. */

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
