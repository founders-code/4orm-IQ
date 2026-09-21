/* ====================== NOTHING LEAVES THAT THE INTERFACE DOES NOT DRAW
   Every field on a response is a field somebody can read. A field nobody
   renders is all cost and no benefit: it cannot help a reader, and it can tell
   them something nobody decided to tell them.

   This walks the fields each route returns and looks for each one in the page
   that consumes it. A field with no reader fails the build. The fix is either
   to draw it or to stop sending it; there is no third answer.

   It is deliberately text based. Running the route needs a database, a key and
   a vendor, and a gate that only runs where all three are present is a gate
   that never runs. */
import fs from 'fs';

const fails = [], notes = [];
const page  = fs.readFileSync('index.html', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');

/* A field counts as drawn where the page names it at all: as a property, in a
   bracket, or as a destructured key. Loose on purpose. This gate is here to
   catch a field with NO reader, not to audit how each one is used. */
const drawn = (src, key) =>
  new RegExp('(?:\\.|\\[["\']|\\b)' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
             + '(?:["\']\\]|\\b)').test(src);

/* ---- 1. /api/check, the public payload ------------------------------- */
{
  const src = fs.readFileSync('api/check.js', 'utf8');
  const i = src.indexOf('function forClient');
  ok(i > -1, 'check.js no longer cuts its payload before sending it');

  /* Both exits must go through the cut. A shaping applied to one of two exits
     is a shaping that does not exist. */
  const tail = src.slice(src.indexOf('if (stream) { emit(\'result\''));
  ok(/emit\('result', out\)/.test(tail),
     'the streamed exit sends the uncut payload');
  ok(/res\.status\(200\)\.json\(out\)/.test(tail),
     'the whole-response exit sends the uncut payload');

  /* The keys toRenderShape returns, read off the return statement. */
  const rs = src.slice(src.indexOf('function toRenderShape'));
  const ret = rs.slice(rs.indexOf('\n  return {'));
  const keys = [...ret.slice(0, ret.indexOf('\n  };')).matchAll(/^\s{4}(\w+):/gm)]
    .map(m => m[1]);
  ok(keys.length > 20,
     'shapecheck could not read the payload keys, so it would pass vacuously');

  /* Which of them forClient removes. */
  const cut = src.slice(i, src.indexOf('function toRenderShape', i));
  const removed = new Set([...cut.matchAll(/delete d\.(\w+)/g)].map(m => m[1]));

  for (const k of keys) {
    if (removed.has(k)) continue;
    if (drawn(page, k) || drawn(admin, k)) continue;
    fails.push('/api/check returns "' + k + '" and no page reads it');
  }
  for (const k of removed)
    if (drawn(page, k))
      notes.push('forClient removes "' + k + '" and the page reads it');

  /* The audit panel. These travelled to the browser inside pipeline and none
     of them was drawn, so each is named here rather than left to the loose
     rule above. */
  const mustNotShip = ['cost_usd', 'seeds', 'build', 'model', 'unreached', 'round1', 'round2'];
  for (const k of mustNotShip)
    ok(new RegExp('\\b' + k + '\\b').test(cut),
       'the payload cut no longer removes "' + k + '" from what the browser gets');
}

/* ---- 2. The public register ------------------------------------------ */
{
  const src = fs.readFileSync('api/_register.js', 'utf8');
  /* The naming gate. An unnamed row carries counts and nothing a reader could
     turn back into a party: not the name, not the domain, and not the
     authority's finding, which is free text that can carry the name inside
     it. */
  for (const f of ['name', 'domain', 'authority', 'authorityUrl', 'finding', 'foundAt'])
    ok(new RegExp(f + ':\\s*named\\s*(?:&&|\\?)').test(src),
       'readRegister publishes "' + f + '" on a row that has not been named');
  ok(!/party_key,?\s*$/m.test(src.slice(src.indexOf('const items'))) &&
     !/partyKey:/.test(src),
     'the register publishes its internal party key');
}

/* ---- 3. No route hands back an exception ----------------------------- */
{
  for (const f of fs.readdirSync('api').filter(f => f.endsWith('.js'))) {
    const t = fs.readFileSync('api/' + f, 'utf8');
    /* A database error carries table names, column names and sometimes the
       offending value. The caller gets a code; the operator log gets the rest. */
    const leaks = [...t.matchAll(/res\.status\(\d+\)\.json\(\{[^}]*String\(e[^)]*\.message/g)];
    for (const m of leaks)
      fails.push('api/' + f + ' returns an exception message to the caller');
  }
}

/* ---- 4. One writer to the log ---------------------------------------- */
{
  let where = [];
  for (const f of fs.readdirSync('api').filter(f => f.endsWith('.js'))) {
    if (f === '_log.js') continue;
    const t = fs.readFileSync('api/' + f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/\bconsole\.\w+\s*\(/.test(t)) where.push(f);
  }
  ok(where.length === 0,
     'api/ writes to the log outside _log.js: ' + where.join(', '));
}

function ok(c, m) { if (!c) fails.push(m); }

if (notes.length) console.log('  note: ' + notes.join('\n  note: '));
if (fails.length) { console.error('shapecheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('shapecheck ok  every field returned has a reader, no exception reaches a caller');
