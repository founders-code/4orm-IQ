/* ============================================= THE COMPLIANCE GATE
   Everything this product has promised in writing, checked against the code
   that is about to ship. Not a style pass: each rule below is one somebody
   could hold us to, and each one names the document it comes from.

   A rule that cannot fail is not a rule, so tools/compliance-test.mjs breaks
   each one on purpose and requires it to fail. If a rule here stops being able
   to fail, that test says so.

   Run by `npm run check`, which is what CI runs. */
import fs from 'fs';

const rules = [];
const rule = (id, doc, says, fn) => rules.push({ id, doc, says, fn });
const read = p => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
const code = p => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ------------------------------------------------------------------ *
 * WHAT WE TELL READERS WE DO NOT KEEP
 * ------------------------------------------------------------------ */
rule('C1', 'PIA-001', 'no table carries the identifier a reader searched for', () => {
  const sql = ['db/telemetry.sql', 'db/schema.sql', 'db/schema.neon.sql', 'db/spend.sql']
    .map(read).join('\n').replace(/--[^\n]*/g, '');
  const banned = ['identifier ', 'query_text', 'search_text', 'party_name', 'subject_name'];
  const hit = banned.filter(b => new RegExp('^\\s*' + b, 'im').test(sql));
  return hit.length ? 'a column named ' + hit.join(', ') + ' exists' : null;
});

rule('C2', 'PIA-001', 'a visitor is never hashed without a salt', () => {
  const s = code('api/_ops.js');
  if (!/if \(!salt\) return null/.test(s)) return 'visitorDay does not refuse without OPS_SALT';
  return null;
});

rule('C3', 'PIA-001', 'the spend ledger stores no address', () => {
  const s = read('api/_budget.js');
  if (!/if \(!salt\) return \{ key: ip, hashed: false \}/.test(s))
    return 'clientKey does not fall back to an unwritten key when no salt is set';
  if (!/if \(hashed\) pgWriteRun/.test(s))
    return 'the ledger writes a client key that was never hashed';
  return null;
});

/* ------------------------------------------------------------------ *
 * WHAT WE TELL READERS ABOUT OTHER PEOPLE
 * ------------------------------------------------------------------ */
rule('C4', 'CR-001', 'an adverse record counts only where it names the party', () => {
  const s = code('api/check.js');
  if (!/state === 'RED' && !ev\.some\(e => e\.match === 'exact'\)/.test(s))
    return 'the attachment rule is no longer enforced on the way out';
  if (!/verdict === 'RED' && !stillRed/.test(s))
    return 'a demoted category can leave the verdict at RED';
  return null;
});

rule('C5', 'CR-001', 'a party is counted before the reply window and named after it', () => {
  const s = read('api/_register.js');
  if (!/REPLY_DAYS = 14/.test(s)) return 'the reply window is not 14 days';
  if (!/contacted_at is not null/.test(s))
    return 'a party can be named without having been written to';
  for (const f of ['name', 'domain', 'authority', 'authorityUrl', 'finding'])
    if (!new RegExp(f + ':\\s*named\\s*(?:&&|\\?)').test(s))
      return 'an unnamed row publishes ' + f;
  return null;
});

rule('C6', 'CR-001', 'two registers are pointed at and never reproduced', () => {
  const cat = read('api/_catalogue.js'), chk = read('api/check.js');
  if (!/terms:\s*'link_out_only'/.test(cat)) return 'no register is marked link out only';
  if (!/LINK_OUT_ONLY/.test(chk) || !/out\.quote = ''/.test(chk))
    return 'a quotation from a link-out-only register is not stripped at the boundary';
  return null;
});

