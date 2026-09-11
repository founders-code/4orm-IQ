/* THE REPORT IS FOUR SCREENS, WALKED THE WAY A READER WALKS IT.
   Forward on the green pills, back on the back buttons, and out to sources and
   method from every one of them. The bug this replaces: back from the findings
   screen landed on the findings screen, because one back button was routed
   through the logic that decides where the SOURCES screen goes back to. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);

const fail = m => { console.error('FAIL: ' + m); process.exit(1); };
const up = () => p.evaluate(() => [...document.querySelectorAll('#rpt .rp-sheet')]
  .filter(s => !s.hidden).map(s => s.id));
const stage = () => p.evaluate(() => document.body.getAttribute('data-stage'));
const one = async (want, where) => {
  const u = await up();
  if (u.length !== 1) fail(where + ': ' + u.length + ' report screens are showing at once (' + u.join(', ') + ')');
  if (u[0] !== want) fail(where + ': showing ' + u[0] + ', expected ' + want);
};

/* NOTHING INVISIBLE MAY BE CLICKABLE.
   The waiting overlay is fixed at inset:0 and sits over the whole landing when
   it is closed. A control inside it that keeps pointer events swallows every
   click meant for the page underneath, and the page looks broken rather than
   wrong. */
{
  const dead = await p.evaluate(() => {
    const box = document.getElementById('waitBox');
    if (box.classList.contains('on')) return ['the waiting overlay is open on the landing'];
    return [...box.querySelectorAll('button,a,input,summary')]
      .filter(e => getComputedStyle(e).pointerEvents !== 'none')
      .map(e => e.id || e.className || e.tagName);
  });
  if (dead.length) fail('these live inside the closed waiting overlay and will swallow clicks on the landing: ' + dead.join(', '));
}

/* Sources and method, from the landing, where there is no result behind it. */
await p.click('#navSources'); await p.waitForTimeout(400);
await one('rpSources', 'sources from the landing');
/* The point is that it must not offer a report that was never run. The label
   itself moved from a bare "Back" to naming its destination, which is the
   improvement, so this asserts the property rather than the old string. */
{
  const t = (await p.textContent('#rpBackToReportT')).trim();
  if (/report|what we found|what to do|data room/i.test(t))
    fail('the way out of sources offers to go back to a report that does not exist yet, it says: ' + t);
  if (!/^Back/i.test(t))
    fail('the way out of sources no longer reads as a way back, it says: ' + t);
}
await p.click('#rpBackToReport'); await p.waitForTimeout(400);
if (await stage() !== 'landing') fail('back from sources did not return to the landing');

await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(3000);
for (let i = 0; i < 6; i++) {
  if (!await p.evaluate(() => document.getElementById('waitBox').classList.contains('on'))) break;
  await p.click('#waitOk'); await p.waitForTimeout(500);
}
await p.waitForTimeout(1000);
await one('rpReport', 'a finished check');

/* Sources and method is reachable from every screen. Find support is too, but
   on the act screen it is row 05 of the things to do rather than a pill beside
   the way back, because it is not navigation: it is the last thing on the list.
   So the assertion is that the reader can always reach support, not that it is
   always drawn the same way. */
