/* THE PHONE CONTRACT.
 *
 * The site was unusable on a phone and every other test passed while it was.
 * They all drive a desktop viewport, or they drive the page programmatically,
 * which is how a search bar two hundred and fifty points below the fold and a
 * classifier that refused the demo company both survived a full suite.
 *
 * This one is a phone, with touch, and it asserts the four things that were
 * actually broken.
 */
import { chromium, devices } from 'playwright';

const PHONES = ['iPhone 13', 'iPhone SE', 'Pixel 5'];
const fails = [];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const name of PHONES) {
  const ctx = await b.newContext({ ...devices[name] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await p.goto('file://' + process.cwd() + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);

  const m = await p.evaluate(() => {
    const R = s => document.querySelector(s).getBoundingClientRect();
    const bar = R('.searchbox'), nav = R('.nav'), h1 = R('.cbh1');
    const i = document.getElementById('kbInput');
    const c = document.createElement('canvas').getContext('2d');
    const st = getComputedStyle(i);
    c.font = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily;
    return {
      vh: window.innerHeight,
      barBottom: Math.round(bar.bottom),
      h1Top: Math.round(h1.top), navBottom: Math.round(nav.bottom),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      hint: i.placeholder,
      hintW: Math.round(c.measureText(i.placeholder).width),
      fieldW: Math.round(i.getBoundingClientRect().width),
      goH: Math.round(document.getElementById('kbGo').getBoundingClientRect().height)
    };
  });

  /* 1. THE ONE CONTROL IS ON THE FIRST SCREEN.
     Not its top edge: the whole bar, because a reader who can see half a
     control below a wall of copy does not know it is a control. */
  if (m.barBottom > m.vh)
    fails.push(name + ': the search bar ends ' + (m.barBottom - m.vh)
      + 'px below the fold, so the page opens with nothing to operate');

  /* 2. NOTHING PASSES BEHIND THE FIXED NAV. */
  if (m.h1Top < m.navBottom)
    fails.push(name + ': the headline starts at ' + m.h1Top + ' and the nav ends at '
      + m.navBottom + ', so they overlap');

  /* 3. NO SIDEWAYS SCROLL. */
  if (m.overflowX > 0)
    fails.push(name + ': the page scrolls sideways by ' + m.overflowX + 'px');

  /* 4. THE HINT IS NOT CUT MID WORD.
     It read "Company, website or w" at 390 points. A hint cut mid word tells a
     reader less than no hint. */
  if (m.hintW > m.fieldW)
    fails.push(name + ': the placeholder needs ' + m.hintW + 'px in a ' + m.fieldW
      + 'px field, so it renders cut off: "' + m.hint + '"');

  /* 5. A THUMB CAN HIT IT. */
  if (m.goH < 40)
    fails.push(name + ': the check button is ' + m.goH + 'px tall, under the 40px touch floor');

  /* 6. AN ORDINARY COMPANY NAME IS NOT REFUSED AS A PERSON.
     Two capitalised words is the shape of most small companies in this country
     and the gate refused every one of them, including the demo party. */
  const refused = await p.evaluate(() => {
    const i = document.getElementById('kbInput');
    const out = {};
    for (const n of ['Goliath Ventures', 'Apex Capital', 'Riverstone Partners', 'Delgado Holdings']) {
      i.value = n; i.dispatchEvent(new Event('input', { bubbles: true }));
      out[n] = !!document.getElementById('kbGo').disabled;
    }
    /* and a real person's name must still be refused */
    i.value = 'John Smith'; i.dispatchEvent(new Event('input', { bubbles: true }));
    out['John Smith'] = !!document.getElementById('kbGo').disabled;
    return out;
  });
  for (const [n, blocked] of Object.entries(refused)) {
    if (n === 'John Smith') {
      if (!blocked) fails.push(name + ': a person\'s name is no longer refused');
    } else if (blocked) {
      fails.push(name + ': "' + n + '" is refused as a person\'s name');
    }
  }

  /* 7. THE FLOW RUNS FROM A THUMB. */
  await p.evaluate(() => {
    const i = document.getElementById('kbInput');
    i.value = 'Goliath Ventures'; i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  try {
    await p.tap('#kbGo');
    await p.waitForTimeout(2200);
    const on = await p.evaluate(() => document.body.getAttribute('data-chat'));
    if (on !== 'on') fails.push(name + ': tapping check did not open the thread');
  } catch (e) {
    fails.push(name + ': the check button could not be tapped: ' + String(e.message).slice(0, 80));
  }

  if (errs.length) fails.push(name + ': ' + errs.length + ' page error(s): ' + errs[0]);
  console.log(name.padEnd(11), 'bar ends', String(m.barBottom).padStart(4), 'of', m.vh,
    '| hint', String(m.hintW).padStart(3) + '/' + m.fieldW, '| overflow', m.overflowX);
  await ctx.close();
}
await b.close();
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
