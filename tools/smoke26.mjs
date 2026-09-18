/* THE REPORT IS THREE SCREENS, WALKED THE WAY A READER WALKS IT.
   The result, what to do, and how we decide. What we found used to be a fourth
   and is not any more: it opens in place on the result, so the walk below goes
   result to act to how we decide and back, and the old fourth stop is checked
   as a disclosure rather than as a screen. */
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
await p.waitForTimeout(250); await p.evaluate(()=>{const b=document.getElementById('primOk'); if(b) b.click();}); /* through the primer */
await p.waitForTimeout(3000);
for (let i = 0; i < 6; i++) {
  if (!await p.evaluate(() => document.getElementById('waitBox').classList.contains('on'))) break;
  await p.evaluate(()=>{const b=document.getElementById('primOk'); if(b && !b.disabled) b.click();}); await p.waitForTimeout(500);
}
await p.waitForTimeout(1000);
await one('rpReport', 'a finished check');

/* Sources and method is reachable from every screen. Find support is too, but
   on the act screen it sits inside the reach-out row rather than as a pill
   beside the way back, because it is not navigation: it is part of who to
   send things to.
   So the assertion is that the reader can always reach support, not that it is
   always drawn the same way. */
const pillPair = async where => {
  const n = await p.evaluate(() => {
    const s = [...document.querySelectorAll('#rpt .rp-sheet')].find(x => !x.hidden);
    const t = [...s.querySelectorAll('.rp-nav .rp-pill')].map(e => e.textContent.trim());
    return t;
  });
  if (!n.some(t => /How we decide/.test(t))) fail(where + ' has no how we decide pill');
  /* On what to do, support sits inside the reach-out row, which is a closed
     disclosure until the reader opens it, so it is present rather than drawn.
     Everywhere else it has to be on the screen without opening anything. */
  const act = /act screen|what to do/.test(where);
  const support = await p.evaluate(shut => {
    const s = [...document.querySelectorAll('#rpt .rp-sheet')].find(x => !x.hidden);
    const all = [...s.querySelectorAll('[data-dir="open"]')];
    return shut ? all.length : all.filter(e => e.checkVisibility
      && e.checkVisibility({checkVisibilityCSS:true, contentVisibilityAuto:true})).length;
  }, act);
  if (!support) fail(where + ' offers no way to reach support at all');
  if (act && n.some(t => /Find support/.test(t)))
    fail('find support is back in the act screen navigation, it belongs inside the reach out row');
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

/* Forward. WHAT WE FOUND IS NOT A PLACE ANY MORE.
   It opens under the door that names it, on the result the reader is already
   reading, so pressing it must not move them anywhere. A reader who has just
   been given a verdict and then been moved to a second screen to see the
   records behind it has been asked to hold two pages in their head. */
await p.click('#rpToFound'); await p.waitForTimeout(600);
await one('rpReport', 'opening what we found');
{
  const n = await p.evaluate(() => {
    const box = document.getElementById('rpFoundIn');
    const btn = document.getElementById('rpToFound');
    return { open: !box.hidden, exp: btn.getAttribute('aria-expanded'),
             ctl: btn.getAttribute('aria-controls'),
             gone: !document.getElementById('rpFound'),
             holds: ['#rpFindsSec', '#rpTwoWays', '#rpClaimsSec']
               .filter(q => !box.querySelector(q)) };
  });
  if (!n.gone) fail('what we found is still a screen of its own');
  if (!n.open) fail('what we found did not open');
  if (n.exp !== 'true') fail('the door does not report that it is open');
  if (n.ctl !== 'rpFoundIn') fail('the door does not name what it opens');
  if (n.holds.length) fail('what we found opened without: ' + n.holds.join(', '));
}

/* AND THE FINDINGS ARE ONE LINE EACH UNTIL SOMEBODY OPENS ONE. */
{
  const f = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#rpFoundIn .rp-fd')];
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
  const rows = await p.$$('#rpFoundIn .rp-fd summary');
  for (const r of rows) { await r.click(); }
  await p.waitForTimeout(400);
  const o = await p.evaluate(() => {
    const has = (d, s) => !!d.querySelector(s) && d.querySelector(s)
      .checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true });
    return [...document.querySelectorAll('#rpFoundIn .rp-fd')].map(d =>
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
  const ghost = await p.evaluate(() => [...document.querySelectorAll('#rpFoundIn .rp-fd')]
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
               return { title: y('.rp-stitle'), menus: y('#rpStepsSec'),
                        already: y('#rpAlready'), room: y('#rpOpenRecord') };
             })(),
             /* THE FORMS AND THE SUPPORT DIRECTORY LIVE INSIDE ROW 02.
                They are part of who you send things to, so they are measured
                by what contains them, not by where they land: a closed
                disclosure reports a top that means nothing. */
             inReach: (() => {
               const row = s.querySelector('#rpPaks') &&
                 s.querySelector('#rpPaks').closest('details, .rp-acc');
               if (!row) return null;
               return ['#rpDownloadSummary', '#rpFindSupport']
                 .every(q => { const e = s.querySelector(q); return e && row.contains(e); });
             })(),
             /* And the red door is the first of the three, inside the list. */
             doorFirst: (() => {
               const list = s.querySelector('#rpStepsSec');
               const door = s.querySelector('#rpAlready');
               return !!(list && door && list.contains(door));
             })() };
  });
  const flat = n.pills.map(t => t.replace(/\s+/g, ' ').trim().toLowerCase());
  /* ONE WAY BACK, NOT TWO. What we found is no longer somewhere to return to,
     so the only destination left is the result. */
  if (!flat.includes('back to the result'))
    fail('what to do is missing the pill: back to the result, it has ' + n.pills.join(' / '));
  if (flat.includes('back to what we found'))
    fail('what to do still offers a way back to a screen that no longer exists');
  if (n.navb) fail('a way back on what to do is an underlined word again');
  const o = n.order;
  for (const k of Object.keys(o)) if (o[k] === null) fail('what to do is missing ' + k);
  /* Title, then the three things, then the door to the whole record last. */
  if (!(o.title < o.menus && o.menus <= o.already && o.already < o.room))
    fail('what to do reads in the wrong order: ' + JSON.stringify(o));
  if (n.inReach === null) fail('what to do has lost the row that says who to reach out to');
  else if (!n.inReach) fail('the summary and the support directory sit outside the reach out row');
  if (!n.doorFirst) fail('the fraud door is outside the list of three again');
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

/* Back from what to do goes to the result, because the result is now where
   the records live. */
await p.click('#rpActBack'); await p.waitForTimeout(500); await one('rpReport', 'back from what to do');

/* Out to how we decide from the act screen, and back to where they were. */
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