const pillPair = async where => {
  const n = await p.evaluate(() => {
    const s = [...document.querySelectorAll('#rpt .rp-sheet')].find(x => !x.hidden);
    const t = [...s.querySelectorAll('.rp-nav .rp-pill')].map(e => e.textContent.trim());
    return t;
  });
  if (!n.some(t => /Sources and method/.test(t))) fail(where + ' has no sources and method pill');
  const support = await p.evaluate(() => {
    const s = [...document.querySelectorAll('#rpt .rp-sheet')].find(x => !x.hidden);
    return [...s.querySelectorAll('[data-dir="open"]')]
      .filter(e => e.checkVisibility && e.checkVisibility({checkVisibilityCSS:true, contentVisibilityAuto:true}))
      .length;
  });
  if (!support) fail(where + ' offers no way to reach support at all');
  if (where.indexOf('what to do') >= 0 && n.some(t => /Find support/.test(t)))
    fail('find support is back in the act screen navigation, it belongs at row 05');
};
/* THE RESULT SCREEN IS THE OTHER ONE WITHOUT THEM.
   A reader who has just been told something about their money has two moves
   at the top and no more: read on, or check another name. Three ways off that
   screen was two too many. The pair is still reachable from its foot, with
   the rest of the small print. */
{
  const n = await p.evaluate(() => {
    const s = [...document.querySelectorAll('#rpt .rp-sheet')].find(x => !x.hidden);
    return { pills: [...s.querySelectorAll('.rp-nav .rp-pill')].map(e => e.textContent.trim()),
             newcheck: !!s.querySelector('#rpNewCheck'),
             /* And the one control it keeps sits on the card, above it. */
             onCard: !!s.querySelector('.rp-cardcol .rp-newrow #rpNewCheck'),
             foot: !!s.querySelector('#rpToSourcesR') };
  });
  if (n.pills.length) fail('the result screen has ' + n.pills.length
    + ' pills in its header and should have none: ' + n.pills.join(', '));
  if (!n.newcheck) fail('the result screen has lost the way to check another name');
  if (!n.onCard) fail('new check is not on the report card, where it was asked to sit');
  if (!n.foot) fail('the result screen has no route to how we decide at all now');
}

/* Forward. */
await p.click('#rpToFound'); await p.waitForTimeout(500); await one('rpFound', 'the way on to what we found');
/* WHAT WE FOUND OFFERS ONE THING AT THE TOP AND IT IS THE WAY BACK.
   A reader gets here by choosing to go deeper, and the way on is the door at
   the foot of the page. Three ways off a screen whose whole job is to be read
   to the bottom is two too many. The way back is a pill now, in the row on the
   right where every other control on this product lives, rather than an
   underlined word stranded mid-header where nobody looks for one. */
{
  const n = await p.evaluate(() => {
    const s = [...document.querySelectorAll('#rpt .rp-sheet')].find(x => !x.hidden);
    return { pills: [...s.querySelectorAll('.rp-nav .rp-pill')].map(e => e.textContent.trim()),
             backs: s.querySelectorAll('.rp-navb.rp-back').length,
             right: (() => {
               const b = s.querySelector('.rp-nav .rp-pill-back'), h = s.querySelector('.rp-head');
               if (!b || !h) return null;
               const br = b.getBoundingClientRect(), hr = h.getBoundingClientRect();
               return Math.round(hr.right - br.right);
             })() };
  });
  if (n.pills.length !== 1)
    fail('what we found has ' + n.pills.length + ' pills and should have exactly one, the way back: '
      + n.pills.join(', '));
  if (!/^Back to\s+the result$/i.test(n.pills[0].replace(/\s+/g,' ')))
    fail('the one pill on what we found is not the way back, it says: ' + n.pills[0]);
  if (n.backs) fail('the way back on what we found is an underlined word again; it belongs in the pill row');
  if (n.right === null || n.right > 4)
    fail('the way back on what we found is not on the right edge, it sits ' + n.right + 'px in');
}

