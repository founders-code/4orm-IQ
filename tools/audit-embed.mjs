/**
 * Embeds docs/change-register.json into admin.html between the two markers.
 *
 * The register is embedded rather than fetched for the same two reasons the
 * control documents are: the panel sits behind the gate and these are internal
 * records, so the text must never be a URL that can be requested without it;
 * and the panel has to read the same when it is opened as a file, which a fetch
 * of a relative path cannot do.
 *
 *   node tools/audit-embed.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const OPEN  = '/* AUDIT-REGISTER-START */';
const CLOSE = '/* AUDIT-REGISTER-END */';

const reg  = JSON.parse(readFileSync('docs/change-register.json', 'utf8'));
let html   = readFileSync('admin.html', 'utf8');

const i = html.indexOf(OPEN), j = html.indexOf(CLOSE);
if (i < 0 || j < 0) { console.error('audit-embed: markers not found in admin.html'); process.exit(1); }

const body = OPEN + '\nvar AUDIT = ' + JSON.stringify(reg) + ';\n';
html = html.slice(0, i) + body + html.slice(j);
writeFileSync('admin.html', html);
console.log('audit-embed: ' + reg.entries.length + ' entries embedded');
