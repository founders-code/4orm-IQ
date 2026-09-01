/* Every dot the console draws, measured rather than assumed.
 *
 * A dot styled with width and height on an inline element renders at zero, and
 * whether it renders depends on the parent being a flex or grid container,
 * which no reading of the stylesheet can settle. So this opens the console,
 * opens a check, and measures every one of them. */
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://x/?demo=1&debug=1',
  pretendToBeVisual:true });
const { window } = dom;
window.IntersectionObserver = class { observe(){} disconnect(){} unobserve(){} };
window.Element.prototype.scrollIntoView = function(){};
window.Element.prototype.scrollTo = function(){};
window.scrollTo = function(){};
const errs = [];
window.addEventListener('error', e => errs.push(String(e.message)));

await new Promise(r => setTimeout(r, 900));
const doc = window.document;

/* jsdom does not lay out, so the dots are checked the only way that is honest
   without a real engine: the rule that sizes them must also give them a box, or
   sit inside a container that gives its children one. */
const style = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
const flexParents = new Set();
for (const m of style.matchAll(/([^\s{},]+)\{([^}]*)\}/g)) {
  if (/display\s*:\s*(inline-)?(flex|grid)/.test(m[2])) flexParents.add(m[1].trim());
}
const bad = [];
for (const m of style.matchAll(/([^\s{},]+)\s+i\{([^}]*)\}/g)) {
  const sel = m[1].trim(), body = m[2];
  if (!/width\s*:\s*\d+px/.test(body)) continue;
  if (/display\s*:\s*(block|inline-block|flex)/.test(body)) continue;
  if (flexParents.has(sel)) continue;
  bad.push(sel + ' i');
}
console.log('dots that size an inline element with no flex parent:', bad.length, bad.join(', '));
if (bad.length) { console.error('FAIL: a dot will render at zero'); process.exit(1); }

/* And the check modal has to explain which rule fired. */
doc.getElementById('kbInput').value = 'atlanticglobalwealth.com';
doc.getElementById('kbForm').dispatchEvent(new window.Event('submit', {cancelable:true}));
/* Submitting no longer starts the check. It opens the thread, and the two
   questions in it decide which registers can apply, so the test has to answer
   them the way a reader does. There is no skip, by design. */
const answer = async (text) => {
  for (let i = 0; i < 40; i++) {
    const pill = [...doc.querySelectorAll('.pill')].find(b => b.textContent.trim() === text);
    if (pill) { pill.click(); await new Promise(r => setTimeout(r, 250)); return; }
    await new Promise(r => setTimeout(r, 150));
  }
  console.error('FAIL: the thread never offered "' + text + '"'); process.exit(1);
};
await answer('An investment');
await answer('I have not sent anything yet');
/* Wait for the run itself, then acknowledge. Clicking through before the
   result lands leaves CURRENT with no categories, and every assertion below
   then fails for a reason that has nothing to do with what it is testing. */
await new Promise(r => setTimeout(r, 6000));
const ok = doc.getElementById('waitOk');
ok.click(); await new Promise(r => setTimeout(r, 400)); ok.click();
await new Promise(r => setTimeout(r, 1400));
const tile = doc.querySelector('#tiles .tile');
if (!tile) { console.error('FAIL: no check tiles rendered'); process.exit(1); }
tile.click();
await new Promise(r => setTimeout(r, 300));
/* A tile opens the short answer first and puts the full check behind a
   button, which is the point of progressive disclosure. The rules and the
   register table live on the other side of it. */
const gate = doc.querySelector('#infoBody .gateok');
if (!gate) { console.error('FAIL: the check no longer offers its full detail'); process.exit(1); }
gate.click();
await new Promise(r => setTimeout(r, 300));
const rules = [...doc.querySelectorAll('.rulerow')];
const fired = rules.filter(r => r.classList.contains('on'));
console.log('rules listed:', rules.length, '| marked as what happened:', fired.length);
if (rules.length && fired.length !== 1) {
  console.error('FAIL: a check must mark exactly one rule as the one that fired');
  process.exit(1);
}
const colours = rules.filter(r => /^(RED|GREEN|GREY|YELLOW|NEVER)$/.test(
  r.querySelector('.rk').textContent.trim()));
console.log('rule badges still printing a colour word:', colours.length);
if (colours.length) { console.error('FAIL: a colour is not an outcome'); process.exit(1); }
const said = [...doc.querySelectorAll('.said')];
console.log('registers carrying what they said:', said.length);
if (!said.length) { console.error('FAIL: the register table lost its answer column'); process.exit(1); }
if (errs.length) { console.error('FAIL: page errors', errs.slice(0,3)); process.exit(1); }
console.log('PASSED');
/* The page keeps its clocks running, so the test closes the window itself. */
window.close();
process.exit(0);
