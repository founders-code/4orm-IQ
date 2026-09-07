/* ============================================================ THE UX GATE
 *
 * The UX-001 review found six barriers on a page everybody had looked at
 * many times, and not one of them was findable by looking. They were a
 * computed contrast ratio, a measured pixel height, a walked tab order and
 * a heading count. So this file measures rather than inspects, and it runs
 * on every build.
 *
 * THE BUDGET, AND WHY IT IS A BUDGET RATHER THAN A PASS.
 *
 * Some of what the review found is fixed and some is open, and calling an
 * open failure a pass is the exact move the standard forbids. So the gate
 * carries a recorded count of what is still wrong, in tools/ux-budget.json,
 * and fails when a number goes UP. A regression breaks the build the day it
 * lands. A fix prints a line telling you to lower the budget, and the number
 * can only ever travel one way.
 *
 * A budget entry is never raised to make a build pass. If a change genuinely
 * needs a higher number, that is a design decision with an owner, and it goes
 * in the file with a reason beside it.
 *
 *   node tools/uxgate.mjs            measure, compare, exit non-zero on a rise
 *   node tools/uxgate.mjs --record   write what it measured as the new budget
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const BUDGET = path.join(root, 'tools', 'ux-budget.json');
const RECORD = process.argv.includes('--record');
const FILE = p => 'file://' + path.join(root, p);

/* ------------------------------------------------------------- the probe
   Everything below runs inside the page. It reads computed style, because a
   colour written in the stylesheet is not the colour that lands on the
   screen once inheritance, opacity and a gradient have had their turn. */
const PROBE = `(() => {
  const px = v => parseFloat(v) || 0;
  const lum = c => { const [r,g,b] = c.map(v => { v/=255;
    return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); });
    return .2126*r + .7152*g + .0722*b; };
  const parse = s => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x));
    return { c:[p[0],p[1],p[2]], a: p.length>3 ? p[3] : 1 }; };
  /* the first ancestor that actually paints, which is the colour the text
     is really sitting on */
  const bgOf = el => { let n = el;
    while (n && n !== document.documentElement) {
      const b = parse(getComputedStyle(n).backgroundColor);
      if (b && b.a > .85) return b.c; n = n.parentElement; }
    return [255,255,255]; };
  const ratio = (f,b) => { const A = Math.max(lum(f),lum(b)), Z = Math.min(lum(f),lum(b));
    return (A + .05) / (Z + .05); };
  const vis = el => { const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || px(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  /* shut means shut: inert or aria-hidden or display:none or transparent */
  const buried = el => { let n = el;
    while (n && n !== document.documentElement) {
      if (n.hasAttribute && (n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true'
          || n.hasAttribute('hidden'))) return true;
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || px(s.opacity) === 0) return true;
      n = n.parentElement; }
    return false; };

  window.__uxVisible = el => vis(el) && !buried(el);
  const out = { contrast: [], targets: [], unnamed: [], phantom: [], noring: [], heads: [] };

  /* 1. TEXT CONTRAST. WCAG 1.4.3 AA. */
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set(); let t;
  while ((t = walk.nextNode())) {
    const s = t.nodeValue.trim(); if (s.length < 3) continue;
    const el = t.parentElement; if (!el || seen.has(el) || !vis(el)) continue; seen.add(el);
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue;
    const size = px(cs.fontSize), w = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && w >= 700);
    const r = ratio(fg.c, bgOf(el)), need = large ? 3 : 4.5;
    if (r < need) out.contrast.push(r.toFixed(2) + ':1 need ' + need + '  ' + size + 'px w' + w
      + '  ' + (el.id ? '#'+el.id : el.tagName.toLowerCase()) + '  "' + s.slice(0,44) + '"');
  }

  /* 2 to 4. EVERY INTERACTIVE ELEMENT THE EYE CAN SEE.
     Keyboard reachability and the focus ring are NOT measured here. A
     tabIndex is a property, not a statement about whether the browser will
     ever land on the element, and :focus-visible does not match a
     programmatic focus() call. Both are walked for real, outside the page,
     by pressing Tab. Measuring them in here gave 208 phantoms on a page
     that has none. */
  const Q = 'a[href],button,input,select,textarea,[role="button"],[role="tab"],[role="link"]';
  [...document.querySelectorAll(Q)].forEach(el => {
    if (!vis(el) || el.disabled) return;
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.getAttribute('title')
      || el.innerText || el.value || '').trim().replace(/\\s+/g,' ');
    const who = (el.tagName.toLowerCase() + (el.id ? '#'+el.id : '')) + ' "' + name.slice(0,30) + '"';

    /* TARGET SIZE. WCAG 2.2 SC 2.5.8, the 24px minimum. The 44px 4orm
       default is a separate and stricter house rule, counted apart. */
    if (Math.min(r.width, r.height) < 24)
      out.targets.push(who + '  ' + Math.round(r.width) + 'x' + Math.round(r.height));

    /* NAME. WCAG 4.1.2. */
    if (!name && !el.getAttribute('aria-labelledby')) out.unnamed.push(who);
  });

  /* 6. HEADING OUTLINE. WCAG 1.3.1. A long screen with one heading cannot
        be navigated by anybody using headings to navigate. */
  out.heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis)
    .map(h => h.tagName[0].toLowerCase() + h.tagName[1] + ' ' + h.innerText.trim().replace(/\\s+/g,' ').slice(0,60));
  out.textRuns = seen.size;
  out.h1s = out.heads.filter(h => h.startsWith('h1')).length;
  out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return out;
})()`;

