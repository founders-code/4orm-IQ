/* ========================= WHAT WE SHIP TO A STRANGER'S BROWSER
   index.html is one file of over a megabyte, written by hand over months. That
   is exactly the shape of file a key ends up in: not because anybody decided
   to put one there, but because a line that worked locally got saved.

   This reads every file served to the public and refuses the build on:
     a credential of any recognised shape
     an internal endpoint, host or address
     a route that was commented out rather than removed
     a stack trace, a file path from a build machine, an author note

   It is the file the compliance gate calls the scanner, and it runs on the
   pages, not on the repository: a secret in a tool nobody serves is a
   different problem with a different answer. */
import fs from 'fs';

/* What the public gets. Anything not on this list is not served. */
const SERVED = ['index.html', 'admin.html', 'evidence.html', 'robots.txt', 'vercel.json'];

const findings = [];
const seen = new Set();
const flag = (file, line, what, why, text) => {
  const k = file + ':' + line + ':' + what;
  if (seen.has(k)) return;
  seen.add(k);
  findings.push({ file, line, what, why, text: String(text).trim().slice(0, 120) });
};

/* ------------------------------------------------------------------ *
 * THE SHAPES
 *
 * A pattern here is a shape, not a name. "Do not ship ANTHROPIC_API_KEY" is a
 * rule about one string; "do not ship a 95 character key beginning sk-ant" is
 * a rule about the thing itself.
 * ------------------------------------------------------------------ */
const CREDENTIAL = [
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/,            'an Anthropic key'],
  [/\bsk-[A-Za-z0-9]{32,}/,                  'a vendor secret key'],
  [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}/,    'a Clerk or Stripe secret key'],
  [/\bAKIA[0-9A-Z]{16}\b/,                   'an AWS access key id'],
  [/\bghp_[A-Za-z0-9]{30,}/,                 'a GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/,         'a Slack token'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./, 'a signed JSON web token'],
  [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s'"`]*:[^\s'"`@]+@/,
                                             'a connection string with a password in it'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/,     'a private key'],
  /* An assignment of a plausible secret to a name that says secret. The value
     has to look like one: a name alone is a comment, and this file is full of
     comments about keys. */
  [/\b(?:api[_-]?key|secret|password|passwd|token|bearer)\s*[:=]\s*["'`][A-Za-z0-9_\-+/=]{20,}["'`]/i,
                                             'a credential assigned inline'],
];

const INTERNAL = [
  [/\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?/i, 'a local address'],
  [/\bhttps?:\/\/(?:10|192\.168)\.\d{1,3}\.\d{1,3}\.\d{1,3}/,   'a private network address'],
  [/\bhttps?:\/\/[^\s'"`]*\.(?:internal|local|lan|corp)\b/i,    'an internal host'],
  [/\b[a-z0-9-]+\.(?:neon\.tech|rds\.amazonaws\.com|supabase\.co)\b/i, 'a database host'],
  [/\/(?:Users|home)\/[a-z][\w.-]*\//i,                         'a path from a build machine'],
  [/\bapi\.clerk\.com\/v1\/[a-z]+\/[A-Za-z0-9_]{8,}/,           'a Clerk record id'],
];

/* A route that was commented out rather than removed. It still documents the
   route to anybody reading the source, and it comes back the first time
   somebody uncomments it to test something. */
const DEAD_ROUTE =
  /^\s*(?:\/\/|\/\*|\*|<!--)\s*.{0,60}\b(?:fetch|axios)\s*\(\s*["'`]\/api\/[a-z0-9-]+/i;

const NOISE = [
  [/\bat\s+\w+\s+\([^)]*:\d+:\d+\)/,          'a stack frame'],
  [/\b(?:TODO|FIXME|HACK|XXX)\b\s*[:(-]/,     'an unfinished note'],
];

/* ------------------------------------------------------------------ *
 * THE ONE EXEMPTION, AND WHY IT IS NARROW
 *
 * These pages quote somebody else's record: a regulator's warning, a review, a
 * registry entry. That material can carry anything, including a string shaped
 * like a key, and it is not ours to edit. So a line is exempt only where it is
 * marked as attributed third-party content, on the line itself or the one
 * above, and the exemption covers the credential and noise shapes only. An
 * internal host is never somebody else's record.
 * ------------------------------------------------------------------ */
const ATTRIBUTED = /\bscanner:\s*attributed\b/i;

let scanned = 0;
for (const file of SERVED) {
  if (!fs.existsSync(file)) continue;
  scanned++;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    const n = i + 1;
    const exempt = ATTRIBUTED.test(text) || (i > 0 && ATTRIBUTED.test(lines[i - 1]));
    for (const [re, what] of CREDENTIAL)
      if (re.test(text) && !exempt) flag(file, n, what, 'credential', text);
    for (const [re, what] of INTERNAL)
      if (re.test(text)) flag(file, n, what, 'internal', text);
    if (DEAD_ROUTE.test(text)) flag(file, n, 'a commented-out call to an api route',
                                    'dead route', text);
    for (const [re, what] of NOISE)
      if (re.test(text) && !exempt) flag(file, n, what, 'noise', text);
  });
}

if (!scanned) {
  console.error('scanner FAIL\n  nothing was scanned, so this passed on an empty list');
  process.exit(1);
}

if (findings.length) {
  console.error('scanner FAIL  ' + findings.length + ' in ' + scanned + ' served files');
  for (const f of findings)
    console.error('  ' + f.file + ':' + f.line + '  ' + f.what + '  [' + f.why + ']\n'
                + '      ' + f.text);
  console.error('\nA line that quotes somebody else\'s record may carry any shape. Mark it '
    + '"scanner: attributed" on the line or the one above. That exemption does not '
    + 'cover an internal host.');
  process.exit(1);
}
console.log('scanner ok  ' + scanned + ' served files, no credential, internal host, '
  + 'dead route or build noise');