/* AND THE FINDINGS ARE ONE LINE EACH UNTIL SOMEBODY OPENS ONE. */
{
  const f = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#rpFound .rp-fd')];
    return rows.map(d => ({
      open: d.open,
      lines: (d.querySelector('.rp-t').textContent.match(/\S/g) || []).length > 0,
      bodyShown: d.querySelector('.rp-fdbody')
        .checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true }),
      h: Math.round(d.getBoundingClientRect().height)
    }));
  });
  if (f.length < 2) fail('what we found is showing ' + f.length + ' findings');
  for (const r of f) {
    if (r.open) fail('a finding is open before anybody pressed it');
    if (r.bodyShown) fail('a finding is closed and its detail is on the screen anyway');
    if (r.h > 190) fail('a closed finding is ' + r.h + 'px tall, which is not a line');
  }
  /* Opening them shows what each one rests on and who says it. The link to the
     record itself is there wherever the evidence carries a URL, and some of the
     specimen records honestly do not, so that one is asserted across the set
     rather than on every row. */
  const rows = await p.$$('#rpFound .rp-fd summary');
  for (const r of rows) { await r.click(); }
  await p.waitForTimeout(400);
  const o = await p.evaluate(() => {
    const has = (d, s) => !!d.querySelector(s) && d.querySelector(s)
      .checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true });
    return [...document.querySelectorAll('#rpFound .rp-fd')].map(d =>
      ({ open: d.open, x: has(d, '.rp-x'), from: has(d, '.rp-from'), lk: has(d, '.rp-lk') }));
  });
  o.forEach((r, i) => {
    if (!r.open) fail('pressing finding ' + (i + 1) + ' did not open it');
    if (!r.x) fail('open finding ' + (i + 1) + ' does not show what it rests on');
    if (!r.from) fail('open finding ' + (i + 1) + ' does not say who says it');
  });
  /* The link to the record is data driven: it appears wherever that finding's
     evidence carries a URL, and the specimen this smoke walks honestly carries
     none. So the assertion here is that a missing link is missing, rather than
     present and hidden. That the emitter puts .rp-lk inside the open body at
     all is checked statically in verify.mjs. */
  const ghost = await p.evaluate(() => [...document.querySelectorAll('#rpFound .rp-fd')]
    .filter(d => d.querySelector('.rp-lk') && !d.querySelector('.rp-lk')
      .checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })).length);
  if (ghost) fail(ghost + ' open finding(s) carry a link to the record that cannot be seen');
  for (const r of rows) { await r.click(); }
  await p.waitForTimeout(300);
}
await p.click('#rpToAct');   await p.waitForTimeout(500); await one('rpAct', 'the way on to what to do');
await pillPair('the act screen');