/* ------------------------------------------------------------ the scenes
   One entry per screen the gate walks. Each says how to get there, because
   a stage that is only reachable by running a real check has to be reached
   by running a real check. */
const SCENES = [
  { key:'landing', page:'index.html?demo=1', widths:[1440,390,320], reach: async () => {} },
  { key:'waiting', page:'index.html?demo=1', widths:[1440,390],
    reach: async p => { await p.fill('#kbInput','Meridian Yield Partners'); await p.click('#kbGo');
      await p.waitForTimeout(2200); await tap(p,'investment'); await p.waitForTimeout(1400);
      await tap(p,'already sent money'); await p.waitForTimeout(1400); } },
  { key:'report',  page:'index.html?demo=1', widths:[1440,390,320],
    reach: async p => { await p.fill('#kbInput','Meridian Yield Partners'); await p.click('#kbGo');
      await p.waitForTimeout(2200); await tap(p,'investment'); await p.waitForTimeout(1400);
      await tap(p,'already sent money');
      for (let i=0;i<14;i++){ await p.waitForTimeout(1500);
        if (await p.evaluate(() => document.body.getAttribute('data-stage') === 'report')) break; }
      await p.waitForTimeout(1200); } },
  { key:'backoffice', page:'admin.html?demo=1', widths:[1440], reach: async p => { await p.waitForTimeout(900); } },
];

const tap = (p, re) => p.evaluate(r => { const b = [...document.querySelectorAll('button')]
  .find(x => x.offsetParent && new RegExp(r,'i').test(x.innerText)); if (b) { b.click(); return 1; } return 0; }, re);

/* ------------------------------------------------------------ the tab walk
   The two things that cannot be measured from inside the page. A tabIndex
   says nothing about whether the browser will land on an element, and
   :focus-visible does not match a focus() call from script, so both are
   walked here by pressing the key a person would press.

   A PHANTOM is a stop the eye cannot see: focus lands somewhere that is
   inert, aria-hidden, display:none, transparent or off the layout. That is
   the barrier the review found, where tabbing off the search box walked a
   reader through nine controls that were not on the screen.

   The walk stops when it returns to a stop it has already made, because the
   tab order is a ring and walking it twice measures nothing new. */
const MAX_STOPS = 120;
async function tabWalk(p) {
  await p.evaluate(() => { document.body.setAttribute('tabindex','-1'); document.body.focus(); });
  const phantom = [], noring = [], seen = new Set();
  let stops = 0;
  for (let i = 0; i < MAX_STOPS; i++) {
    await p.keyboard.press('Tab');
    /* A control with transition:all animates its outline-width from 0, and
       reading it on the same tick reports no ring on a control that has one.
       The wait is the transition, not a guess: the house easing is .18s. */
    await p.waitForTimeout(210);
    const s = await p.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) return null;
      const cs = getComputedStyle(a), r = a.getBoundingClientRect();
      const name = (a.getAttribute('aria-label') || a.getAttribute('title')
        || a.innerText || a.value || '').trim().replace(/\s+/g,' ');
      const key = a.tagName.toLowerCase() + (a.id ? '#'+a.id : '') + '|' + name.slice(0,24);
      const onLayout = r.width > 0 && r.height > 0;
      return { key, who: key.replace('|',' "') + '"',
        seenByEye: (window.__uxVisible ? window.__uxVisible(a) : onLayout) && onLayout,
        ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
              || (cs.boxShadow && cs.boxShadow !== 'none') };
    });
    if (!s) continue;
    if (seen.has(s.key)) break;
    seen.add(s.key); stops++;
    if (!s.seenByEye) phantom.push(s.who);
    else if (!s.ring)  noring.push(s.who);
  }
  await p.evaluate(() => document.body.removeAttribute('tabindex'));
  return { phantom, noring, stops };
}

/* -------------------------------------------------------------- the run */
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const measured = {}, detail = {}, pageErrors = [];

