/**
 * 4orm IQ - CATALOGUE SYNC
 *
 *   node tools/sync-catalogue.mjs
 *
 * The console needs the board, the register reference and the source counts.
 * The API needs the same things to plan a run and to measure coverage. Keeping
 * two hand written copies is how a board says 64 while a schema says 48, and
 * that class of disagreement has cost this project three outages.
 *
 * So there is one copy, in api/_catalogue.js and api/_reference.js, and this
 * writes it into index.html between marked fences. Run it after any catalogue
 * change. tools/verify.mjs fails the build if the two ever disagree.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const target = path.join(root, 'index.html');

const { CATALOGUE, board, TOTAL_SOURCES } = await import(path.join(root, 'api/_catalogue.js'));
const { REFERENCE } = await import(path.join(root, 'api/_reference.js'));

/* Only what the board carries. A row waiting on SR-001 is on no board and is
   asked by nothing, and its explanation is the pending_why written beside it
   in the catalogue rather than a register readout for a register we do not
   yet ask. */
const missing = CATALOGUE.filter(s => s.enabled && !REFERENCE[s.display_name]);
const unexplained = CATALOGUE.filter(s => !s.enabled && !s.pending_why);
if (unexplained.length) {
  console.error('a row is disabled without saying why it is waiting:');
  unexplained.forEach(s => console.error('  ' + s.source_id));
  process.exit(1);
}
if (missing.length) {
  console.error('every register on the board needs a reference entry. Missing:');
  missing.forEach(s => console.error('  ' + s.display_name));
  process.exit(1);
}

const q = v => JSON.stringify(v);

/* ---- SOURCES: the board, grouped, in catalogue order ---- */
const groups = board();
const sources =
  'var SOURCES = [\n' +
  groups.map((g, i) =>
    ' {c:' + q(g.c) + ', w:' + ((i % 3) + 1) + ', items:[' +
    g.items.map(q).join(',') + ']}'
  ).join(',\n') + '\n];\n' +
  'var TOTAL_SOURCES = SOURCES.reduce(function(n,g){return n+g.items.length;},0);';

/* ---- REGINFO and REGREAD ---- */
const reginfo =
  'var REGINFO = {\n' +
  CATALOGUE.filter(s => s.enabled).map(s => q(s.display_name) + ':' + q(REFERENCE[s.display_name].info)).join(',\n') +
  '\n};';

const regread =
  'var REGREAD = {\n' +
  CATALOGUE.filter(s => s.enabled).map(s => {
    const r = REFERENCE[s.display_name];
    return q(s.display_name) + ':[' + q(r.hit) + ',\n  ' + q(r.miss) + ',\n  ' + q(r.look) + ']';
  }).join(',\n') +
  '\n};';

/* ---- the catalogue the console needs for routing and coverage ---- */
const meta =
  'var CATALOGUE_META = {\n' +
  '  total: ' + TOTAL_SOURCES + ',\n' +
  '  sources: {\n' +
  CATALOGUE.filter(s => s.enabled).map(s =>
    '    ' + q(s.display_name) + ':{id:' + q(s.source_id) + ',cat:' + q(s.category) +
    ',tier:' + q(s.source_tier) + ',jur:' + q(s.jurisdictions) +
    ',verts:' + q(s.verticals) + ',also:' + q(s.also || []) +
    ',transport:' + q(s.transport) + '}'
  ).join(',\n') + '\n  }\n};';

/* CATALOGUE_META is built above and deliberately not written into the page.
   The console reads the board, the reference and the counts; routing and
   coverage are worked out in api/check.js against the catalogue itself, so a
   second copy of the routing table in the page would be a copy nothing reads
   and everything could drift from. It is kept here because the moment the page
   needs it, this is where it comes from. */
void meta;

const blocks = {
  SOURCES: sources,
  REGINFO: reginfo,
  REGREAD: regread
};

let html = fs.readFileSync(target, 'utf8');
let changed = 0;

Object.entries(blocks).forEach(([name, body]) => {
  const open = '/* GENERATED:' + name + ' - do not edit by hand. Source: api/_catalogue.js + api/_reference.js. Run tools/sync-catalogue.mjs. */';
  const close = '/* END GENERATED:' + name + ' */';
  const re = new RegExp(
    escape(open) + '[\\s\\S]*?' + escape(close), 'm');
  const next = open + '\n' + body + '\n' + close;

  if (re.test(html)) {
    const before = html;
    html = html.replace(re, next);
    if (html !== before) changed++;
    return;
  }
  /* First run: replace the hand written declaration in place. */
  const decl = new RegExp('var ' + name + '\\s*=\\s*[\\[{][\\s\\S]*?\\n[\\]}];?', 'm');
  if (!decl.test(html)) {
    console.error('could not find ' + name + ' in index.html to replace');
    process.exit(1);
  }
  html = html.replace(decl, next);
  changed++;
});

/* TOTAL_SOURCES is emitted inside the SOURCES block now. Remove any older
   hand written declaration so the later one cannot silently win. */
html = html.replace(/^var TOTAL_SOURCES\s*=\s*SOURCES\.reduce[^\n]*\n(?!\/\* END GENERATED)/m, '');

fs.writeFileSync(target, html);
console.log('synced ' + changed + ' block(s). ' + TOTAL_SOURCES + ' sources across ' + groups.length + ' checks.');

function escape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
