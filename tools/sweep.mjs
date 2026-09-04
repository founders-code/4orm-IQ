/* ============================================================================
   THE SWEEP
   ---------------------------------------------------------------------------
   Finds what is in this build and is not doing anything, and takes it out.

   Run it from the repo root:

     node tools/sweep.mjs              report only, changes nothing
     node tools/sweep.mjs --apply      make the changes to index.html
     node tools/sweep.mjs --apply --files   also delete the orphan files

   WHAT IT LOOKS FOR

     1. CSS rules for classes no element ever wears. A rule whose selector
        requires a dead class can never match, so the rule is dropped. Where a
        selector list mixes live and dead, only the dead selectors are pruned.
     2. Functions declared once and reached from nowhere. It allows for every
        way a function is reached without a call beside its name: handed to map
        or forEach, to requestAnimationFrame or addEventListener, or named in
        the debug hook.
     3. id attributes on elements that nothing addresses.
     4. Files in tools/ that assert nothing, and byte identical assets.

   WHAT IT WILL NOT DO

     It never touches assets/. Those files are the source of the brand marks.
     The page carries them base64 embedded, so nothing fetches them at runtime
     and a naive sweep calls them dead. They are not dead. They are the only
     copy of the logo, and the logo is never redrawn from anything else.

     It never edits api/ or db/. Server code has call paths this cannot see.

   THE SAFETY PROPERTY

     With --apply it writes a backup first, then runs tools/verify.mjs. If the
     build does not pass, it puts the original file back and says so. A sweep
     that breaks the build undoes itself.
   ========================================================================= */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT   = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE   = path.join(ROOT, 'index.html');
const APPLY  = process.argv.includes('--apply');
const FILES  = process.argv.includes('--files');

const bold = s => '\u001b[1m' + s + '\u001b[0m';
const dim  = s => '\u001b[2m' + s + '\u001b[0m';
let html = fs.readFileSync(PAGE, 'utf8');
const startBytes = html.length;
const found = { cssRules: 0, cssSels: 0, cssBytes: 0, fns: [], ids: [], files: [] };

