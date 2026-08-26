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

const missing = CATALOGUE.filter(s => !REFERENCE[s.display_name]);
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
  CATALOGUE.map(s => q(s.display_name) + ':' + q(REFERENCE[s.display_name].info)).join(',\n') +
  '\n};';

const regread =
  'var REGREAD = {\n' +
  CATALOGUE.map(s => {
    const r = REFERENCE[s.display_name];
    return q(s.display_name) + ':[' + q(r.hit) + ',\n  ' + q(r.miss) + ',\n  ' + q(r.look) + ']';
  }).join(',\n') +
  '\n};';

/* ---- the catalogue the console needs for routing and coverage ---- */
const meta =
  'var CATALOGUE_META = {\n' +
  '  total: ' + TOTAL_SOURCES + ',\n' +
  '  sources: {\n' +
  CATALOGUE.map(s =>
    '    ' + q(s.display_name) + ':{id:' + q(s.source_id) + ',cat:' + q(s.category) +
    ',tier:' + q(s.source_tier) + ',jur:' + q(s.jurisdictions) +
    ',verts:' + q(s.verticals) + ',also:' + q(s.also || []) +
    ',transport:' + q(s.transport) + '}'
  ).join(',\n') + '\n  }\n};';

const blocks = {
  SOURCES: sources,
  REGINFO: reginfo,
  REGREAD: regread,
  CATALOGUE_META: meta
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