rule('C7', 'SR-001', 'nothing asks a register the signed schedule has not cleared', () => {
  const s = read('api/_catalogue.js');
  const pending = (s.match(/pending:\s*'SR-001'/g) || []).length;
  if (!pending) return 'no register is held pending a signature';
  /* One row per S({...}) entry, so "enabled" is read against the register it
     belongs to rather than against whatever happens to be nearby. */
  const rows = s.split(/\bS\(\{/).filter(r => /pending:\s*'SR-001'/.test(r));
  const open = rows.filter(r => !/enabled:\s*false/.test(r));
  return open.length ? open.length + ' pending register(s) are enabled' : null;
});

/* ------------------------------------------------------------------ *
 * WHAT WE SPEND, AND WHO CAN MAKE US SPEND IT
 * ------------------------------------------------------------------ */
rule('C8', 'CR-002', 'nothing paid for is reached before a budget and rate check', () => {
  const s = code('api/check.js');
  const gate = s.indexOf('reserve(');
  if (gate < 0) return 'the route takes no reservation';
  for (const [needle, what] of [['exa(', 'Exa'], ['parallel(', 'Parallel'],
                                ['new Anthropic(', 'the Claude client']]) {
    const at = s.indexOf(needle);
    if (at > -1 && at < gate) return 'the gate runs after ' + what;
  }
  if (!/if \(!budget\.ok\)/.test(s)) return 'the reservation is taken and never acted on';
  return null;
});

rule('C9', 'CR-002', 'a scheduled call is signed, windowed and usable once', () => {
  const s = read('api/_scheduled.js');
  if (!/timingSafeEqual/.test(s)) return 'the signature comparison returns early';
  if (!/Math\.abs\(now - ts\) > WINDOW_S/.test(s)) return 'there is no window check';
  if (!/on conflict do nothing/.test(s)) return 'the replay ledger races itself';
  if (!/status: 503, error: 'schedule_disabled'/.test(s))
    return 'with no secret set the scheduled door is open rather than absent';
  return null;
});

/* ------------------------------------------------------------------ *
 * WHAT LEAVES THE SERVER
 * ------------------------------------------------------------------ */
rule('C10', 'CR-002', 'no response carries a field the interface does not draw', () => {
  const s = code('api/check.js');
  if (!/function forClient/.test(s)) return 'the payload is not cut before it is sent';
  if (!/emit\('result', out\)/.test(s)) return 'the streamed exit sends the uncut payload';
  if (!/json\(out\)/.test(s)) return 'the whole-response exit sends the uncut payload';
  return null;
});

rule('C11', 'CR-002', 'no caller is handed an exception', () => {
  const bad = fs.readdirSync('api').filter(f => f.endsWith('.js')).filter(f =>
    /res\.status\(\d+\)\.json\(\{[^}]*String\(e[^)]*\.message/.test(code('api/' + f)));
  return bad.length ? bad.join(', ') + ' returns an exception message' : null;
});

rule('C12', 'CR-002', 'one writer to the log, and it scrubs', () => {
  const others = fs.readdirSync('api').filter(f => f.endsWith('.js') && f !== '_log.js')
    .filter(f => /\bconsole\.\w+\s*\(/.test(code('api/' + f)));
  if (others.length) return 'console calls outside _log.js: ' + others.join(', ');
  const s = read('api/_log.js');
  for (const shape of ['<email>', '<ip>', '<key>', '<connection>', '<token>'])
    if (!s.includes(shape)) return 'the scrub does not remove ' + shape;
  return null;
});

/* ------------------------------------------------------------------ *
 * EVIDENCE IS NOT INSTRUCTION
 * ------------------------------------------------------------------ */
rule('C13', 'CR-002', 'retrieved text reaches the model fenced and labelled', () => {
  const s = code('api/check.js');
  const b = s.slice(s.indexOf('function brief('), s.indexOf('return L.join'));
  if (!/fenceOrder\(/.test(b)) return 'the brief carries no standing order';
  if (!/fenceAsk\(/.test(b)) return 'the identifier a reader typed is not fenced';
  if ((b.match(/fence\(/g) || []).length < 6) return 'not every untrusted span is fenced';
  if (/L\.push\(`[^`]*\$\{x\.(?:text|title)/.test(b))
    return 'a page’s own words are interpolated into the brief unfenced';
  if (!/R8/.test(read('api/_cue.js'))) return 'the cue no longer states the rule';
  return null;
});

/* ------------------------------------------------------------------ *
 * THE DATABASE
 * ------------------------------------------------------------------ */
rule('C14', 'CR-002', 'every value is bound and no identifier comes from a caller', () => {
  for (const f of fs.readdirSync('api').filter(f => f.endsWith('.js'))) {
    const src = code('api/' + f);
    if (/select\s+\*/i.test(src)) return 'api/' + f + ' selects every column';
    for (const lit of src.match(/`[^`]*`/g) || []) {
      if (!/\b(select|insert\s+into|update|delete\s+from)\b/i.test(lit)) continue;
      for (const m of lit.matchAll(/\$\{([^}]*)\}/g)) {
        const e = m[1].trim();
        if (e === 'SINCE' || e === 'col' || e === "vals.join(',')") continue;
        return 'api/' + f + ' interpolates ' + JSON.stringify(e) + ' into SQL';
      }
    }
  }
  if (!/hasOwnProperty\.call\(COLUMN/.test(read('api/_ops.js')))
    return 'the one concatenated column name is not allowlisted with an own-property check';
  return null;
});

/* ------------------------------------------------------------------ *
 * WHAT IS PUBLIC
 * ------------------------------------------------------------------ */
rule('C15', 'CR-002', 'the api and the real-run door are not indexed', () => {
  const v = read('vercel.json'), r = read('robots.txt');
  if (!/X-Robots-Tag/.test(v)) return 'vercel.json sets no X-Robots-Tag on /api';
  if (!/Disallow: \/api\//.test(r)) return 'robots.txt does not disallow /api/';
  if (!/Disallow: \/real-run-live-go/.test(r))
    return 'robots.txt does not disallow the real-run door';
  if (!/noindex/.test(code('api/check.js'))) return 'the check route sends no noindex header';
  return null;
});

rule('C16', 'CR-002', 'the back office locks rather than opens when misconfigured', () => {
  const s = read('api/_auth.js');
  if (!/if \(!secret\) return \{ ok: false, status: 503/.test(s))
    return 'with no Clerk key the back office is open';
  if (!/no ADMIN_EMAILS allowlist/.test(s))
    return 'with no allowlist the back office is open';
  return null;
});

/* ------------------------------------------------------------------ *
 * RUN
 * ------------------------------------------------------------------ */
export function run() {
  return rules.map(r => {
    let why = null;
    try { why = r.fn(); } catch (e) { why = 'the rule threw: ' + (e.message || e); }
    return { ...r, ok: !why, why };
  });
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const out = run();
  const bad = out.filter(r => !r.ok);
  for (const r of out)
    console.log('  ' + (r.ok ? 'ok  ' : 'FAIL') + '  ' + r.id + '  ' + r.doc
      + '  ' + r.says + (r.ok ? '' : '\n          ' + r.why));
  if (bad.length) {
    console.error('\ncompliance FAIL  ' + bad.length + ' of ' + out.length);
    process.exit(1);
  }
  console.log('\ncompliance ok  ' + out.length + ' rules, each naming the document it comes from');
}
