/* THE MEASURE AND THE GUTTER, IN A REAL ENGINE.
 *
 * verify.mjs reads the stylesheet and can only prove what the rules say. This
 * one opens the page and measures what they did: how long a line actually is
 * once the font is loaded and the grid has resolved, and whether the waiting
 * screen and the report put their content edge in the same place.
 *
 * Both were wrong in ways the source could not show. The rows on sources and
 * method carried a max-width and still ran a hairline three hundred pixels past
 * the last word in them, because the cap was on the text and the border was on
 * the row. And the two screens each had a defensible gutter that happened not
 * to be the same gutter.
 */
import { chromium } from 'playwright';
const URL = 'file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fails = [];

/* ch is the advance width of "0". Measuring it once beats guessing at it. */
const CH = 'return (()=>{const s=document.createElement("span");' +
  's.textContent="0".repeat(100);s.style.cssText="position:absolute;visibility:hidden;white-space:pre";' +
  'document.body.appendChild(s);const w=s.getBoundingClientRect().width/100;' +
  'const fs=parseFloat(getComputedStyle(s).fontSize);s.remove();return w/fs;})()';

for (const vw of [1440, 1280]) {
  const p = await b.newPage({ viewport: { width: vw, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL);
  await p.waitForTimeout(700);
  const chEm = await p.evaluate(new Function(CH));

  /* ---- the gutter, across the handover ---- */
  await p.evaluate(() => window.__KBYS__.check('investhelm.com'));
  await p.waitForTimeout(900);
  const wait = await p.evaluate(() => {
    const r = document.querySelector('.waitprog').getBoundingClientRect();
    return { x: Math.round(r.x), w: Math.round(r.width) };
  });
  /* From the waiting screen, which is the pill that sits over it. The top
     nav's copy of it is behind the overlay and cannot be clicked. */
  await p.click('#waitSources');
  await p.waitForTimeout(700);
  /* The wrap's CONTENT box, not the header. The header on sources and method is
     deliberately narrower than the sheet, because that page is one 900px column
     top to bottom. What has to line up between the two stages is the column the
     gutter creates, which is the wrap. */
  const rep = await p.evaluate(() => {
    const e = document.querySelector('#rpSources .rp-wrap');
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const l = parseFloat(cs.paddingLeft), rr = parseFloat(cs.paddingRight);
    return { x: Math.round(r.x + l), w: Math.round(r.width - l - rr) };
  });
  /* Three pixels, and the reason is the panel. The report sits inside a sheet
     with a 1.5px border, so its column starts 1.5px in from where the waiting
     screen's does at any width narrow enough that the sheet is not centred.
     That is the border doing its job, and it is not the 49px slide this check
     exists to catch. */
  if (Math.abs(wait.x - rep.x) > 3 || Math.abs(wait.w - rep.w) > 3)
    fails.push(vw + ': the content edge moves between the wait and the report (' +
      wait.x + '/' + wait.w + ' against ' + rep.x + '/' + rep.w + ')');

  /* ---- the measure, on every run of prose on sources and method ---- */
  const long = await p.evaluate(chEm2 => {
    const out = [];
    const sel = '#rpSources p, #rpSources .rp-rv, #rpSources .rp-never span, #rpSources .rp-catc .rp-cx';
    for (const e of document.querySelectorAll(sel)) {
      const t = (e.textContent || '').trim();
      if (t.length < 80) continue;                    /* short runs cannot be too wide */
      const w = e.getBoundingClientRect().width;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      const ch = w / (fs * chEm2);
      if (ch > 78) out.push({ ch: Math.round(ch), t: t.slice(0, 46) });
    }
    return out;
  }, chEm);
  for (const l of long)
    fails.push(vw + ': a line runs ' + l.ch + ' characters wide: "' + l.t + '"');

  /* ---- and the rows end where the sentences in them end ---- */
  const slack = await p.evaluate(() => {
    let worst = null;
    for (const row of document.querySelectorAll('#rpSources .rp-row')) {
      const v = row.querySelector('.rp-rv'); if (!v) continue;
      /* the widest line inside the value, not the block, which is always full */
      const rng = document.createRange(); rng.selectNodeContents(v);
      const ink = [...rng.getClientRects()].reduce((m, r) => Math.max(m, r.right), 0);
      const gap = row.getBoundingClientRect().right - ink;
      if (!worst || gap > worst.gap) worst = { gap: Math.round(gap), k: row.querySelector('.rp-rk').textContent.trim() };
    }
    return worst;
  });
  if (slack && slack.gap > 90)
    fails.push(vw + ': a row draws its border ' + slack.gap + 'px past its longest line ("' + slack.k + '")');

  if (errs.length) fails.push(vw + ': page errors: ' + errs[0]);
  console.log(vw + ': gutter ' + wait.x + '/' + wait.w + ', longest run ' +
    (long.length ? long[0].ch + 'ch' : 'within measure') + ', widest row slack ' +
    (slack ? slack.gap + 'px' : 'n/a'));
  await p.close();
}

await b.close();
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
