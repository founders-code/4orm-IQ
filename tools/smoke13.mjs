/* The landing, and the waiting screen after the chrome came off.
 *
 * What this measures is what was removed and what replaced it: the four
 * identifier chips are gone because the sentence under the headline already
 * lists what the bar takes, and two things saying it is one thing that can
 * drift apart. The disclaimer wall and the helpline grid on the waiting screen
 * are gone too, replaced by the network. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const html = fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html', 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
  url:'https://4ormiq.com/?demo=1&debug=1',
  beforeParse(w){
    w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
    w.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){},
                            addEventListener(){}, removeEventListener(){} });
    w.scrollTo = () => {};
    w.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
    w.addEventListener('error', e => errs.push('window.error: ' + (e.error?.stack || e.message)));
  }});
const { window } = dom, doc = window.document;
window.console.error = (...a) => errs.push('console.error: ' + a.join(' '));
window.Element.prototype.scrollTo = function(){};
await new Promise(r => setTimeout(r, 900));

const fails = [];

/* ------------------------------------------------------------- the landing */
if (doc.querySelector('.idchip'))
  fails.push('the four identifier chips are back under the bar');
if (doc.querySelector('.tryrow') || doc.querySelector('.try'))
  fails.push('the seeded example row is back');
const accepts = doc.getElementById('kbAccepts');
if (!accepts) fails.push('the sentence listing what the bar takes is gone');
else if (!/company[\s\S]*website[\s\S]*email[\s\S]*wallet/i.test(accepts.textContent))
  fails.push('the sentence no longer lists what the bar takes, and nothing else does');
if (doc.getElementById('servedH'))
  fails.push('the log hash is back beside the counter');
if (!(doc.getElementById('kbForm').compareDocumentPosition(doc.getElementById('statstrip')) & 4))
  fails.push('the figures are no longer below the bar');
console.log('identifier chips gone:', !doc.querySelector('.idchip'));
console.log('the sentence still lists what the bar takes:',
  !!accepts && /company[\s\S]*wallet/i.test(accepts.textContent));

/* -------------------------------------------------------- the waiting screen */
window.__KBYS__.check('investhelm.com');
await new Promise(r => setTimeout(r, 400));

const card = doc.getElementById('eduCard');
console.log('cards:', window.__KBYS__.cards());
console.log('first card:', card.querySelector('.ek').textContent,
            '|', card.querySelector('.et').textContent);
/* The ceiling moved from twelve to eighteen, and the reason is on the record:
   the cut from twenty-three to eleven removed cards that said the same thing in
   a different currency. The five added since say something no other card says,
   which is who is doing this check and what it costs the people it is for. The
   rule was never a number. It is that no two cards cover the same ground, so
   that is what is measured, alongside a ceiling that keeps the deck walkable
   inside one run. */
if (window.__KBYS__.cards() > 18)
  fails.push('the card deck is longer than a reader can get through in one run');
{
  const titles = [...doc.querySelectorAll('#eduDots button')].map(b => b.getAttribute('aria-label'));
  const subject = titles.map(t => String(t).split(', ').slice(1).join(', ').toLowerCase());
  const dupe = subject.filter((v, i) => subject.indexOf(v) !== i);
  if (dupe.length) fails.push('two cards on the waiting deck cover the same ground: ' + dupe[0]);
}
if (!card.querySelector('.ek')) fails.push('the cards no longer render');

/* The arrows and the "n of m" counter went with the rest of the chrome. The
   dots are the only control left, so they are what is exercised. */
console.log('arrows gone:', !doc.getElementById('eduPrev') && !doc.getElementById('eduNext'));
console.log('counter gone:', !doc.getElementById('eduCount'));
if (doc.getElementById('eduPrev') || doc.getElementById('eduNext') || doc.getElementById('eduCount'))
  fails.push('the card chrome is back');
const dots = doc.querySelectorAll('#eduDots button');
console.log('dots are buttons:', dots.length);
if (!dots.length) fails.push('there is no way to move between cards');
if (dots.length !== window.__KBYS__.cards())
  fails.push('there is a dot for a card that does not exist, or a card with no dot');
const before = card.querySelector('.ek').textContent;
dots[dots.length - 1].click();
await new Promise(r => setTimeout(r, 400));
if (card.querySelector('.ek').textContent === before && dots.length > 1)
  fails.push('clicking a dot does not change the card');

/* The network replaced the disclaimer wall and the helpline grid. */
const nodes = doc.querySelectorAll('#netSvg .nnode').length;
const core  = doc.querySelectorAll('#netSvg .nnode.core').length;
console.log('network:', nodes, 'registers,', core, 'of them able to carry a finding alone');
if (!nodes) fails.push('the network never built');
if (!core) fails.push('the network has no core ring, so every register reads as equal weight');
if (doc.querySelector('#waitBox .wdhgrid'))
  fails.push('the helpline grid is back on the waiting screen');
if (doc.querySelector('#waitBox .waitdisc'))
  fails.push('the disclaimer wall is back on the waiting screen');
/* One line of it has to survive somewhere, because it is the sentence this
   product cannot stop saying. */
const fine = doc.getElementById('waitFine');
if (!fine || !/not advice/i.test(fine.textContent))
  fails.push('the "research tool, not advice" line is gone from the waiting screen entirely');

/* Every class the new markup emits must resolve to a rule. */
/* netname, not nlab. The network's label class was renamed off .nlab because
   the report's narrative rows already owned that name and were silently
   resizing every register name on the web. Checking the old name here would
   have passed on the report's rule and proved nothing. */
for (const c of ['netlegend', 'lgc', 'net', 'netcap', 'nlink', 'nnode', 'netname', 'hub', 'pkt'])
  if (!new RegExp('\\.' + c + '[{ ,:\\[]').test(html)) fails.push('.' + c + ' has no CSS rule');

if (errs.length) fails.push('page errors: ' + errs.length + ' ' + errs[0]);
console.log('\n' + (fails.length ? 'FAILED' : 'PASSED'));
fails.forEach(f => console.log('  ' + f));
window.close();
process.exit(fails.length ? 1 : 0);
