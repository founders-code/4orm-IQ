/* ========================================= WHAT VERCEL WOULD ACTUALLY SEND
   One answer to that question, computed from .vercelignore, used by every tool
   that needs it. It exists because two tools answered it from hand written
   lists and both were wrong: tools/scanner.mjs scanned five pages of nine, so
   the consumer console was never checked for a credential, and .vercelignore
   excluded the change register as a file while admin.html shipped it as
   embedded text.

   A list of served files that somebody types is the same fault as a register
   count that somebody types. The repository already has a rule about the
   second one. This is the first one. */
import fs from 'fs';
import path from 'path';

/* Only the forms .vercelignore actually uses are implemented. An unreadable
   pattern is RETURNED rather than ignored, because a gate that quietly treats
   a pattern it cannot parse as matching nothing reports a clean deploy it has
   not checked. */
export function deployed(root) {
  const lines = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8')
    .split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));

  const dir  = new Set();
  const ext  = new Set();
  const file = new Set();
  const unreadable = [];
  for (const p of lines) {
    if (/^[\w.@-]+\/$/.test(p))      dir.add(p.slice(0, -1));
    else if (/^\*\.[\w]+$/.test(p))  ext.add(p.slice(1));
    else if (/^\.?[\w.@-]+\.\*$/.test(p)) file.add(p);   /* .env.* */
    else if (/^[\w.@-]+$/.test(p) || /^\.[\w.@-]+$/.test(p)) file.add(p);
    else unreadable.push(p);
  }

  const prefixGlob = [...file].filter(p => p.endsWith('.*')).map(p => p.slice(0, -1));
  const names = fs.readdirSync(root, { withFileTypes: true })
    .filter(d => d.isFile()).map(d => d.name)
    .filter(n => !file.has(n)
              && !prefixGlob.some(pre => n.startsWith(pre))
              && !ext.has(path.extname(n))
              && !n.startsWith('.'));

  return { files: names, pages: names.filter(n => n.endsWith('.html')),
           ignoredDirs: [...dir], unreadable };
}