/* THE DEEPEST SCREEN CARRIES BOTH WAYS BACK, AS PILLS.
   One step to the findings, and one all the way to the verdict, because this
   is the screen a reader is furthest from where they started. */
{
  const n = await p.evaluate(() => {
    const s = document.getElementById('rpAct');
    return { pills: [...s.querySelectorAll('.rp-nav .rp-pill')].map(e => e.textContent.trim()),
             navb: s.querySelectorAll('.rp-navb.rp-back').length,
             order: (() => {
               const y = q => { const e = s.querySelector(q); return e
                 ? Math.round(e.getBoundingClientRect().top + window.scrollY) : null; };
               /* "Where we looked" is gone from this page. It was a kicker,
                  a headline and three lines promising every register and what
                  each one said back, above the data room door that delivered
                  them. The door is a footer link now, which left a section
                  promising a list and delivering nothing. */
               return { title: y('.rp-stitle'), already: y('#rpAlready'),
                        menus: y('#rpStepsSec'), dl: y('#rpDownloadSummary'),
                        support: y('#rpFindSupport'), room: y('#rpOpenRecord') };
             })() };
  });
  const flat = n.pills.map(t => t.replace(/\s+/g, ' ').trim().toLowerCase());
  for (const w of ['back to what we found', 'back to the result'])
    if (!flat.includes(w)) fail('what to do is missing the pill: ' + w + ', it has ' + n.pills.join(' / '));
  if (n.navb) fail('a way back on what to do is an underlined word again');
  const o = n.order;
  for (const k of Object.keys(o)) if (o[k] === null) fail('what to do is missing ' + k);
  if (!(o.title < o.already && o.already < o.menus && o.menus < o.dl
        && o.dl < o.support && o.support < o.room))
    fail('what to do reads in the wrong order: ' + JSON.stringify(o));
  /* And the data room is a quiet footer link, not a door the size of the red
     one, on a page that promises everything takes an hour. */
  {
    const room = await p.evaluate(() => {
      const e = document.getElementById('rpOpenRecord');
      const r = e.getBoundingClientRect();
      return { cls: e.className, w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (!/rp-lk/.test(room.cls) || room.h > 40)
      fail('the data room is back as a full width door on what to do: ' + JSON.stringify(room));
  }
}

/* Back, one step at a time, to where the reader actually came from. */
await p.click('#rpActBack');   await p.waitForTimeout(500); await one('rpFound', 'back from what to do');
await p.click('#rpFoundBack'); await p.waitForTimeout(500); await one('rpReport', 'back from what we found');

/* Out to sources from the middle of the report, and back to where they were.
   From the ACT screen now: what we found no longer carries the pill. */
await p.click('#rpToFound'); await p.waitForTimeout(400);
await p.click('#rpToAct'); await p.waitForTimeout(400);
await p.click('#rpToSources_act'); await p.waitForTimeout(400);
await one('rpSources', 'sources from the act screen');
/* The label names the screen it returns to. It used to say "Back to the
   report" from all three, and from "Do this right now" that is a label and a
   destination that do not agree. */
{
  const t = (await p.textContent('#rpBackToReportT')).trim();
  if (t !== 'Back to what to do')
    fail('the way out of sources says "' + t + '" and goes back to what to do');
}
await p.click('#rpBackToReport'); await p.waitForTimeout(400);
await one('rpAct', 'back from sources');

/* THE REFERENCE IS NOT PRINTED IN THE CORNER OF ANY SCREEN.
   It is the first line of the report card, at eighteen points, which is where
   somebody quotes it from. A second copy in ten point mono in the corner said
   the same thing smaller and took the corner the pills belong in. */
{
  const stamps = await p.evaluate(() => document.querySelectorAll('#rpt .rp-stamp').length);
  if (stamps) fail(stamps + ' reference stamps are back in the top right corner');
}

/* The order on the result screen, read off the rendered page. */
await p.click('#rpActBack'); await p.waitForTimeout(400);
await p.click('#rpFoundBack'); await p.waitForTimeout(400);
await one('rpReport', 'back to the result before reading its order');
const order = await p.evaluate(() => {
  const s = document.getElementById('rpReport');
  const y = sel => { const e = s.querySelector(sel); return e ? e.getBoundingClientRect().top + window.scrollY : null; };
  return { gap: y('.rp-gapnote'), onward: y('#rpToFound'), already: y('#rpAlready') };
});
if (order.gap === null || order.onward === null)
  fail('the result screen is missing the gap note or the way on');
if (order.already !== null)
  fail('the already-sent door is back on the result screen; it belongs at the top of what to do');
if (!(order.gap < order.onward))
  fail('the result screen reads in the wrong order: ' + JSON.stringify(order));

/* The already-sent door now opens the what-to-do screen, above its title. */
await p.click('#rpToFound'); await p.waitForTimeout(400);
await p.click('#rpToAct');   await p.waitForTimeout(500);
const actOrder = await p.evaluate(() => {
  const s = document.getElementById('rpAct');
  const y = sel => { const e = s.querySelector(sel); return e ? e.getBoundingClientRect().top + window.scrollY : null; };
  return { already: y('#rpAlready'), title: y('.rp-stitle') };
});
if (actOrder.already === null || actOrder.title === null)
  fail('what to do is missing the already-sent door or its title');
/* Directly under the title, not above it. The title and its one line say where
   the reader is; the door is the next thing they meet. Above the title opened
   the page with a red panel about money already gone before the page had said
   what it was. */
if (!(actOrder.title < actOrder.already))
  fail('the already-sent door sits above the what-to-do title; it belongs under it: '
    + JSON.stringify(actOrder));

console.log('screens walked, two moves on the result, both pills on the rest, order held');
if (errs.length) fail('page errors ' + errs.slice(0,2).join(' | '));
console.log('PASSED');
await b.close();
