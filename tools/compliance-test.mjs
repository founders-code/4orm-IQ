/* ================= A RULE THAT CANNOT FAIL IS NOT A RULE
   Every rule in tools/compliance.mjs is broken here on purpose, in the file it
   polices, and is required to notice. A rule that still passes with its
   subject removed is worse than no rule: it is a green light with nothing
   behind it, and the whole gate reads as passing.

   Nothing is left changed. Each file is restored before the next rule runs,
   and restored again in a finally block if anything throws. */
import fs from 'fs';

/* Each entry: the rule id, the file to damage, and what to do to it. The
   damage is deliberately small and specific, because a rule that only notices
   a file being emptied is not testing much. */
const BREAK = [
  /* The realistic shape of this mistake is a column added to a create table,
     not a migration written by somebody who knew the rule existed. */
  ['C1',  'db/telemetry.sql',    s => s + '\ncreate table t (\n  identifier text,\n  n int\n);\n'],
  ['C2',  'api/_ops.js',         s => s.replace('if (!salt) return null;', 'if (!salt) { }')],
  ['C3',  'api/_budget.js',      s => s.replace('if (hashed) pgWriteRun', 'if (true) pgWriteRun')],
  ['C4',  'api/check.js',        s => s.replace("verdict === 'RED' && !stillRed", 'false')],
  ['C5',  'api/_register.js',    s => s.replace('REPLY_DAYS = 14', 'REPLY_DAYS = 0')],
  ['C6',  'api/check.js',        s => s.replace("out.quote = '';", '')],
  ['C7',  'api/_catalogue.js',   s => s.replace("enabled:false, pending:'SR-001'",
                                                "enabled:true, pending:'SR-001'")],
  ['C8',  'api/check.js',        s => s.replace('if (!budget.ok) {', 'if (false) {')],
  ['C9',  'api/_scheduled.js',   s => s.replace('on conflict do nothing', '')],
  ['C10', 'api/check.js',        s => s.replace("emit('result', out)", "emit('result', payload)")],
  ['C11', 'api/evidence.js',     s => s.replace("json({ error: 'query_failed' })",
                                  "json({ error: 'query_failed', detail: String(e.message) })")],
  ['C12', 'api/stats.js',        s => s + '\nconsole.log("hello");\n'],
  ['C13', 'api/check.js',        s => s.replace('L.push(fenceOrder(N));', '')],
  ['C14', 'api/counter.js',      s => s + '\nconst x = `select * from runs where id = ${id}`;\n'],
  ['C15', 'robots.txt',          s => s.replace('Disallow: /api/', '')],
  ['C16', 'api/_auth.js',        s => s.replace('if (!secret) return { ok: false, status: 503',
                                                'if (false) return { ok: false, status: 503')],
];

const fails = [];
const originals = new Map();
const save = f => { if (!originals.has(f)) originals.set(f, fs.readFileSync(f, 'utf8')); };
const restoreAll = () => { for (const [f, s] of originals) fs.writeFileSync(f, s); };

/* The module caches nothing between calls: every rule reads from disk when it
   runs, which is what makes this possible. It is imported fresh anyway, so a
   future change to caching shows up here rather than silently. */
async function check(id) {
  const mod = await import('./compliance.mjs?t=' + Date.now());
  return mod.run().find(r => r.id === id);
}

try {
  /* Clean first. If the gate is already failing, nothing below means anything. */
  const base = await check('C1');
  const all = (await import('./compliance.mjs?base=' + Date.now())).run();
  const already = all.filter(r => !r.ok);
  if (already.length) {
    console.error('compliance-test FAIL\n  the gate is already failing, so no rule below '
      + 'can be shown to work: ' + already.map(r => r.id).join(', '));
    process.exit(1);
  }
  const ids = new Set(all.map(r => r.id));
  for (const [id] of BREAK)
    if (!ids.has(id)) fails.push('compliance-test breaks "' + id + '" and no such rule exists');
  for (const id of ids)
    if (!BREAK.some(b => b[0] === id))
      fails.push('rule ' + id + ' has never been shown to fail; add it to compliance-test');

  for (const [id, file, damage] of BREAK) {
    if (!fs.existsSync(file)) { fails.push(id + ': ' + file + ' is gone'); continue; }
    save(file);
    const before = originals.get(file);
    const after = damage(before);
    if (after === before) {
      fails.push(id + ': the damage to ' + file + ' changed nothing, so this proves nothing');
      continue;
    }
    fs.writeFileSync(file, after);
    const r = await check(id);
    fs.writeFileSync(file, before);
    if (!r) { fails.push(id + ': the rule vanished'); continue; }
    if (r.ok) fails.push(id + ' passed with ' + file + ' broken, so it is a green light '
      + 'with nothing behind it');
  }
} finally { restoreAll(); }

/* And the files really are back. */
for (const [f, s] of originals)
  if (fs.readFileSync(f, 'utf8') !== s)
    fails.push('compliance-test left ' + f + ' changed');

if (fails.length) { console.error('compliance-test FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('compliance-test ok  all ' + BREAK.length + ' rules break when their subject does');
