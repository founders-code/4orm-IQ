/* ============================ THE SPEND PILL AND THE SPEND READER, PROVED
   Two halves. The route has to serve the block, and the board has to draw it
   without inventing anything. Every test here fails if its half is reverted.

   The rule under all of them: a measurement and a ceiling are different things
   and the screen must never let one stand in for the other. */
import fs from 'fs';
import { chromium } from 'playwright';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* ---- 1. The route serves it, and reads the measured tables -------------- */
{
  const src = fs.readFileSync('api/admin-metrics.js', 'utf8');
  ok(/spend:\s*await spendBlock\(/.test(src),
     'admin-metrics no longer serves a spend block');
  ok(/from '\.\/_budget\.js'/.test(src),
     'the spend block no longer reads its ceilings from the one budget module');
  ok(/from runs where/.test(src),
     'the spend block no longer measures anything off the runs table');
  ok(/rateCard\(\)/.test(src),
     'the spend block no longer says what its dollars are priced from');
  /* It must survive a database that has neither table. */
  ok((src.match(/catch \{ measured = \{ present: false \} /) || []).length
     + (src.match(/present: false/g) || []).length >= 2,
     'the spend block no longer degrades to present:false when a table is absent');
  /* And it must not have grown a second door. */
  ok(!fs.existsSync('api/admin-spend.js'),
     'a second admin route appeared for spend; it belongs behind the one auth path');
}

/* ---- 2. The board draws it, and never invents a number ----------------- */
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/admin.html?demo=1');
  await p.waitForTimeout(800);

  const pill = await p.evaluate(() => {
    const e = document.getElementById('spendbtn');
    if (!e) return null;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const row = document.getElementById('rdPills');
    return { text: e.textContent.trim(), aria: e.getAttribute('aria-label'),
             inRow: !!row && row.contains(e), w: r.width, h: r.height,
             colour: cs.color, tag: e.tagName };
  });
  ok(pill, 'the spend pill is gone from the control room');
  if (!pill) {
    console.error('spendcheck FAIL\n  ' + fails.join('\n  '));
    await b.close(); process.exit(1);
  }
  {
    ok(pill.inRow, 'the spend pill is no longer on the reader pill row');
    ok(pill.tag === 'BUTTON', 'the spend pill is not a button, so a keyboard cannot reach it');
    ok(/\$/.test(pill.text), 'the spend pill carries no money figure: ' + pill.text);
    ok(/ceiling/.test(pill.aria || ''),
       'the spend pill tells a screen reader a number with nothing to read it against');
    ok(pill.h >= 22 && pill.w >= 60, 'the spend pill is too small to hit');
  }

  /* It opens, it closes on Escape, and Escape closes it before the board. */
  await p.click('#spendbtn'); await p.waitForTimeout(350);
  let on = await p.evaluate(() => document.getElementById('spendsheet').classList.contains('on'));
  ok(on, 'pressing the spend pill does not open the reader');

  const read = await p.evaluate(() => {
    const body = document.getElementById('spB');
    const cells = [...body.querySelectorAll('.spcell')].map(c => ({
      label: c.querySelector('em').textContent.trim(),
      value: c.querySelector('b').textContent.trim(),
      sub: (c.querySelector('s') || {}).textContent || '' }));
    return { cells, secs: [...body.querySelectorAll('.spsec h4')].map(h => h.textContent.trim()),
             note: (body.querySelector('.spnote') || {}).textContent || '',
             noteGood: !!body.querySelector('.spnote.good'),
             overflow: body.scrollWidth > body.clientWidth + 1,
             text: body.textContent };
  });
  const need = ['Today', 'The ceiling'];
  for (const n of need)
    ok(read.secs.some(s => s.startsWith(n)), `the spend reader lost its "${n}" band`);
  ok(read.secs.some(s => /What one check costs/.test(s)),
     'the spend reader no longer says what one check costs');
  ok(read.cells.length >= 12,
     `the spend reader is down to ${read.cells.length} figures; it carried twenty`);
  ok(!read.overflow, 'the spend reader overflows sideways');

  /* THE ONE THAT MATTERS. Where the Claude rate is a default rather than the
     invoice, the screen must say so before any dollar is read. */
  ok(/KBYS_RATE_CLAUDE_IN_M/.test(read.note) || read.noteGood,
     'the spend reader prints dollars without saying what they are priced from');

  /* Averages are stated with a spread beside them. An average alone hides the
     run that cost four times the rest, and hiding it is how a bill surprises
     somebody. */
  /* The labels are upper-cased by the stylesheet, not in the markup. */
  const labels = read.cells.map(c => c.label.toUpperCase());
  for (const l of ['AVERAGE', 'MEDIAN', 'NINTH IN TEN', 'DEAREST'])
    ok(labels.includes(l), `the spend reader lost the "${l}" figure, so the average stands alone`);

  /* Tokens are reported, which is what was asked for. */
  ok(labels.includes('TOKENS IN') && labels.includes('TOKENS OUT') &&
     labels.includes('TOKENS TODAY'),
     'the spend reader no longer reports token spend');

  /* The ceiling is labelled as a ceiling, never printed as if it were spend. */
  const house = read.cells.find(c => c.label.toUpperCase() === 'HOUSE CEILING');
  ok(house && /day/.test(house.sub),
     'the house ceiling is printed without saying it is a ceiling for the day');

  /* No figure is drawn as a fault colour just for being money. */
  const red = await p.evaluate(() => [...document.querySelectorAll('#spB .spcell b.high')]
    .map(e => e.previousElementSibling.textContent.trim().toUpperCase()));
  ok(!red.includes('SPENT TODAY'),
     'spending money is being drawn as a fault, which it is not');

  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  on = await p.evaluate(() => document.getElementById('spendsheet').classList.contains('on'));
  ok(!on, 'Escape does not close the spend reader');

  ok(errs.length === 0, 'page errors: ' + errs.join(' | '));
} finally { await b.close(); }

if (fails.length) { console.error('spendcheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('spendcheck ok  pill on the reader row, four bands, the rate card stated');
