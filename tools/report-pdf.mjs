/* A control document, rendered. Chad keeps these, so every one of them ships as
   the page and as a file: the page to read now, the file to put somewhere it
   will still be in a year. Dark ground, colour preserved, Letter. */
import { chromium } from 'playwright';
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node tools/report-pdf.mjs <in.html> <out.pdf>'); process.exit(1); }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.emulateMedia({ media: 'print', colorScheme: 'dark' });
await p.goto('file://' + src, { waitUntil: 'networkidle' }).catch(() => p.goto('file://' + src));
await p.waitForTimeout(1200);
/* THE GROUND GOES TO THE EDGE.
   A page margin is outside the document box, so a dark document printed with
   margins comes out as a dark panel floating on white paper, which is not the
   house look and reads as a rendering fault. So the sheet has no side or top
   margin and the gutter is the body's own padding, which is inside the box and
   therefore painted. The foot keeps a margin because the page number lives
   there, and the footer template paints that strip itself. */
await p.pdf({ path: out, format: 'Letter', printBackground: true,
  margin: { top: '0', bottom: '13mm', left: '0', right: '0' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;height:13mm;margin:0;background:#111416;'
    + 'font:8px IBM Plex Mono,monospace;color:#8B9296;letter-spacing:.06em;'
    + 'display:flex;align-items:center;justify-content:space-between;'
    + 'box-sizing:border-box;padding:0 14mm">'
    + '<span>4ORM FINANCE &middot; INTERNAL</span>'
    + '<span>PAGE <span class="pageNumber"></span> OF <span class="totalPages"></span></span></div>' });
await b.close();
console.log('written ' + out);
