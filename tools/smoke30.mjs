/* THE DEBUG HOOK MUST SURVIVE ANYTHING.
 * The page is one inline script. An exception anywhere in it takes out every
 * line below, and the hook the entire test suite reaches for is the last thing
 * in the file. A bare top level fetch put seventeen of twenty eight tests dark
 * without a single one of them saying why, so this runs the page in an engine
 * that has no fetch at all and checks the hook is still there.
 */
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const html = fs.readFileSync('/home/claude/kbys/build/4orm-iq/index.html', 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'https://4ormiq.com/?demo=1&debug=1',
  beforeParse(w) {
    w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
    w.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){},
                            addEventListener(){}, removeEventListener(){} });
    w.scrollTo = () => {};
    w.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
    w.addEventListener('error', e => errs.push('window.error: ' + (e.error?.stack || e.message)));
    /* No fetch. That is the point. */
    delete w.fetch;
  }});
const { window } = dom;
window.console.error = (...a) => errs.push('console.error: ' + a.join(' '));
await new Promise(r => setTimeout(r, 900));

const fail = m => { console.error('FAIL: ' + m); process.exit(1); };
if (!window.__KBYS__) fail('the debug hook is gone, so something above it threw and took the rest of the script with it');
for (const k of ['check', 'ctx', 'bar', 'delivery', 'escalation', 'cards', 'onLiveEvent'])
  if (typeof window.__KBYS__[k] === 'undefined') fail('the debug hook lost ' + k);
console.log('hook intact with no fetch in the engine, keys:', Object.keys(window.__KBYS__).length);
/* And the register control must be absent rather than broken. */
const row = window.document.getElementById('regRow');
if (!row) fail('the register row is gone from the markup');
if (!row.hidden) fail('the register pill is shown when the register could not be reached');
console.log('register pill hidden with no network: true');
if (errs.length) fail('page errors: ' + errs.slice(0, 2).join(' | '));
console.log('PASSED');
window.close();
