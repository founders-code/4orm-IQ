/* The two questions, and what they change.
 *
 * The property under test is not that chips render. It is that answering them
 * cannot promote an answer. A person who ticks "I already sent money" must not
 * be pointed at their bank on the strength of two bad reviews, and a person
 * who ticks nothing must get exactly the report they would have got before
 * these questions existed. */
import fs from 'fs';
import { JSDOM } from 'jsdom';

const file = '/home/claude/kbys/build/4orm-iq/index.html';
const html = fs.readFileSync(file, 'utf8');
const fails = [];
const errs = [];

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'https://4ormiq.com/?demo=1&debug=1',
  beforeParse(w) { w.addEventListener('error', e => errs.push(e.error?.stack || e.message)); } });
const { window } = dom, doc = window.document;
await new Promise(r => setTimeout(r, 250));

/* ------------------------------------------------------------- the thread */
const chat = doc.getElementById('kbChat');
if (!chat) fails.push('the chat thread is gone');
if (chat && !chat.hidden) fails.push('the thread is open before anything was submitted');

const input = doc.getElementById('kbInput');
const go = doc.getElementById('kbGo');
input.value = 'atlanticglobalwealth.com';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 80));
/* Typing must do NOTHING except enable the button. A control that appears
   under the cursor mid-word is the page interrupting somebody. */
if (!chat.hidden) fails.push('the questions appear while somebody is still typing');
if (doc.querySelectorAll('#kbChat .pill').length)
  fails.push('option pills are on the page before the identifier was submitted');
if (go.disabled) fails.push('the Check button is disabled with a usable identifier in the bar');

/* Submit opens the thread. jsdom reports no reduced-motion preference, so the
   thread runs at its real pace and the waits here have to match it. */
doc.getElementById('kbForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await new Promise(r => setTimeout(r, 1400));
if (chat.hidden) fails.push('submitting did not open the thread');
const shown = id => { const e = doc.getElementById(id); return e && !e.hidden; };
if (shown('kbForm')) fails.push('the search bar is still on the page under the thread');
if (shown('kbAccepts')) fails.push('the accepts sentence is still on the page under the thread');
if (!/2 quick questions/i.test(chat.textContent)) fails.push('the thread never said what it wanted');
if (/skip/i.test(chat.textContent)) fails.push('the thread offers a skip');

const pill = label => [...doc.querySelectorAll('#kbChat .pill')].find(b => b.textContent === label);
const tap = async label => {
  const b = pill(label);
  if (!b) { fails.push('no pill for "' + label + '"'); return; }
  b.click(); await new Promise(r => setTimeout(r, 1100));
};
await new Promise(r => setTimeout(r, 1000));
console.log('first question pills:', doc.querySelectorAll('#kbChat .pill').length);
if (pill('A dealership')) fails.push('the vehicle follow-up is offered before a vehicle is chosen');
await tap('A vehicle');
if (!pill('A dealership')) fails.push('the vehicle follow-up never appeared');
await tap('A private seller');
if (window.__KBYS__.ctx().channel !== 'PRIVATE') fails.push('the vehicle answer did not stick');
/* The payload drops an answer whose question no longer applies. */
window.__KBYS__.ctx().sector = 'INSURANCE';
if ('channel' in window.__KBYS__.ctxPayload())
  fails.push('a vehicle answer survives a switch to another sector, so the run carries a '
    + 'fact nobody stated');
window.__KBYS__.ctx().sector = 'AUTO';

/* ------------------------------------------------- the escalation ladder */
const ev = (t, reg) => ({ t, reg, src: reg });
const mk = cats => ({ verdict: 'YELLOW', cats });
const official = mk({ a: { state: 'RED', ev: [ev('A', 'Ontario Securities Commission')] } });
const twoBoards = mk({ a: { state: 'YELLOW', ev: [ev('C', 'trustpilot'), ev('C', 'bbb')] } });
const threeBoards = mk({ a: { state: 'YELLOW', ev: [ev('C', 'trustpilot'), ev('C', 'bbb'), ev('D', 'reddit')] } });
const pileOnOneBoard = mk({ a: { state: 'YELLOW',
  ev: Array.from({ length: 40 }, () => ev('C', 'trustpilot')) } });

const esc = window.__KBYS__ && window.__KBYS__.escalation;
if (typeof esc !== 'function') fails.push('the escalation ladder is not reachable from the page');
else {
  console.log('official:', esc(official), '| 2 boards:', esc(twoBoards),
              '| 3 boards:', esc(threeBoards), '| 40 on one board:', esc(pileOnOneBoard));
  if (esc(official) !== 'OFFICIAL') fails.push('a tier A finding does not escalate');
  if (esc(twoBoards) !== 'NOISE')
    fails.push('two complaints are treated as a finding, which makes us the thing we replace');
  if (esc(threeBoards) !== 'PATTERN') fails.push('three independent platforms do not read as a pattern');
  if (esc(pileOnOneBoard) !== 'NOISE')
    fails.push('volume on ONE board reads as a pattern, so a single brigaded board can '
      + 'convict a business');
}

/* ------------------------------------------------------------- delivery */
const deliver = window.__KBYS__ && window.__KBYS__.delivery;
if (typeof deliver !== 'function') fails.push('the delivery rules are not reachable from the page');
else {
  const at = (stage, d) => { window.__KBYS__.runCtx({ stage }); return deliver(d); };
  const bankish = s => /bank/i.test(s.t);

  const sentOfficial = at('SENT', official);
  if (sentOfficial.act !== 'bank') fails.push('money gone and a regulator has acted, and the '
    + 'page does not hand over the bank pack');

  const sentNoise = at('SENT', twoBoards);
  if (bankish(sentNoise.t) || sentNoise.act)
    fails.push('money gone and NOTHING official, and the page still leads with the bank. '
      + 'That tells somebody they were defrauded when the record does not say so');
  if (!/not the same as saying nothing is wrong/i.test(sentNoise.x))
    fails.push('the money-gone-nothing-found case stopped saying what it does not know');

  const sentPattern = at('SENT', threeBoards);
  if (sentPattern.act)
    fails.push('a pattern of complaints alone now points somebody at their bank');

  const dilOfficial = at('DILIGENCE', official);
  if (/tonight/i.test(dilOfficial.t + dilOfficial.x))
    fails.push('the homework case still talks about tonight');
  if (dilOfficial.c !== 'urgent') fails.push('a regulator finding reads as calm while researching');

  const dilNoise = at('DILIGENCE', twoBoards);
  if (/tonight|do not send/i.test(dilNoise.t + dilNoise.x))
    fails.push('somebody comparing brokers is told not to send anything tonight');

  const before = at('BEFORE', official);
  if (!/do not send anything tonight/i.test(before.t))
    fails.push('the original before-you-send line is gone');

  /* The default. Nobody answered, and the report must be the one that shipped. */
  window.__KBYS__.runCtx({});
  const skipped = deliver(official);
  if (skipped.t !== before.t || skipped.x !== before.x)
    fails.push('skipping the questions produces a different report from answering '
      + '"not sent yet", so the questions are not optional after all');
}

/* Every class the new markup emits has to resolve to a rule. Markup without
   styling has shipped on this page before and was invisible to every test. */
for (const cls of ['chat', 'bub', 'dots', 'pills', 'pill', 'rp-acta', 'rp-actb'])
  if (!new RegExp('\\.' + cls + '[{ ,:\\[]').test(html)) fails.push('.' + cls + ' has no CSS rule');

if (errs.length) fails.push('page errors: ' + errs.length + ' ' + errs[0]);
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
window.close();
process.exit(fails.length ? 1 : 0);
