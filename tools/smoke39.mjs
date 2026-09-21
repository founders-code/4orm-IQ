/* THE RESULT PAGE AS ONE PAGE.
   What we found now opens in place instead of being a screen of its own, the
   next action rides with a reader on a phone, every row can be pointed at, and
   the waiting screen stops talking once it is gone. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);
const fail = async m => { console.error('FAIL: ' + m); await b.close(); process.exit(1); };

await p.evaluate(() => window.__KBYS__.check('atlanticglobalwealth.com'));
await p.waitForTimeout(400);
await p.evaluate(() => { const k = document.getElementById('primOk'); if (k && !k.disabled) k.click(); });
await p.waitForTimeout(5400);

/* ---------------------------------------- the waiting screen stops talking */
{
  const ph = await p.evaluate(() => (document.getElementById('waitPhase') || {}).textContent);
  if ((ph || '').trim() !== '')
    await fail('the waiting screen is still announcing "' + ph + '" after it closed');
  console.log('live region: cleared on close');
}

/* --------------------------------------- what we found opens over the page */
{
  const before = await p.evaluate(() => ({
    screens: ['rpReport', 'rpAct', 'rpSources'].map(i => !!document.getElementById(i)),
    inline: !!document.querySelector('#rpReport #rpFoundIn'),
    shut: document.getElementById('rpFoundBox').hidden,
    exp: document.getElementById('rpToFound').getAttribute('aria-expanded'),
    pop: document.getElementById('rpToFound').getAttribute('aria-haspopup')
  }));
  if (!before.screens.every(Boolean)) await fail('a report screen is missing');
  if (before.inline) await fail('the records are still inside the result page');
  if (!before.shut) await fail('the records sheet is open before anybody asked');
  if (before.exp !== 'false') await fail('the control does not say it is shut');
  if (before.pop !== 'dialog') await fail('the control does not say it opens a dialog');

  await p.evaluate(() => document.getElementById('rpToFound').click());
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => ({
    open: !document.getElementById('rpFoundBox').hidden,
    exp: document.getElementById('rpToFound').getAttribute('aria-expanded'),
    still: document.body.getAttribute('data-stage') === 'report'
        && !document.getElementById('rpReport').hidden,
    finds: [...document.querySelectorAll('#rpFoundBox .rp-tray')].map(e => e.id),
    inside: !!document.querySelector('#rpFoundBox #rpFindsSec')
         && !!document.querySelector('#rpFoundBox #rpClaimsSec'),
    eb: (document.getElementById('rpFoundEb') || {}).textContent || ''
  }));
  if (!after.open) await fail('what we found did not open');
  if (after.exp !== 'true') await fail('the control does not say it is open');
  if (!after.still) await fail('opening what we found took the reader off the result');
  if (!after.inside) await fail('the records and their words did not come with it');
  if (!after.finds.length) await fail('no findings rendered');
  if (!after.finds.every((v, i) => v === 'rpFind-' + (i + 1)))
    await fail('a finding carries no id: ' + JSON.stringify(after.finds));
  if (!/\w/.test(after.eb)) await fail('the sheet does not say whose records these are');
  await p.evaluate(() => document.getElementById('rpFoundBack').click());
  await p.waitForTimeout(700);
  console.log('what we found: opens over the result, ' + after.finds.length + ' findings, all named');
}