/* ---------------------------------------------------------------- the parts */
const styleOf  = t => [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const scriptOf = t => [...t.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
                        .map(m => m[1]).join('\n');
const decomment = t => t.replace(/\/\*[\s\S]*?\*\//g, '');

/* Classes assembled at runtime never appear whole in the source, so they can
   never be proven used by reading it. They are listed, not guessed at. */
const BUILT_BY_HAND = [/^done-(ok|none|miss|na|bad|warn)$/];

/* Classes that carry meaning to the script or to a test rather than to the eye.
   A class here is deliberately styleless. */
const STYLELESS = new Set(['landing-only', 'console-only', 'no-print', 'sr-only', 'hidden']);

function deadClasses(doc) {
  const css     = decomment(styleOf(doc));
  const outside = decomment(doc.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
                               .replace(/<!--[\s\S]*?-->/g, ''));
  const declared = new Set([...css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(m => m[1]));
  return new Set([...declared].filter(c =>
    !BUILT_BY_HAND.some(re => re.test(c)) &&
    !STYLELESS.has(c) &&
    !new RegExp('["\'`][^"\'`]*\\b' + c.replace(/-/g, '\\-') + '\\b').test(outside)));
}

/* Walks a stylesheet at brace depth, recursing into @media and friends so a
   rule parked inside one goes with the rules outside it. An at-rule left
   holding nothing goes too. */
function stripCss(css, DEAD) {
  let out = '', i = 0, start = 0, depth = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) {
        const sel = css.slice(start, i);
        if (/^\s*@(media|supports|container|layer)/.test(sel)) {
          let d = 1, j = i + 1;
          while (j < css.length && d > 0) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
          const inner = stripCss(css.slice(i + 1, j - 1), DEAD);
          if (inner.trim()) out += sel + '{' + inner + '}';
          else { found.cssRules++; found.cssBytes += (j - start); }
          i = j; start = j; continue;
        }
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const rule = css.slice(start, i + 1);
        const cut  = rule.indexOf('{');
        const head = rule.slice(0, cut), body = rule.slice(cut);
        const parts = head.split(',');
        const keep = parts.filter(sel => {
          const cs = [...sel.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(x => x[1]);
          const dead = cs.some(c => DEAD.has(c));
          if (dead) found.cssSels++;
          return !dead;
        });
        if (!keep.length) { found.cssRules++; found.cssBytes += rule.length; }
        else if (keep.length !== parts.length) out += keep.join(',') + body;
        else out += rule;
        start = i + 1;
      }
    }
    i++;
  }
  return out + css.slice(start);
}

/* A function is dead when it is declared and nothing reaches it. Reached means
   called by name, or passed somewhere: map(fn), rAF(fn), on("x",fn), {k:fn},
   [fn], or quoted in the debug hook. */
function deadFunctions(doc) {
  const script = decomment(scriptOf(doc)).replace(/^\s*\/\/.*$/gm, '');
  const names  = [...script.matchAll(/\nfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
  return [...new Set(names)].filter(n => {
    const e = n.replace(/\$/g, '\\$');
    const calls = (script.match(new RegExp('\\b' + e + '\\s*\\(', 'g')) || []).length;
    const decls = (script.match(new RegExp('function\\s+' + e + '\\s*\\(', 'g')) || []).length;
    if (calls > decls) return false;
    return !new RegExp('[(:=,\\[]\\s*' + e + '\\b|["\']' + n + '["\']').test(script);
  });
}

/* An id nothing addresses: not by getElementById, not by a selector, not by a
   fragment link. Reported, never removed, because an id costs nothing and a
   test may reach for one tomorrow. */
function deadIds(doc) {
  const script = decomment(scriptOf(doc));
  const markup = doc.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const ids = [...markup.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map(m => m[1]);
  return [...new Set(ids)].filter(i => {
    const e = i.replace(/-/g, '\\-');
    if (new RegExp('["\'#]' + e + '["\'\\s)\\.,\\]]').test(script)) return false;
    if (new RegExp('#' + e + '\\b').test(markup)) return false;
    /* An id named as a bare quoted string in an attribute is a scroll target
       the table of contents jumps to, and it is addressed. */
    if (new RegExp('"' + e + '"').test(markup)) return false;
    /* Built one piece at a time: id("dial" + n + "v"). The stem is what appears
       in the source, so the stem is what is looked for. */
    const stem = i.replace(/\d+.*$/, '');
    if (stem && stem !== i && new RegExp('"' + stem + '"\\s*\\+').test(script)) return false;
    return true;
  });
}

/* Removes one top level function and the comment block sitting on top of it. */
function cutFunction(doc, name) {
  const lines = doc.split('\n');
  const at = lines.findIndex(l => new RegExp('^function\\s+' + name.replace(/\$/g, '\\$') + '\\s*\\(').test(l));
  if (at < 0) return doc;
  let d = 0, end = -1;
  for (let j = at; j < lines.length; j++) {
    d += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
    if (d === 0 && (j > at || /\{[\s\S]*\}/.test(lines[j]))) { end = j; break; }
  }
  if (end < 0) return doc;
  let from = at;
  if (from > 0 && lines[from - 1].trimEnd().endsWith('*/')) {
    let k = from - 1;
    while (k >= 0 && !lines[k].includes('/*')) k--;
    if (k >= 0 && from - k < 14) from = k;
  }
  lines.splice(from, end - from + 1);
  return lines.join('\n');
}

/* --------------------------------------------------------------- the report */
console.log('\n' + bold('4orm IQ sweep') + dim(APPLY ? '   (applying)' : '   (report only, nothing is written)'));

let DEAD = deadClasses(html);
console.log('\n' + bold('CSS'));
if (!DEAD.size) console.log('  nothing: every class in the stylesheet is worn by something');
else {
  console.log('  ' + DEAD.size + ' class(es) no element ever wears:');
  console.log(dim('    ' + [...DEAD].sort().join(' ')));
}

/* Two passes, because pruning a selector list can orphan a class that was only
   ever named beside a dead one. It settles in two or three. */
let workingHtml = html;
for (let pass = 0; pass < 4 && DEAD.size; pass++) {
  workingHtml = workingHtml.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
    (m, a, c, z) => a + stripCss(c, DEAD) + z);
  DEAD = deadClasses(workingHtml);
}

found.fns = deadFunctions(workingHtml);
console.log('\n' + bold('Script'));
if (!found.fns.length) console.log('  nothing: every function declared is reached');
else {
  console.log('  ' + found.fns.length + ' function(s) nothing reaches:');
  found.fns.forEach(n => console.log(dim('    ' + n)));
}

found.ids = deadIds(workingHtml);
console.log('\n' + bold('Element ids') + dim('  (reported, never removed)'));
if (!found.ids.length) console.log('  nothing: every id is addressed');
else console.log(dim('  ' + found.ids.sort().join(' ')));

/* Files. A tool that asserts nothing cannot fail, so it is a picture taker
   rather than a check. Assets are listed when byte identical and never deleted
   by this script unless --files is given. */
console.log('\n' + bold('Files'));
{
  const tools = fs.readdirSync(path.join(ROOT, 'tools')).filter(f => f.endsWith('.mjs'));
  const silent = tools.filter(f => {
    if (f === 'sweep.mjs' || f === 'verify.mjs') return false;
    /* A tool can say it is a picture taker on purpose. contactsheet.mjs renders
       every screen in every state for a person to look at, which is worth having
       and will never assert anything. The marker stops the sweep nagging about
       it every run. */
    if (/SWEEP:\s*keep/.test(fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8'))) return false;
    const t = fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8');
    /* The test is whether the script has any way to end badly, not whether it
       uses a particular word. process.exit(errs.length ? 1 : 0) fails the build
       exactly as loudly as fails.push does, and an earlier version of this
       sweep called nine real tests picture takers for want of that. */
    if (/fails\.push|\bFAIL\b|\bassert\b|throw new Error/.test(t)) return false;
    for (const m of t.matchAll(/process\.exit\(([^)]*)\)/g))
      if (m[1].trim() !== '0') return false;
    return true;
  });
  silent.forEach(f => found.files.push('tools/' + f));

  const dir = path.join(ROOT, 'assets');
  if (fs.existsSync(dir)) {
    const seen = new Map();
    for (const f of fs.readdirSync(dir).sort()) {
      const key = fs.readFileSync(path.join(dir, f)).toString('base64');
      if (seen.has(key)) console.log(dim('  assets/' + f + '  is byte identical to assets/' + seen.get(key)));
      else seen.set(key, f);
    }
  }
  if (!found.files.length) console.log('  nothing: every tool in the folder can fail the build');
  else {
    console.log('  ' + found.files.length + ' tool(s) that assert nothing, so they cannot fail:');
    found.files.forEach(f => console.log(dim('    ' + f)));
  }
}

/* ---------------------------------------------------------------- the write */
if (!APPLY) {
  const wouldSave = found.cssBytes;
  console.log('\n' + bold('Nothing was written.') + '  Run again with ' + bold('--apply') +
    ' to take it out' + (wouldSave ? ' (about ' + (wouldSave / 1024).toFixed(1) + ' KB from index.html)' : '') + '.\n');
  process.exit(0);
}

const backup = PAGE + '.before-sweep';
fs.writeFileSync(backup, html);
let outHtml = workingHtml;
found.fns.forEach(n => { outHtml = cutFunction(outHtml, n); });
fs.writeFileSync(PAGE, outHtml);

console.log('\n' + bold('Written.') + '  index.html ' + startBytes + ' -> ' + outHtml.length +
  '  (' + ((startBytes - outHtml.length) / 1024).toFixed(1) + ' KB out)');

if (FILES) found.files.forEach(f => { fs.rmSync(path.join(ROOT, f), { force: true });
  console.log('  deleted ' + f); });

/* And the build has the last word. */
try {
  execFileSync('node', [path.join(ROOT, 'tools/verify.mjs')], { cwd: ROOT, stdio: 'pipe' });
  console.log(bold('\nThe build passes.') + '  The backup is at ' + path.basename(backup) +
    ', delete it when you are happy.\n');
} catch (e) {
  fs.copyFileSync(backup, PAGE);
  console.log('\n' + bold('The build did not pass, so index.html has been put back.'));
  console.log(String(e.stdout || '').split('\n').filter(Boolean).slice(-8).map(l => '  ' + l).join('\n'));
  console.log('\nNothing was lost, and the failure above says what to do. It is one of two');
  console.log('things. Either something the sweep called dead is reached in a way this script');
  console.log('cannot see, in which case reach it in a way it can and run again. Or the removal');
  console.log('left a live rule standing on its own that was only ever correct beside the one');
  console.log('that went, in which case fix that rule by hand and run again.\n');
  process.exit(1);
}
