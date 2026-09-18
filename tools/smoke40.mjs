/* WHAT TO DO RIGHT NOW, AND THE NINE PACKS.
   Two properties. A reader whose money has gone is told what to do before they
   are told anything else, and a reader who is only weighing something up is not
   handed an emergency. And a pack carries the record rather than a form for the
   reader's own details. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);
const fail = async m => { console.error('FAIL: ' + m); await b.close(); process.exit(1); };

const run = async q => {
  await p.evaluate(s => window.__KBYS__.check(s), q);
  await p.waitForTimeout(350);
  await p.evaluate(() => { const k = document.getElementById('primOk'); if (k && !k.disabled) k.click(); });
  await p.waitForTimeout(5600);
  for (let i = 0; i < 6; i++) {
    if (!await p.evaluate(() => document.getElementById('waitBox').classList.contains('on'))) break;
    await p.evaluate(() => { const k = document.getElementById('primOk'); if (k && !k.disabled) k.click(); });
    await p.waitForTimeout(500);
  }
  await p.waitForTimeout(700);
};
const stage = async v => p.evaluate(s => {
  const c = window.__KBYS__.runCtx() || {}; c.stage = s;
  window.__KBYS__.runCtx(c); window.__KBYS__.rerender();
}, v);
const act = async () => {
  if (await p.evaluate(() => document.getElementById('rpAct').hidden))
    await p.click('#rpToAct');
  await p.waitForTimeout(500);
};

await run('atlanticglobalwealth.com');

/* ---------------------------- money gone: three lines, above everything else */
await stage('SENT');
await act();
{
  const n = await p.evaluate(() => {
    const box = document.getElementById('rpNow');
    const y = q => { const e = document.querySelector(q); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; };
    return { up: !box.hidden, head: document.getElementById('rpNowH').textContent.trim(),
             items: [...box.querySelectorAll('li span')].map(e => e.textContent.trim()),
             now: y('#rpNow'), door: y('#rpAlready'), menus: y('#rpStepsSec'),
             tone: box.getAttribute('data-c') };
  });
  if (!n.up) await fail('money has gone and nothing tells the reader what to do first');
  if (!/bank/i.test(n.head)) await fail('the first thing on the screen is not the bank: ' + n.head);
  if (n.items.length !== 3) await fail('there are ' + n.items.length + ' instructions, there should be three');
  if (!/back of your bank card/i.test(n.items[0]))
    await fail('the first instruction does not say where the number is: ' + n.items[0]);
  if (!/never read your card number/i.test(n.items[0]))
    await fail('the first instruction does not warn about reading out a card number');
  if (!(n.now < n.door && n.now < n.menus))
    await fail('the three things sit below the doors they are meant to replace');
  if (n.tone !== 'urgent') await fail('the money-gone block is not marked urgent');
  console.log('money gone: ' + n.items.length + ' instructions, above everything, bank first');
}

/* ------------------------- weighing it up: a warning, never an emergency */
await stage('BEFORE');
await act();
{
  const n = await p.evaluate(() => {
    const box = document.getElementById('rpNow');
    return { up: !box.hidden, tone: box.getAttribute('data-c'),
             head: document.getElementById('rpNowH').textContent.trim(),
             clock: document.getElementById('rpClock').hidden,
             ajar: document.getElementById('rpAlready').classList.contains('rp-ajar') };
  });
  if (!n.up) await fail('an adverse result with no money gone says nothing to do');
  if (n.tone === 'urgent') await fail('a reader who has sent nothing is being handed an emergency');
  if (/ring your bank/i.test(n.head)) await fail('a reader who has sent nothing is told to ring their bank');
  if (!n.clock || n.ajar) await fail('the recovery route is open in front of somebody who has not paid');
  console.log('weighing it up: ' + n.head + ', and the recovery door stays shut');
}