/* ------------------------------------------------- every act row is named */
{
  await p.evaluate(() => document.getElementById('rpToAct').click());
  await p.waitForTimeout(600);
  const act = await p.evaluate(() => {
    const c = document.getElementById('rpClock');
    if (c && c.hidden) { const h = document.querySelector('#rpStepsSec .rp-acch'); if (h) h.click(); }
    return null;
  });
  await p.waitForTimeout(500);
  const rows = await p.evaluate(() =>
    [...document.querySelectorAll('#rpSteps .rp-step')].map(e => e.id));
  if (!rows.length) await fail('what to do has no rows');
  if (!rows.every((v, i) => v === 'rpStep-' + (i + 1)))
    await fail('a row on what to do carries no id: ' + JSON.stringify(rows));
  /* One way back, not two. What we found is no longer a place to go back to. */
  const backs = await p.evaluate(() =>
    [...document.querySelectorAll('#rpAct .rp-pill-back')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  if (backs.length !== 1)
    await fail('what to do offers ' + backs.length + ' ways back: ' + JSON.stringify(backs));
  if (!/The result/.test(backs[0]))
    await fail('the one way back does not go to the result: ' + backs[0]);
  console.log('what to do: ' + rows.length + ' named rows, one way back');
}

/* ------------------------------- check another name in the foot of each one */
{
  const feet = await p.evaluate(() => ['rpAgainR', 'rpAgainA', 'rpAgainS']
    .map(i => { const e = document.getElementById(i); return e && e.textContent.trim(); }));
  if (!feet.every(t => t === 'Check another name'))
    await fail('a report screen has no way to check another name: ' + JSON.stringify(feet));
  console.log('every foot: check another name');
}

/* ------------------------------------------- the pinned action, on a phone */
{
  await p.evaluate(() => document.getElementById('rpActBack').click());
  await p.waitForTimeout(500);
  const wide = await p.evaluate(() => {
    const e = document.getElementById('rpPin');
    window.scrollTo(0, window.innerHeight * 2);
    return getComputedStyle(e).display;
  });
  if (wide !== 'none') await fail('the pinned action shows on a laptop, where the door is already in view');

  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  const top = await p.evaluate(() => document.getElementById('rpPin').hidden);
  if (!top) await fail('the pinned action is up before the reader has passed the first screenful');

  await p.evaluate(() => window.scrollTo(0, window.innerHeight * 1.6));
  await p.waitForTimeout(500);
  const mid = await p.evaluate(() => {
    const e = document.getElementById('rpPin'), r = e.getBoundingClientRect();
    const g = document.getElementById('rpPinGo').getBoundingClientRect();
    return { hidden: e.hidden, on: e.classList.contains('rp-on'),
             bottom: Math.round(r.bottom), vh: window.innerHeight,
             h: Math.round(g.height), label: document.getElementById('rpPinGo').textContent.trim() };
  });
  if (mid.hidden || !mid.on) await fail('the pinned action never appeared on a phone');
  if (Math.abs(mid.bottom - mid.vh) > 2) await fail('the pinned action is not pinned to the foot');
  if (mid.h < 44) await fail('the pinned action is ' + mid.h + 'px tall, under the target floor');
  /* Not sent: the pin names the next steps page. Sent: do this right now. */
  if (!/Do this right now|Next steps to protect you/.test(mid.label)) await fail('the pinned action is mislabelled: ' + mid.label);

  /* It stands down while the door itself is on screen. */
  await p.evaluate(() => {
    const d = document.getElementById('rpToAct');
    d.scrollIntoView({ behavior: 'auto', block: 'center' });
  });
  await p.waitForTimeout(600);
  const near = await p.evaluate(() => document.getElementById('rpPin').classList.contains('rp-on'));
  if (near) await fail('the pinned action and the door are both offered at once');

  /* And it takes the reader to what to do. */
  await p.evaluate(() => window.scrollTo(0, window.innerHeight * 1.6));
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('rpPinGo').click());
  await p.waitForTimeout(600);
  /* It goes where the door goes: next steps for a reader who has not sent
     money, what to do for one who has. */
  const went = await p.evaluate(() => {
    const sent = window.__KBYS__ && window.__KBYS__.runCtx && window.__KBYS__.runCtx().stage === 'SENT';
    return !document.getElementById(sent ? 'rpAct' : 'rpNext').hidden; });
  if (!went) await fail('the pinned action does not open the page the door opens');
  console.log('pinned action: phone only, past the first screenful, stands down at the door');
}

if (errs.length) await fail('page errors: ' + errs.join(' | '));
console.log('OK');
await b.close();
