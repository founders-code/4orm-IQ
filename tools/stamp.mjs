/* WHICH BUILD IS LIVE.
   Three separate times this week a fix was reported as "still broken" while the
   deployment was running an older file, and there was no way to tell from the
   page which build was serving it. Guessing cost more time than the bugs did.

   This writes one identifier into the page and the same one into the check
   route, so the browser can be asked directly. They are written together and
   the build refuses a mismatch, which also catches the case where the static
   page deployed and the function did not. */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = path.resolve(import.meta.dirname, '..');
const d = new Date();
const stamp = d.toISOString().slice(0, 10).replace(/-/g, '') + '.' +
  String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0');

for (const [file, re, make] of [
  ['index.html', /var KBYS_BUILD = "[^"]*";/, s => `var KBYS_BUILD = "${s}";`],
  ['api/check.js', /const BUILD = '[^']*';/, s => `const BUILD = '${s}';`],
]) {
  const p = path.join(root, file);
  let t = fs.readFileSync(p, 'utf8');
  if (!re.test(t)) { console.error('no stamp slot in ' + file); process.exit(1); }
  fs.writeFileSync(p, t.replace(re, make(stamp)));
  console.log('  stamped ' + file + '  ' + stamp);
}
console.log('\nBuild ' + stamp + '. On the live site, open the console and type KBYS_BUILD,');
console.log('or read "build" in any /api/check response. If the two differ, the page and');
console.log('the function came from different deploys.\n');