for (const scene of SCENES) {
  for (const width of scene.widths) {
    const p = await browser.newPage({ viewport:{ width, height: width < 500 ? 844 : 900 } });
    p.on('pageerror', e => pageErrors.push(scene.key + '@' + width + ': ' + String(e).split('\n')[0]));
    await p.goto(FILE(scene.page));
    await p.waitForTimeout(1400);
    await scene.reach(p);
    const r = await p.evaluate(PROBE);
    Object.assign(r, await tabWalk(p));
    const id = scene.key + '@' + width;
    measured[id] = { contrast:r.contrast.length, targets:r.targets.length, unnamed:r.unnamed.length,
      phantom:r.phantom.length, noring:r.noring.length, headings:r.heads.length, stops:r.stops,
      h1s:r.h1s, textRuns:r.textRuns, overflow: Math.max(0, r.overflow) };
    detail[id] = r;
    await p.close();
  }
}
await browser.close();

/* ------------------------------------------------------------ the verdict */
const HARD = ['phantom','unnamed','overflow'];   /* fixed, and must stay at zero */
const label = {
  contrast:'text below AA contrast', targets:'targets under 24px', unnamed:'controls with no name',
  phantom:'controls reachable while shut', noring:'controls with no focus ring',
  headings:'visible headings', h1s:'h1 elements', overflow:'horizontal overflow px',
  textRuns:'text runs', stops:'tab stops',
};

if (RECORD) {
  fs.writeFileSync(BUDGET, JSON.stringify({
    note: 'Recorded ceilings, not targets. A number may fall and may never rise. '
        + 'Raising one is a design decision with an owner, not a way past a red build.',
    recorded: new Date().toISOString().slice(0,10),
    scenes: measured }, null, 2) + '\n');
  console.log('recorded ' + Object.keys(measured).length + ' scenes to tools/ux-budget.json');
  process.exit(0);
}

if (!fs.existsSync(BUDGET)) {
  console.error('No budget recorded. Run: node tools/uxgate.mjs --record');
  process.exit(1);
}
const budget = JSON.parse(fs.readFileSync(BUDGET,'utf8')).scenes;

const rises = [], falls = [], missing = [];
for (const id of Object.keys(measured)) {
  if (!budget[id]) { missing.push(id); continue; }
  for (const k of ['contrast','targets','unnamed','phantom','noring','overflow']) {
    const now = measured[id][k], was = budget[id][k];
    if (now > was) rises.push({ id, k, was, now, hard: HARD.includes(k) });
    else if (now < was) falls.push({ id, k, was, now });
  }
  /* a screen that loses its headings is a screen that stopped being navigable */
  if (measured[id].headings < budget[id].headings)
    rises.push({ id, k:'headings', was:budget[id].headings, now:measured[id].headings, hard:false, fewer:true });
}

console.log('\n4orm UX gate');
for (const id of Object.keys(measured)) {
  const m = measured[id];
  console.log('  ' + id.padEnd(18)
    + ' contrast ' + String(m.contrast).padStart(3)
    + ' | targets ' + String(m.targets).padStart(3)
    + ' | no-ring ' + String(m.noring).padStart(3)
    + ' | phantom ' + String(m.phantom).padStart(2)
    + ' | unnamed ' + String(m.unnamed).padStart(2)
    + ' | headings ' + String(m.headings).padStart(3)
    + ' | stops ' + String(m.stops).padStart(3)
    + ' | runs ' + String(m.textRuns).padStart(4));
}

if (falls.length) {
  console.log('\nBetter than the budget. Lower it, so the ground you took is held.');
  falls.forEach(f => console.log('  ' + f.id + '  ' + label[f.k] + '  ' + f.was + ' -> ' + f.now));
  console.log('  node tools/uxgate.mjs --record');
}
if (missing.length) console.log('\nNo budget for: ' + missing.join(', ') + '  (record one)');
if (pageErrors.length) { rises.push({ id:'any', k:'page errors', was:0, now:pageErrors.length, hard:true });
  console.log('\nPage errors'); pageErrors.slice(0,6).forEach(e => console.log('  ' + e)); }

if (rises.length) {
  console.log('\nFAILED');
  rises.forEach(r => console.log('  ' + r.id + '  ' + (label[r.k] || r.k) + '  '
    + r.was + ' -> ' + r.now + (r.hard ? '   (this one was fixed and must stay fixed)' : '')
    + (r.fewer ? '   (headings were lost)' : '')));
  console.log('\nWhat the new ones are:');
  for (const r of rises.slice(0,4)) {
    const d = detail[r.id]; if (!d || !d[r.k]) continue;
    d[r.k].slice(0,6).forEach(x => console.log('  ' + x));
  }
  console.log('\nA budget is never raised to turn this green. Fix it, or record the'
    + '\nchange as a decision with an owner.\n');
  process.exit(1);
}

console.log('\nPASSED  nothing got worse\n');
