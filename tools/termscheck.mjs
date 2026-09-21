/* ============================ THE CLICK IS THE AGREEMENT, AND IT HOLDS
   A click only binds anybody if they were told what it meant before they made
   it, could read what they were agreeing to, and could not reach the thing it
   governs without making it. Every test here fails if one of those three goes.

   The Quebec rules are tested against the text, because they are the ones a
   court would read: section 10 of the Consumer Protection Act prohibits a
   stipulation freeing a merchant from the consequences of its own act, section
   11.1 prohibits compulsory arbitration and class action waivers, and section
   11.2 limits changing a contract unilaterally. */
import fs from 'fs';
import { chromium } from 'playwright';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const src = fs.readFileSync('index.html', 'utf8');

/* ---- 1. The text says what it must, and does not say what it must not ---- */
const i = src.indexOf('<div id="rpTermsBody">');
ok(i > -1, 'the terms are gone from the page');
const body = src.slice(i, src.indexOf('<nav class="rp-docnav"', i));
const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const MUST = [
  [/It is not advice/,                         'says it is not advice'],
  [/not financial, investment, legal, tax or insurance advice/i, 'names the kinds of advice it is not'],
  [/not a guarantee/i,                         'says a result is not a guarantee'],
  [/An absence is not proof/,                  'says an absence is not proof'],
  [/As far as the law allows/,                 'limits liability only as far as the law allows'],
  [/intentional or grossly negligent/,         'keeps liability for our own intentional or grossly negligent acts'],
  [/cannot be taken away by agreement/,        'preserves the rights the law will not let a contract remove'],
  [/Quebec/,                                   'has its Quebec section'],
  [/class action/,                             'says nothing stops a class action'],
  [/no arbitration clause/i,                   'says there is no arbitration clause'],
  [/only to checks made after it is published/,'says a change never reaches back over a check already made'],
  [/laws of Alberta/,                          'names the governing law'],
  [/province where you live/,                  'lets a consumer rely on their own province'],
  [/Use it to judge a person|decide whether to hire, lend to, insure or rent/,
                                               'forbids using a result to judge an individual'],
  [/Republish it as fact|statement that a business has done something wrong/,
                                               'forbids republishing a result as a finding'],
  [/privacy notice/i,                          'points at the privacy notice'],
];
for (const [re, what] of MUST) ok(re.test(text), 'the terms no longer ' + what);

/* Clauses a Canadian consumer court strikes, and Quebec prohibits outright. */
const MUST_NOT = [
  [/release[sd]? (?:us|4orm)[^.]{0,40}from (?:all|any) liability/i, 'a blanket release from all liability'],
  [/waive[s]? (?:your|any) right to (?:a )?class/i,               'a class action waiver'],
  [/binding arbitration/i,                                         'compulsory arbitration'],
  [/(?:may|can) (?:change|amend|modify)[^.]{0,60}at any time/i,    'a change-at-any-time clause'],
  [/under no circumstances[^.]{0,80}liab/i,                        'an unconditional exclusion of liability'],
];
for (const [re, what] of MUST_NOT) ok(!re.test(text), 'the terms contain ' + what);

/* House rules. */
ok(!/[\u2014\u2013]/.test(text), 'the terms contain an em or en dash');
ok(!/\bproblem\b/i.test(text), 'the terms say problem');

/* ---- 2. The notice sits beside the button, and names the version ------- */
{
  const card = src.slice(src.indexOf('id="primBox"'), src.indexOf('id="primOk"') + 200);
  ok(/By pressing <b>I understand<\/b> you agree to the/.test(card),
     'the card no longer tells the reader that pressing I understand is agreement');
  ok(/id="primTermsBtn"/.test(card), 'the card no longer lets the reader open the terms');
  ok(card.indexOf('primTermsLine') < card.indexOf('id="primOk"'),
     'the notice is after the button, so it is read after the click it governs');
  ok(/id="primTermsVer"/.test(card), 'the card does not say which version is being agreed to');
  ok(/var TERMS_VERSION = "\d+\.\d+"/.test(src), 'there is no terms version');
}

/* ---- 3. The result cannot open before the agreement -------------------- */
{
  const fin = src.slice(src.indexOf('function waitFinish('), src.indexOf('function waitClose('));
  ok(/if\(!waitAck\) return;\s*waitClose\(\);/.test(fin),
     'a check that lands before the reader agrees opens the result anyway');
  const clk = src.slice(src.indexOf('id("primOk").addEventListener'),
                        src.indexOf('id("primOk").addEventListener') + 600);
  ok(/TERMS_AT = new Date\(\)/.test(clk), 'pressing I understand no longer records the agreement');
  ok(/waitAck=true/.test(clk), 'pressing I understand no longer releases the result');
  /* And every check asks again. */
  const op = src.slice(src.indexOf('function primOpen('), src.indexOf('function primClose('));
  ok(/TERMS_AT=null/.test(op), 'an agreement from one check carries over to the next');
}