/* -------------------------------- a clean result is not made to look adverse
   No demo specimen comes back clean, so the clean payload is built here and
   rendered directly. This is the case that matters most for a product that
   tells people about companies: a firm that is on a regulator's register with
   nothing against it must not be handed a page of alarm. */
{
  const clean = {
    name: 'Northfield Partners Ltd', domain: 'northfieldpartners.co.uk',
    verdict: 'GREEN', headline: 'Nothing against them',
    statement: 'They are on the register and no register we reached carried anything against them.',
    idc: 88, cov: 74, asOf: '25 Aug 2026',
    reads: [['31', 'Sources checked']], stats: [], bars: [], barFoot: '',
    cats: {
      C1: { state: 'GREEN', sum: 'Nothing on file', ev: [{ t: 'A', src: 'UK Companies House', find: 'Registered and active since 2011.', when: '25 Aug 2026', url: '' }] },
      C2: { state: 'GREEN', sum: 'On the register', ev: [{ t: 'A', src: 'FCA Financial Services Register', find: 'Authorised, reference 402118.', when: '25 Aug 2026', url: '' }] },
      C3: { state: 'GREEN', sum: 'Nothing on file', ev: [] },
      C4: { state: 'GREY', sum: 'Not reached', ev: [] }
    },
    claims: [], issues: [], bys: [], gaps: [], unresolved: [],
    reviews: { checked: 12, carrying: 0, reports: 0, state: 'organic', note: '', rows: [] },
    ledger: [], retrieved: [], board: {}, live: false
  };
  await p.evaluate(d => { window.__KBYS__.runCtx({ stage: 'BEFORE' }); window.__KBYS__.enter(d, ''); }, clean);
  await p.waitForTimeout(700);
  const n = await p.evaluate(() => {
    const t = q => { const e = document.querySelector(q); return e ? e.textContent.trim() : ''; };
    const box = document.getElementById('rpNow');
    const vis = q => { const e = document.querySelector(q);
      return !!(e && !e.hidden && e.checkVisibility && e.checkVisibility({ checkVisibilityCSS: true })); };
    return { now: !box.hidden, head: document.getElementById('rpNowH').textContent.trim(),
             tonight: t('#rpTonightT'), why: t('#rpWhy'), say: t('#rpSay'),
             acta: vis('#rpTonightA'),
             red: [...document.querySelectorAll('#rpReport .rp-sev[data-s="critical"]')].length };
  });
  const words = [n.tonight, n.why, n.head, n.say].join(' ');
  if (/do not send|stop sending|ring your bank now|fraud claim/i.test(words))
    await fail('a clean result is written like an emergency: ' + JSON.stringify(n));
  if (n.now) await fail('a clean result is handed a do-this-first block: ' + n.head);
  if (n.acta) await fail('a clean result carries an urgent control beside the verdict');
  if (n.red) await fail('a clean result is showing ' + n.red + ' critical findings');
  console.log('clean path: nothing on it reads as a warning');
  /* And back to the specimen for the rest of the walk. */
}

/* --------------------------------------------------- the pack is a record */
await run('atlanticglobalwealth.com');
await act();
await p.evaluate(() => document.querySelectorAll('#rpAct details').forEach(d => d.open = true));
await p.waitForTimeout(400);
{
  const paks = await p.$$('#rpPaks .rp-pak');
  if (paks.length !== 9) await fail('there are ' + paks.length + ' packs, there should be nine');
  for (let i = 0; i < paks.length; i++) {
    await paks[i].click();
    await p.waitForTimeout(400);
    const n = await p.evaluate(() => {
      const body = document.getElementById('rpPvBody');
      return { keys: [...body.querySelectorAll('.rp-pvk')].map(e => e.textContent.trim()),
               recs: body.querySelectorAll('.rp-pvrec').length,
               lines: body.querySelectorAll('.rp-ln, .rp-pva').length,
               say: !!body.querySelector('.rp-pvsay'),
               name: document.getElementById('rpPvName').textContent.trim() };
    });
    if (n.lines) await fail(n.name + ' still asks the reader to fill in ' + n.lines + ' blank lines');
    if (!n.recs) await fail(n.name + ' carries no records at all');
    if (!n.say) await fail(n.name + ' has no note on what to put in the message');
    if (!n.keys.some(k => /what the records say/i.test(k)))
      await fail(n.name + ' does not lead with the records: ' + n.keys.join(' / '));
    if (n.keys.some(k => /they will ask you|only you can answer/i.test(k)))
      await fail(n.name + ' still carries a section of questions for the reader');
    await p.evaluate(() => document.getElementById('rpPvX').click());
    await p.waitForTimeout(250);
  }
  console.log('nine packs: records first, no form, a note at the foot on every one');
}

/* And the downloadable file says the same thing as the preview. */
{
  const h = await p.evaluate(() => window.__KBYS__.pack(0));
  if (/pk-line|pk-ask|What only you can answer/.test(h))
    await fail('the downloadable pack still carries the blank form');
  if (!/What the records say about this name/.test(h))
    await fail('the downloadable pack does not lead with the records');
  if (!/What to put in the message/.test(h))
    await fail('the downloadable pack has no note on what to say');
  if (!/pk-r"|pk-r /.test(h) && !/class="pk-r"/.test(h))
    await fail('the downloadable pack carries no record rows');
  console.log('the file matches the preview');
}

/* Every number on the screen names who answers. */
{
  const tels = await p.evaluate(() =>
    [...document.querySelectorAll('#rpTels a, #rpTels .rp-telx')].map(e => e.textContent.trim()));
  if (!tels.length) await fail('the numbers are gone');
  for (const t of tels) {
    if (/^(Canada|United States)\b/.test(t))
      await fail('a number names a country and not a body: ' + t);
  }
  if (!tels.some(t => /Anti-Fraud Centre/i.test(t))) await fail('the Canadian number does not name the Anti-Fraud Centre');
  if (!tels.some(t => /Federal Trade Commission/i.test(t))) await fail('the US number does not name the FTC');
  if (!tels.some(t => /back of your bank card/i.test(t)))
    await fail('the bank line does not say where to find the number');
  if (tels.some(t => /^Your bank\s+The number on your card/i.test(t)))
    await fail('the bank line still reads as a request for a card number');
  console.log('every number names who answers: ' + tels.length + ' lines');
}

if (errs.length) await fail('page errors: ' + errs.join(' | '));
console.log('OK');
await b.close();
