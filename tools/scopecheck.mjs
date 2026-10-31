/* ================== THE NUMBER THE PRODUCT PRINTS ABOUT ITS OWN COVERAGE
   README.md: "The register count is computed, never typed. _catalogue.js
   exports TOTAL_SOURCES, which today is 135. If a page prints a number for it,
   that number has to come from there."

   check.html prints 175, and 175 is not a count of registers.

   api/_sr001.json carries total 153 and an `enabled` array of 175 strings. The
   array is a name AND ALIAS allowlist, and it also holds check descriptions
   ("HTML and favicon similarity against the 4orm corpus"), so its length is
   not a quantity of anything. POLICY.sources_enabled is that length, the API
   sends it as registers_in_scope, and the report tells the reader the run
   covered 175 registers while the catalogue holds 135 enabled.

   It is worse than a wrong caption. api/check.js counts a register
   out_of_scope when its display_name is not in that array, by exact string
   match, and sources_out_of_scope is one of the hashed fields in all three
   canonical versions in api/_ops.js. So the tamper-evident chain is attesting
   a coverage figure that is wrong for about two registers in five, and
   api/check.js:869 promises the opposite: "coverage is COUNTED from the
   retrieval log rather than asserted."

   WHICH NUMBER IS RIGHT IS NOT A DECISION THIS FILE MAKES. There are three
   candidates and they mean different things:
     135  every enabled register in the catalogue, which is what README says a
          page must print
      96  the registers applicable to this run's vertical, which is the honest
          reading of the words "in scope"
     153  the manifest's own total, from the signed SR-001 workbook
   The manifest is a signed document, so reinterpreting it is a governance
   decision and not a patch. This gate exists so the contradiction fails the
   build instead of being hashed into the chain unnoticed.

   Run by npm test. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fails = [];
const say = (ok, line) => console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + line);

const man = JSON.parse(fs.readFileSync(path.join(root, 'api/_sr001.json'), 'utf8'));
const { CATALOGUE, TOTAL_SOURCES } = await import(new URL('../api/_catalogue.js', import.meta.url));
const rows = (CATALOGUE || []).filter(r => r.enabled !== false);
const names = new Set(rows.map(r => r.display_name));
const boards = new Set(rows.map(r => r.board).filter(Boolean));
const enabled = man.enabled || [];

/* 1. A subset cannot be larger than the set it is drawn from. */
const impossible = enabled.length > (man.total | 0);
if (impossible)
  fails.push('_sr001.json says total ' + man.total + ' and lists ' + enabled.length
    + ' enabled, so the enabled list is larger than the register it is drawn from. '
    + 'POLICY.sources_enabled is that length and api/check.js sends it to the reader '
    + 'as registers_in_scope.');
say(!impossible, 'the enabled list is no larger than the manifest total');

/* 2. Every entry on the manifest names a register that exists. */
const orphan = enabled.filter(n => !names.has(n) && !boards.has(n));
if (orphan.length)
  fails.push(orphan.length + ' of ' + enabled.length + ' manifest entries match no enabled '
    + 'register by display_name or board, so the list is not a register count. '
    + 'First three: ' + orphan.slice(0, 3).map(s => '"' + s + '"').join(', '));
say(!orphan.length, 'every manifest entry names a register that exists');

/* 3. Every enabled register is on the manifest, because api/check.js counts the
      ones that are not as out_of_scope, and that count is hashed. */
const unlisted = rows.filter(r => !enabled.includes(r.display_name));
if (unlisted.length)
  fails.push(unlisted.length + ' of ' + rows.length + ' enabled registers are absent from the '
    + 'manifest by name, so api/check.js counts them out_of_scope on every run where they '
    + 'apply. sources_out_of_scope is a hashed field in all three canonical versions, so the '
    + 'chain attests the wrong figure. First three: '
    + unlisted.slice(0, 3).map(r => '"' + r.display_name + '"').join(', '));
say(!unlisted.length, 'every enabled register is on the manifest');

/* 4. The rule README states, about the number a page may print. */
const page = fs.readFileSync(path.join(root, 'check.html'), 'utf8');
if (/registers in scope/.test(page) && /registers_in_scope/.test(page)) {
  const api = fs.readFileSync(path.join(root, 'api/check.js'), 'utf8');
  const typed = /registers_in_scope:\s*POLICY\.sources_enabled/.test(api);
  if (typed)
    fails.push('check.html prints a register count taken from POLICY.sources_enabled, which '
      + 'is the length of a typed list. README says a printed register count has to come from '
      + '_catalogue.js TOTAL_SOURCES, which is ' + TOTAL_SOURCES + '.');
  say(!typed, 'the printed register count is computed, not typed');
}

console.log('');
if (fails.length) {
  console.log('scopecheck FAILED');
  fails.forEach(f => console.log('  ' + f + '\n'));
  process.exit(1);
}
console.log('scopecheck ok  the coverage figures agree with the catalogue');
