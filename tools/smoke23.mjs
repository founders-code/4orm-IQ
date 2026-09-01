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

/* ---------------------------------------------------------------- the chips */
const box = doc.getElementById('kbCtx');
if (!box) fails.push('the context block is gone');
if (box && !box.hidden) fails.push('the questions are showing before anything was typed');

const input = doc.getElementById('kbInput');
const go = doc.getElementById('kbGo');
input.value = 'atlanticglobalwealth.com';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 60));
if (box.hidden) fails.push('the questions never appear');
const chips = doc.querySelectorAll('#kbCtx .ctxchip');
console.log('chips offered:', chips.length);
if (chips.length < 8) fails.push('the questions lost options');
/* Nothing about the button may depend on an answer. */
if (go.disabled) fails.push('the Check button waits on a question it must not wait on');

/* A blocked identifier must take the questions away with it. */
input.value = 'John Smith';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 60));
if (!box.hidden) fails.push('the questions stay up for an identifier we refuse');
input.value = 'atlanticglobalwealth.com';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 60));

/* The vehicle follow-up appears only for a vehicle, and is dropped on switch. */
const tap = v => {
  const c = [...doc.querySelectorAll('#kbCtx .ctxchip')].find(x => x.getAttribute('data-v') === v);
  if (!c) { fails.push('no chip for ' + v); return; }
  c.click();
};
const has = v => [...doc.querySelectorAll('#kbCtx .ctxchip')].some(x => x.getAttribute('data-v') === v);
if (has('DEALER')) fails.push('the vehicle follow-up shows before a vehicle is chosen');
tap('AUTO');
if (!has('DEALER')) fails.push('the vehicle follow-up never appears');
tap('PRIVATE');
if (window.__KBYS__.ctx().channel !== 'PRIVATE') fails.push('the vehicle answer did not stick');
tap('INSURANCE');
if (window.__KBYS__.ctx().channel !== null)
  fails.push('a vehicle answer survived a switch to another sector, so the run carries a '
    + 'fact nobody stated');
/* Tapping the chosen chip again clears it: every answer is retractable. */
tap('INSURANCE');
if (window.__KBYS__.ctx().sector !== null) fails.push('an answer cannot be taken back');

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
for (const cls of ['ctx', 'ctxrow', 'ctxq', 'ctxchip', 'ctxskip', 'rp-acta', 'rp-actb'])
  if (!new RegExp('\\.' + cls + '[{ ,:\\[]').test(html)) fails.push('.' + cls + ' has no CSS rule');

if (errs.length) fails.push('page errors: ' + errs.length + ' ' + errs[0]);
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
window.close();
process.exit(fails.length ? 1 : 0);
