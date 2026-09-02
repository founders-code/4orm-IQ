/* NOTHING ON THE WAITING SCREEN MAY MOVE WHILE A CHECK RUNS.
 *
 * "The page loads weird on the thinking page, and during the process it reloads
 * and resizes." That is one symptom with many causes, and each cause is one
 * element that changes size when something on the screen changes length. This
 * is the list of them.
 *
 * The earlier version of this file passed while three of those causes were
 * still live, and it is worth saying exactly how, because the same three holes
 * are easy to reopen:
 *
 *   1. It keyed elements by id or class and threw away everything that had
 *      neither, under the names SPAN and DIV. .waitprog and .waitmeta HAVE
 *      classes, but their unnamed children did not, and the row that actually
 *      changed height was never measured. Keys are now the DOM path, so every
 *      element is its own key and nothing is discarded.
 *   2. It only ran at four desktop widths. Every remaining defect was a phone
 *      defect: a status line that is one line at 1440 and two at 390 takes
 *      sixteen pixels out of the network below it. Mobile widths are in.
 *   3. It clicked education dots instead of watching a real run, so it never
 *      saw the phase label change, the counter disappear, the button relabel or
 *      the handover to the report. It now samples a real run frame by frame AND
 *      walks the deck.
 */
import { chromium } from 'playwright';
const BROWSER = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const URL = 'file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1';
const VIEWPORTS = [[1440,900],[1366,768],[1280,800],[1680,1050],[414,896],[390,844],[360,780]];

/* One key per element, by its position in the tree, so an element with no id
   and no class is still its own row and cannot be silently dropped.
 *
 * The walk STOPS at the boxes that reserve their own height. That is not a way
 * of excusing them: it is what reserving a height MEANS. #eduCard is measured
 * to the tallest of the sixteen cards and holds that, so its contents are
 * supposed to be different lengths and nothing below it can feel the
 * difference. Measuring the text inside it would report the deck working as a
 * layout fault. What must not change is the reserved box itself, and that is
 * exactly what is measured here. Every one of these has a min-height or a
 * nowrap rule in the stylesheet put there for this reason. */
const RESERVED = ['eduCard', 'eduDots', 'netCap', 'netSvg', 'waitPhase', 'waitFine', 'waitOk'];
const CENSUS = `(() => {
  const RESERVED = ${JSON.stringify(['eduCard','eduDots','netCap','netSvg','waitPhase','waitFine','waitOk'])};
  const o = {};
  const path = el => {
    const parts = [];
    for (let n = el; n && n.id !== 'waitBox'; n = n.parentElement) {
      const i = n.parentElement ? [...n.parentElement.children].indexOf(n) : 0;
      parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') +
        (n.className && typeof n.className === 'string'
          ? '.' + n.className.trim().split(/\\s+/).slice(0,2).join('.') : '') + ':' + i);
    }
    return parts.join(' > ');
  };
  const walk = el => {
    if (!el || el.nodeType !== 1) return;
    const r = el.getBoundingClientRect();
    if (r.height > 0 || RESERVED.indexOf(el.id) > -1) o[path(el)] = [r.height, r.width];
    /* A reserved box, or the class-reserved counter slot, is a leaf. */
    if (RESERVED.indexOf(el.id) > -1) return;
    if (el.classList && el.classList.contains('waitslot')) return;
    [...el.children].forEach(walk);
  };
  walk(document.getElementById('waitBox'));
  /* The bar is the one thing on this screen whose whole job is to change. */
  for (const k of Object.keys(o)) if (/#waitBar/.test(k)) delete o[k];
  return o;
})()`;

let bad = 0;
for (const [w, h] of VIEWPORTS) {
  const p = await b_page(w, h);
  /* A pixel of tolerance, and no more. Sub-pixel layout rounds a 8.4px dot to
     8 or 9 depending on where the row happens to start, and that is the
     renderer, not the page moving. Two pixels is a thing a reader can see. */
  const seen = {};
  const note = (k, h, w) => {
    const r = seen[k] || (seen[k] = { hMin: h, hMax: h, wMin: w, wMax: w });
    r.hMin = Math.min(r.hMin, h); r.hMax = Math.max(r.hMax, h);
    r.wMin = Math.min(r.wMin, w); r.wMax = Math.max(r.wMax, w);
  };

  /* ---- a real run, sampled continuously from before the overlay opens ---- */
  await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
  for (let t = 0; t < 42; t++) {                     /* ~6.3s, past the finish */
    await p.waitForTimeout(150);
    const r = await p.evaluate(new Function('return ' + CENSUS));
    for (const k in r) note(k, r[k][0], r[k][1]);
    /* Once the overlay is gone there is nothing left to measure. */
    const open = await p.evaluate(() => {
      const b = document.getElementById('waitBox');
      return !!b && b.classList.contains('on');
    });
    if (!open && t > 6) break;
  }

  /* ---- and the whole deck, which a reader can walk at any moment ---- */
  await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
  await p.waitForTimeout(1200);
  const dots = await p.evaluate(() => document.querySelectorAll('#eduDots button').length);
  for (let i = 0; i < dots; i++) {
    await p.evaluate(n => document.querySelectorAll('#eduDots button')[n].click(), i);
    await p.waitForTimeout(220);
    const r = await p.evaluate(new Function('return ' + CENSUS));
    for (const k in r) note(k, r[k][0], r[k][1]);
  }

  /* An element that appears part way through a run was never there to move.
     Only something measured on more than one sample, at more than one size,
     is a thing that changed under the reader. */
  const moved = Object.keys(seen).filter(k =>
    seen[k].hMax - seen[k].hMin > 1 || seen[k].wMax - seen[k].wMin > 1);
  console.log(w + 'x' + h + ': ' + (moved.length ? 'MOVES' : 'stable') +
    '  (' + Object.keys(seen).length + ' elements watched)');
  moved.forEach(k => { const r = seen[k];
    console.log('   ' + k + '\n       height ' + r.hMin.toFixed(1) + ' to ' + r.hMax.toFixed(1) +
      ', width ' + r.wMin.toFixed(1) + ' to ' + r.wMax.toFixed(1)); });
  bad += moved.length;
  await p.close();
}
await BROWSER.close();
if (bad) { console.error('\nFAIL: ' + bad + ' elements change size while the check runs'); process.exit(1); }
console.log('\nPASSED');

/* ------------------------------------------------------------------------- */
async function b_page(w, h) {
  const p = await BROWSER.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => { console.error('   page error: ' + e); bad++; });
  await p.goto(URL);
  await p.waitForTimeout(800);
  return p;
}