/* ---- 4. The panel in the card cannot navigate away --------------------- */
{
  const fill = src.slice(src.indexOf('function primTermsFill('), src.indexOf('function primTermsToggle('));
  ok(/querySelectorAll\("\[data-doc\]"\)/.test(fill) && /replaceChild/.test(fill),
     'the copy of the terms inside the card keeps its document links, and the way back '
   + 'from a document during a check goes straight to the result');
}

/* ---- 5. Drive it ------------------------------------------------------- */
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const tap = re => p.evaluate(r => { const x = [...document.querySelectorAll('button')]
    .find(y => y.offsetParent && new RegExp(r, 'i').test(y.innerText));
    if (x) { x.click(); return 1; } return 0; }, re);
  await p.goto('file://' + process.cwd() + '/index.html?demo=1');
  await p.waitForTimeout(400);
  await p.fill('#kbInput', 'Meridian Yield Partners'); await p.click('#kbGo');
  await p.waitForTimeout(2200); await tap('investment'); await p.waitForTimeout(1400);
  await tap('not yet');
  for (let k = 0; k < 20; k++) { await p.waitForTimeout(300);
    if (await p.evaluate(() => document.getElementById('primBox').classList.contains('on'))) break; }

  /* Wait long enough for the demo sweep to land, WITHOUT agreeing. */
  await p.waitForTimeout(6000);
  const before = await p.evaluate(() => ({
    stage: document.body.getAttribute('data-stage'),
    shown: getComputedStyle(document.getElementById('rpt')).display !== 'none',
    agreed: document.getElementById('rpAgreed') && !document.getElementById('rpAgreed').hidden }));
  ok(!before.shown && before.stage !== 'report',
     'the result was drawn before the reader pressed I understand: ' + JSON.stringify(before));

  /* Open the terms in the card. */
  await p.click('#primTermsBtn'); await p.waitForTimeout(300);
  const panel = await p.evaluate(() => { const x = document.getElementById('primTermsBox');
    return { open: !x.hidden, h3: x.querySelectorAll('h3').length,
             links: x.querySelectorAll('[data-doc]').length,
             exp: document.getElementById('primTermsBtn').getAttribute('aria-expanded'),
             stillOn: document.getElementById('primBox').classList.contains('on') }; });
  ok(panel.open, 'the terms do not open inside the card');
  ok(panel.h3 >= 10, 'the card shows ' + panel.h3 + ' sections of the terms, not all of them');
  ok(panel.links === 0, 'the terms inside the card still carry links away from it');
  ok(panel.exp === 'true', 'the terms control does not say it is open');
  ok(panel.stillOn, 'opening the terms took the reader off the card');

  /* Agree. */
  await p.click('#primOk');
  for (let k = 0; k < 20; k++) { await p.waitForTimeout(400);
    if (await p.evaluate(() => document.body.getAttribute('data-stage') === 'report')) break; }
  const after = await p.evaluate(() => { const a = document.getElementById('rpAgreed');
    return { stage: document.body.getAttribute('data-stage'),
             line: a ? a.textContent : null, hidden: a ? a.hidden : null }; });
  ok(after.stage === 'report', 'pressing I understand did not open the result');
  ok(after.line && /Terms of Use version \d+\.\d+, agreed at \d\d:\d\d on \d+ \w+ \d{4}/.test(after.line),
     'the result does not say which terms were agreed and when: ' + JSON.stringify(after.line));
  console.log('  before agreeing  ' + JSON.stringify(before));
  console.log('  in the card      ' + JSON.stringify(panel));
  console.log('  after            ' + after.line);

  /* The full page opens from the footer. */
  await p.evaluate(() => { const x = document.querySelector('#rpReport [data-doc="terms"]');
    if (x) x.click(); });
  await p.waitForTimeout(500);
  const pg = await p.evaluate(() => ({ shown: !document.getElementById('rpTerms').hidden,
    back: document.getElementById('rpTermsBackT').textContent }));
  ok(pg.shown, 'the Terms link on the result does not open the terms');
  ok(/Back to/.test(pg.back), 'the terms page back button does not say where it goes');
  ok(errs.length === 0, 'page errors: ' + errs.join(' | '));
} finally { await b.close(); }

if (fails.length) { console.error('termscheck FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('termscheck ok  notice beside the button, terms readable in place, '
  + 'result held until the click, agreement printed');
