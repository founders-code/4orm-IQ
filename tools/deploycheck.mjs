/* ===================================== WHAT WOULD ACTUALLY LEAVE THIS REPO
   CR-0013 found a second copy of the application being served at a public URL,
   and its fourth open item asked for a build gate that fails when something
   internal appears outside the ignored directories. This is that gate, and it
   is wider than the item asked for, because the fault recurred in a form the
   item would not have caught: nothing was outside the ignored directories.
   docs/ was ignored, and admin.html, which embeds the whole change register at
   build time, was not. The register was excluded as a file and deployed as
   text.

   So this does not ask what is in the repository. It computes what Vercel
   would SEND and reads those bytes.

   Three rules:
     1  No page that would be sent may carry an internal record.
     2  No deck, archive or document may be sent.
     3  tools/scanner.mjs must scan every page that would be sent. Its list was
        hand written and had drifted to five of nine, so the consumer console
        was never scanned for credentials. A hand written list of served files
        is the same fault as a hand written register count: it is a number
        somebody typed. This makes the drift fail the build.

   Run by npm test. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deployed } from './_deployed.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fails = [];
const say = (ok, line) => console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + line);

const { files: sent, pages, unreadable } = deployed(root);
if (unreadable.length) fails.push('.vercelignore holds a pattern this gate cannot read, so it '
  + 'cannot tell you what is deployed: ' + unreadable.join(', '));

/* 1. An internal record on a page that would be sent.

   Each marker is a phrase that exists only in an internal record, and each one
   is the actual text of something that was served: the release posture, the
   embedded change register, a still-open remediation item, and a control
   document that carries a NO-GO on its own cover. */
const MARKERS = [
  ['NOT READY FOR UNCONDITIONAL', 'the release posture'],
  ['var AUDIT = ',                'the embedded change register'],
  ['Rotate any credential',       'an open remediation item from CR-0013'],
  ['records a NO-GO on its own cover', 'a control document carrying a NO-GO']
];
let dirty = 0;
for (const n of pages) {
  const src = fs.readFileSync(path.join(root, n), 'utf8');
  for (const [m, what] of MARKERS) if (src.includes(m)) {
    fails.push(n + ' would be deployed and it carries ' + what + ' ("' + m.trim() + '")');
    dirty++;
  }
}
say(!dirty, 'no page that would be sent carries an internal record');

/* 2. A deck, an archive or a document that would be sent. */
const NEVER = ['.pdf', '.pptx', '.docx', '.xlsx', '.zip', '.tar', '.gz', '.key', '.pem', '.sql'];
const leaked = sent.filter(n => NEVER.includes(path.extname(n).toLowerCase()));
leaked.forEach(n => fails.push(n + ' would be deployed, and a ' + path.extname(n)
  + ' is never a web page'));
say(!leaked.length, 'no deck, archive or document would be sent');

/* 3. The scanner must not hand write what it scans.

   The earlier version of this rule compared the scanner's list against the
   deployed set. Both now derive from tools/_deployed.mjs, so they cannot
   disagree, and the rule that matters is the one that keeps it that way: a
   typed list is what drifted to five names of nine. */
const scn = fs.readFileSync(path.join(root, 'tools/scanner.mjs'), 'utf8');
const derives = /from '\.\/_deployed\.mjs'/.test(scn);
const typedList = /const SERVED = \[\s*'[^']+\.html'/.test(scn);
if (!derives)
  fails.push('tools/scanner.mjs does not read tools/_deployed.mjs, so what it scans is '
    + 'no longer tied to what is deployed');
if (typedList)
  fails.push('tools/scanner.mjs declares a typed list of pages again, which is the drift '
    + 'this gate exists to stop');
say(derives && !typedList, 'the scanner computes what it scans from .vercelignore');

/* And this gate must not be the only thing standing between the back office
   and the open web. If admin.html is deployed again, say what has to be true
   first, rather than only that it is deployed. */
if (pages.includes('admin.html'))
  fails.push('admin.html is deployed. It embeds the change register and the control '
    + 'standards, and its Clerk check is client-side, so the bytes are sent before '
    + 'anything asks who is asking. Vercel Deployment Protection has to be on, or the '
    + 'register has to come from /api/audit, before this page is served.');

console.log('');
if (fails.length) {
  console.log('deploycheck FAILED');
  fails.forEach(f => console.log('  ' + f));
  process.exit(1);
}
console.log('deploycheck ok  ' + sent.length + ' files would be sent, '
  + pages.length + ' of them pages, none carrying an internal record');
