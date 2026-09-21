/* ========================= NOTHING IS CONCATENATED INTO A STATEMENT
   Postgres binds values, not identifiers, so a column or table name genuinely
   cannot be a parameter. Everything else can be, and everything else is.

   The one identifier that is concatenated is looked up in a list written in
   the file rather than taken from a caller, and is checked against the shape
   of a column name on the way out. Both are tested here. */
import fs from 'fs';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const files = fs.readdirSync('api').filter(f => f.endsWith('.js'));

/* Comments are not code. A file that explains in prose why it does not do
   something must not fail for having written the thing down. */
const code = f => fs.readFileSync('api/' + f, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ---- 1. No value reaches a statement by interpolation ----------------- */
{
  /* Every ${...} inside a template literal that also contains SQL. The ones
     that are allowed are named, with the reason, below. */
  /* SINCE is a fixed fragment written in the file, with $1 in it.
     col is the one identifier Postgres cannot bind, allowlisted in _ops.js and
     tested on its own below.
     A join of a placeholder list is a bulk insert: every value in it is still
     bound, and only the shape of the tuples is being built. That one is not
     taken on trust either, it is checked below. */
  const ALLOWED = new Set(['SINCE', 'col', "vals.join(',')"]);
  for (const f of files) {
    const src = code(f);
    const lits = src.match(/`[^`]*`/g) || [];
    for (const lit of lits) {
      if (!/\b(select|insert\s+into|update|delete\s+from)\b/i.test(lit)) continue;
      for (const m of lit.matchAll(/\$\{([^}]*)\}/g)) {
        const expr = m[1].trim();
        if (ALLOWED.has(expr)) continue;
        fails.push('api/' + f + ' builds SQL by interpolating ' + JSON.stringify(expr));
      }
    }
  }
}

/* ---- 2. The window is bound, not written in ---------------------------- */
{
  const src = fs.readFileSync('api/admin-metrics.js', 'utf8');
  ok(/const SINCE = "now\(\) - \(\$1::int/.test(src),
     'the metrics window is no longer a bound parameter');
  /* And every query that uses it has to pass it. A placeholder with no value
     is an error at the database, not a silent default. */
  const uses = [...src.matchAll(/q\(`[^`]*\$\{SINCE\}[^`]*`([^)]*)\)/g)];
  ok(uses.length >= 6, 'shapecheck found only ' + uses.length
     + ' windowed queries, so this test would barely test anything');
  for (const u of uses)
    ok(/\[\s*days/.test(u[1]),
       'a query uses the bound window and passes no value for it');
}

/* ---- 3. The one concatenated identifier is allowlisted ---------------- */
{
  const src = fs.readFileSync('api/_ops.js', 'utf8');
  ok(/Object\.create\(null\)/.test(src),
     'the column allowlist is a plain object, so "constructor" and "__proto__" '
   + 'return something that is not a column and is not undefined either');
  ok(/hasOwnProperty\.call\(COLUMN/.test(src),
     'the column name is read off the allowlist without an own-property check');
  ok(/\/\^\[a-z_\]\{1,32\}\$\//.test(src),
     'whatever comes out of the allowlist reaches the statement unchecked');
  ok(/return \{ ok: false, reason: 'bad_status' \}/.test(src),
     'an unknown status is not refused');
}

/* ---- 4. Order and limit are never taken from a caller ----------------- */
{
  for (const f of files) {
    const src = code(f);
    for (const m of src.matchAll(/\b(order\s+by|limit)\s+\$\{/gi))
      fails.push('api/' + f + ' takes its ' + m[1].toLowerCase() + ' from outside the file');
    /* A limit bound as a parameter is fine; a limit built from req is not. */
    for (const m of src.matchAll(/limit\s+\$\d+/gi)) { /* bound: allowed */ }
  }
  /* And every route that takes a limit clamps it. */
  const reg = fs.readFileSync('api/_register.js', 'utf8');
  ok(/Math\.max\(1, Math\.min\(200/.test(reg),
     'the register limit is no longer clamped, so a caller sets the page size');
  const met = fs.readFileSync('api/admin-metrics.js', 'utf8');
  ok(/Math\.min\(365, Math\.max\(1, parseInt/.test(met),
     'the metrics window is no longer clamped');
}

/* ---- 5. No star selects ----------------------------------------------- */
{
  for (const f of files) {
    const src = code(f);
    if (/select\s+\*/i.test(src))
      fails.push('api/' + f + ' selects every column, so the response shape is '
        + 'whatever the database was last migrated to');
  }
}

/* ---- 6. A bulk insert builds placeholders and nothing else ----------- */
{
  const src = code('_store.js');
  const pushes = [...src.matchAll(/vals\.push\(([^;]*)\);/g)].map(m => m[1].trim());
  ok(pushes.length >= 3,
     'sqlcheck can no longer find the bulk inserts it is meant to police');
  for (const push of pushes)
    ok(/^`\(\$\$\{[^`]*`$/.test(push.replace(/\$\{b\+\d+\}/g, '${')),
       'a bulk insert pushes something other than a placeholder tuple: ' + push.slice(0, 60));
}

if (fails.length) { console.error('sqlcheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('sqlcheck ok  every value bound, one identifier allowlisted, no star selects');
