/* NO FRAME SHOWS ITS OWN GROUND.
 *
 * Half a dozen blocks in this report are built the same way: a container
 * painted the border colour, a one or two pixel gap, and children painted the
 * surface, so the gaps read as hairlines. It is a good pattern and it fails the
 * same way every time. If the children do not cover the container, the border
 * colour shows through as a slab, and a slab of grey where content should be
 * reads as a panel that failed to load.
 *
 * It has happened three times now: four wrapper grids on sources and method,
 * and the figures row on the result screen, which had three fixed columns and,
 * for a party with a thin record, one figure to put in them. Nine hundred
 * pixels of exposed ground beside a single number.
 *
 * It has to be run against a SPARSE result as well as a full one, because that
 * is the only state in which most of these can fail.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fails = [];
const SCREENS = [
  ['result', null],
  ['found',  '#rpToFound'],
  ['act',    '#rpToAct'],
  ['sources','#rpToSources_act'],
];
for (const q of ['Goliath Ventures', 'atlanticglobalwealth.com', 'investhelm.com']) {
  for (const vw of [1440, 820]) {
    const p = await b.newPage({ viewport: { width: vw, height: 1000 } });
    await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
    await p.waitForTimeout(700);
    await p.evaluate(x => window.__KBYS__.check(x), q);
    await p.waitForTimeout(2600);
    for (let i = 0; i < 10; i++) {
      if (!await p.evaluate(() => document.getElementById('waitBox').classList.contains('on'))) break;
      await p.evaluate(() => { const x = document.getElementById('waitOk'); if (x && !x.disabled) x.click(); });
      await p.waitForTimeout(400);
    }
    await p.waitForTimeout(700);
    let found = 0;
    for (const [name, click] of SCREENS) {
      if (click) { await p.click(click).catch(() => {}); await p.waitForTimeout(500); }
      const slabs = await p.evaluate(() => {
        /* The variable is declared as a hex and the computed background comes
           back as rgb(), so a parser that only reads rgb() matched nothing and
           the check passed on every frame including the one it was written for. */
        const px = c => {
          c = String(c || '').trim();
          const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
          if (m) return [+m[1], +m[2], +m[3]];
          const h = c.match(/^#([0-9a-f]{6})$/i);
          if (h) return [parseInt(h[1].slice(0,2),16), parseInt(h[1].slice(2,4),16), parseInt(h[1].slice(4,6),16)];
          const h3 = c.match(/^#([0-9a-f]{3})$/i);
          if (h3) return h3[1].split('').map(x => parseInt(x + x, 16));
          return null;
        };
        const near = (a, bb) => a && bb && Math.abs(a[0]-bb[0]) + Math.abs(a[1]-bb[1]) + Math.abs(a[2]-bb[2]) < 14;
        const out = [];
        const sheet = [...document.querySelectorAll('#rpt .rp-sheet')].find(x => !x.hidden);
        if (!sheet) return out;
        /* --border is declared on the report scope, not on :root. Reading it off
           the document gave a colour nothing matched, so the check passed on
           everything including the slab it was written for. */
        const border = px(getComputedStyle(sheet).getPropertyValue('--border')) || [220,226,234];
        for (const e of sheet.querySelectorAll('*')) {
          const cs = getComputedStyle(e);
          if (cs.display === 'none' || !near(px(cs.backgroundColor), border)) continue;
          const r = e.getBoundingClientRect();
          if (r.width < 80 || r.height < 40 || !e.children.length) continue;
          let covered = 0;
          for (const k of e.children) {
            if (getComputedStyle(k).display === 'none') continue;
            const kr = k.getBoundingClientRect();
            covered += kr.width * kr.height;
          }
          const area = r.width * r.height, bare = area - covered;
          if (bare > area * 0.12 && bare > 8000)
            out.push((e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0]) +
              ' shows ' + Math.round(bare / 1000) + 'k square pixels of its own ground' +
              ' (' + Math.round(r.width) + 'x' + Math.round(r.height) + ', ' + e.children.length + ' children)');
        }
        return out;
      });
      for (const sl of slabs) { fails.push(q + ' @' + vw + ' on ' + name + ': ' + sl); found++; }
    }
    console.log(q.padEnd(26) + vw + '  ' + (found ? found + ' EXPOSED' : 'every frame covered'));
    await p.close();
  }
}
await b.close();
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
