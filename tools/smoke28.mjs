/* THE BACK OFFICE, ON A HARD RELOAD.
   Two complaints: it opened for a second and then went to the landing page, and
   a hard reload showed a flash of something. The first is Clerk's default
   after-sign-in URL, which is "/", and it is checked by reading the config the
   page hands Clerk. The second is the shell rendering before anybody knows
   whether this person is signed in, and it is measured here. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const FILE = '/home/claude/kbys/build/4orm-iq/admin.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

/* Clerk's CDN is not reachable from here, which is exactly the worst case:
   the page must still resolve to something a person can read. */
/* Held for a moment rather than failed instantly, because the state worth
   measuring is the one a person sees while Clerk is still answering. */
await p.route('**/clerk.browser.js', async r => {
  await new Promise(x => setTimeout(x, 1500));
  await r.abort();
});
await p.goto('file:///home/claude/kbys/build/4orm-iq/admin.html');
await p.waitForTimeout(250);
/* The attribute has to be in the markup, not added by script, or the first
   paint still shows the shell. */
if (!/<body[^>]*data-boot="1"/.test(fs.readFileSync(FILE, 'utf8')))
  fail('data-boot is not on the body tag in the markup, so the first paint still shows the shell');

/* The network is blocked in this sandbox, so Clerk fails before a frame can be
   measured mid flight. The state that matters is therefore forced and measured
   directly: with data-boot set, nothing of the shell may be on screen. */
const held = await p.evaluate(() => {
  document.body.setAttribute('data-boot', '1');
  const r = {
    wrapVis: getComputedStyle(document.querySelector('.wrap')).visibility,
    footVis: getComputedStyle(document.querySelector('footer')).visibility,
    bootShown: getComputedStyle(document.getElementById('boot')).display
  };
  document.body.removeAttribute('data-boot');
  return r;
});
console.log('while it works out who you are:', JSON.stringify(held));
if (held.wrapVis !== 'hidden') fail('the shell is visible before sign in resolves, which is the flash');
if (held.footVis !== 'hidden') fail('the footer is visible before sign in resolves');
if (held.bootShown === 'none') fail('there is nothing on screen while sign in resolves');

await p.waitForTimeout(2200);
const after = await p.evaluate(() => ({
  boot: document.body.hasAttribute('data-boot'),
  gate: !document.getElementById('gate').hidden,
  note: (document.getElementById('gateNote').textContent || '').trim(),
  panel: !document.getElementById('panel').hidden,
  stayed: location.pathname.endsWith('admin.html')
}));
console.log('after Clerk fails to load:', JSON.stringify(after));
if (after.boot) fail('the back office is stuck on its boot screen when Clerk cannot load');
if (!after.gate) fail('nothing is shown when Clerk cannot load');
if (!after.note) fail('the gate does not say why it cannot let anybody in');
if (after.panel) fail('the operations panel opened without a sign in');
if (!after.stayed) fail('the back office navigated away from itself');

/* And the redirect configuration, read off the page. */
const src = await p.content();
for (const k of ['afterSignOutUrl', 'signInFallbackRedirectUrl', 'signUpFallbackRedirectUrl', 'fallbackRedirectUrl'])
  if (!src.includes(k)) fail('Clerk is not told where to come back to: ' + k + ' is missing');
if (/Clerk\.load\(\{\}\)/.test(src))
  fail('Clerk is loaded with no configuration, so a sign in lands on the consumer landing page');

if (errs.length) fail('page errors ' + errs.slice(0, 2).join(' | '));
console.log('PASSED');
await b.close();
