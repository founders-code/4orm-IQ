/* THE DOOR TO THE DATA ROOM, AND THE TICKER ON THE LANDING.
   Two things a reader meets without having asked for them, so both are held to
   the same rule: say what this is, and let them choose. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(1100);
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

/* ------------------------------------------------------------- the ticker */
{
  const t = await p.evaluate(() => {
    const rail = document.getElementById('tickRail');
    const items = [...rail.querySelectorAll('.tickrun')][0].querySelectorAll('.tickit');
    return {
      count: items.length,
      /* Every line carries a figure and the body that published it. */
      sourced: [...items].every(i => i.querySelector('.tickv') && i.querySelector('.ticks')
        && i.querySelector('.ticks').textContent.trim().length > 3),
      doubled: rail.querySelectorAll('.tickrun').length === 2,
      dur: getComputedStyle(rail).animationDuration,
      /* It sits under the line that says whose product this is, and above the
         standing documents, so a reader scrolls a touch to reach them. */
      order: (() => {
        const y = q => { const e = document.querySelector(q);
          return e ? Math.round(e.getBoundingClientRect().top + window.scrollY) : null; };
        return { tie: y('.tielink'), tick: y('#tickRow'), docs: y('.docrow') };
      })()
    };
  });
  if (t.count < 6) fail('the ticker carries only ' + t.count + ' lines');
  if (!t.sourced) fail('a line on the ticker carries no source');
  if (!t.doubled) fail('the ticker is not doubled, so the loop has a gap in it');
  /* Two durations now, because the rail comes in from off the right edge
     before it loops: the entrance, then the loop. The entrance is short by
     design, it covers one screen width, so the loop is the one measured for
     whether a sentence can be finished. */
  const durs = String(t.dur).split(',').map(x => parseFloat(x));
  const loop = Math.max.apply(null, durs);
  if (durs.length < 2) fail('the ticker no longer starts off the right edge: one animation, ' + t.dur);
  if (loop < 20) fail('the ticker loops in ' + loop + 's, too fast to read');
  const o = t.order;
  for (const k of Object.keys(o)) if (o[k] === null) fail('the landing is missing ' + k);
  if (!(o.tie < o.tick && o.tick < o.docs))
    fail('the landing reads in the wrong order: ' + JSON.stringify(o));
  console.log('ticker: ' + t.count + ' sourced lines, ' + t.dur + ' a lap, under the tie line');
}

/* --------------------------------------------------------- the data room */
await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(400);
await p.evaluate(() => { const b = document.getElementById('primOk'); if (b && !b.disabled) b.click(); });
/* The run has to be finished: the report lands by changing the stage, and a
   room opened mid-run is closed again by the arriving result. */
await p.waitForTimeout(5200);
await p.evaluate(() => document.getElementById('rpOpenRecordR').click());
await p.waitForTimeout(1500);

const door = await p.evaluate(() => ({
  up: document.getElementById('roomBox').classList.contains('on'),
  title: (document.getElementById('roomT') || { textContent: '' }).textContent.trim(),
  lines: document.querySelectorAll('#roomBox .primsteps li').length,
  tour: (document.getElementById('roomTour') || {}).textContent,
  self: (document.getElementById('roomSelf') || {}).textContent,
  focus: document.activeElement && document.activeElement.id,
  walking: !document.getElementById('wk').hidden
}));
if (!door.up) fail('the data room opens with no word about what it is');
if (door.lines < 3) fail('the door says ' + door.lines + ' things about the room');
if (!door.tour || !door.self) fail('the door does not offer both ways in');
if (door.focus !== 'roomTour') fail('focus is on ' + door.focus + ', not on a way forward');
/* THE TOUR IS OFFERED, NOT STARTED. */
if (door.walking) fail('the walkthrough started itself before anybody asked for it');

await p.evaluate(() => document.getElementById('roomTour').click());
await p.waitForTimeout(900);
{
  const after = await p.evaluate(() => ({
    up: document.getElementById('roomBox').classList.contains('on'),
    walking: !document.getElementById('wk').hidden,
    off: !!document.getElementById('roomTour').disabled
  }));
  if (after.up) fail('the door stays up after it has been answered');
  if (!after.walking) fail('asking for the tour does not start it');
  if (!after.off) fail('the door buttons are still focusable after the card has gone');
}

/* And the reader who chose the tour is not asked again on the way back in. */
await p.evaluate(() => document.getElementById('navBackReport').click());
await p.waitForTimeout(600);
await p.evaluate(() => document.getElementById('rpOpenRecordR').click());
await p.waitForTimeout(1200);
{
  const again = await p.evaluate(() => document.getElementById('roomBox').classList.contains('on'));
  if (again) fail('the door asks again every time the room is opened');
}

if (errs.length) { console.error(errs.join('\n')); fail(errs.length + ' page errors'); }
console.log('data room: says what it is, offers the tour, starts it on request, asks once');
console.log('\nPASSED');
await b.close();
