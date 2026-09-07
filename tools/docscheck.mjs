/* ==================================================== THE DOCUMENT REGISTRY
   Eleven control documents, read in full from the board.

   The checks here are about the mechanism and about honesty, in that order:
   every document opens, every document renders its own words, and the state
   the screen prints beside a document is the same state the lamps read. The
   last block is different: it compares what a document SAYS about itself
   against what the board RECORDS about it, and reports the disagreements. It
   does not resolve them, because a release posture is a person's decision and
   a build check that quietly changed one would be the exact failure this
   product exists to refuse.
   ====================================================================== */
import { chromium } from 'playwright';

const fails = [], warn = [];
const say = (label, ok, detail) => {
  console.log('  ' + (ok ? 'ok   ' : 'FAIL ') + label + (detail === undefined ? '' : '  |  ' + detail));
  if (!ok) fails.push(label);
};

const KEYS = ['lr','mg','vend','hra','pub','sub','ir','ret','sec','cou','pia'];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await p.goto('file://' + process.cwd() + '/admin.html?demo=1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1100);

console.log('\nTHE WAY IN');
say('the board carries a control that opens the documents',
  await p.evaluate(() => !!document.getElementById('docbtn')));
say('the registry is shut, inert and hidden before it is asked for',
  await p.evaluate(() => { const e = document.getElementById('docreg');
    return e.hasAttribute('hidden') && e.hasAttribute('inert') && !e.classList.contains('on'); }));
await p.click('#docbtn'); await p.waitForTimeout(400);
say('it opens', await p.evaluate(() => document.getElementById('docreg').classList.contains('on')));
say('and the board underneath is not reachable while it is up',
  await p.evaluate(() => document.getElementById('fit').hasAttribute('inert')));
/* IT MUST NOT BE SCALED. The board is a fixed 1920 stage scaled to fit, so
   anything inside it renders at three quarters size on a 1440 screen. A
   thirty page standard at 11px is a document nobody reads. */
say('it is outside the stage, so the type is the size it says it is',
  await p.evaluate(() => !document.getElementById('stage').contains(document.getElementById('docreg'))));

console.log('\nTHE LIST');
const list = await p.evaluate(() => ({
  rows: document.querySelectorAll('#docreg .drrow').length,
  ids: [...document.querySelectorAll('#docreg .drid')].map(e => e.textContent.trim()),
  posture: (document.querySelector('#docreg .drpost') || { textContent: '' }).textContent
}));
say('all eleven are listed', list.rows === 11, list.rows + ': ' + list.ids.join(' '));
/* The posture is quoted from PACKAGE-001 rather than written on this screen,
   and it is the first thing on it. */
say('the release posture is quoted before any document is opened',
  /NOT READY FOR UNCONDITIONAL PUBLIC LAUNCH/.test(list.posture)
  && /PACKAGE-001/.test(list.posture));

console.log('\nEVERY DOCUMENT, IN FULL');
const seen = [];
for (const k of KEYS) {
  await p.evaluate(x => drOpen(x, false), k); await p.waitForTimeout(90);
  const card = await p.evaluate(() => ({
    title: document.getElementById('drT').textContent.trim(),
    state: (document.querySelector('#docreg .drcard .drstate') || { textContent: '' }).textContent.trim(),
    quotes: document.querySelectorAll('#docreg .drq').length,
    secs: document.querySelectorAll('#docreg .drsec').length,
    full: !!document.getElementById('drFull')
  }));
  await p.evaluate(x => drOpen(x, true), k); await p.waitForTimeout(120);
  const doc = await p.evaluate(() => {
    const d = document.querySelector('#docreg .drdoc');
    return { words: d ? (d.innerText || '').trim().split(/\s+/).filter(Boolean).length : 0,
             heads: document.querySelectorAll('#docreg .drdoc h1,#docreg .drdoc h2').length,
             tables: document.querySelectorAll('#docreg .drdoc table').length,
             overflowX: document.documentElement.scrollWidth - window.innerWidth };
  });
  seen.push({ k, ...card, ...doc });
  console.log('   ' + k.padEnd(5) + String(doc.words).padStart(6) + ' words  '
    + String(doc.heads).padStart(3) + ' headings  ' + String(doc.tables).padStart(3) + ' tables  '
    + card.state.padEnd(20) + card.title);
  if (!card.full) fails.push(k + ' has no way through to the document itself');
  if (!card.secs) fails.push(k + ' lists none of its own sections');
  if (doc.words < 300) fails.push(k + ' renders only ' + doc.words + ' words, so it is not the document');
  if (doc.overflowX > 0) fails.push(k + ' makes the page scroll sideways by ' + doc.overflowX + 'px');
}
say('every one of the eleven renders its own text', !fails.length,
  seen.reduce((a, s) => a + s.words, 0) + ' words in total');

console.log('\nTHE SCREEN AND THE LAMPS AGREE');
/* The state beside a document here and the state on its lamp are read from
   the same rows. If they ever came apart, the board and the shelf would be
   telling an operator two different things about the same document. */
const agree = await p.evaluate(() => {
  const W = { ok: 'Signed off', warn: 'Written, not signed', bad: 'NO-GO on file' };
  return drDocs().filter(d => d.k !== 'pia').map(d => {
    const row = BOARD_ROWS['f:' + d.k];
    return { k: d.k, screen: d.s, lamp: row ? row.s : null, word: W[d.s] };
  });
});
const apart = agree.filter(a => a.screen !== a.lamp);
say('the state on every document matches the lamp behind it', apart.length === 0,
  apart.length ? JSON.stringify(apart) : agree.length + ' checked');

console.log('\nWHAT THE DOCUMENTS SAY ABOUT THEMSELVES');
/* NOT A PASS OR A FAIL. A document that carries NO-GO on its own cover and is
   recorded as amber is a disagreement between the shelf and the record, and
   somebody has to decide which is right. This names them so the decision gets
   made by a person rather than left to whichever screen is being read. */
const said = await p.evaluate(() => {
  const out = [];
  Object.keys(DOCTEXT).forEach(k => {
    const t = DOCTEXT[k];
    /* A DECISION ABOUT ITSELF, not a mention of NO-GO anywhere in the text.
       The first pass matched any line carrying the word, which caught PUB-001
       saying "PIA-001, HRA-001 or MG-001 remains NO-GO" (a condition about
       other documents) and SUB-001 saying "NO-GO for unproven objective
       claims" (a rule about claims). Neither is that document's own release
       decision. This wants a decision header with NO-GO immediately on it,
       which is how these covers are written. */
    const own = (t.hi || []).filter(h =>
      /\b(CURRENT\s+(?:\w+\s+){0,2}(?:DECISION|POSITION|POSTURE)|(?:\w+\s+)?RELEASE\s+DECISION|\w+\s+DECISION)\s*[:\u2013-]?\s*NO-GO\b/i.test(h));
    const d = drDocs().filter(x => x.k === k)[0];
    if (own.length && d && d.s !== 'bad')
      out.push({ id: t.id, state: d.s, line: own[0].slice(0, 150) });
  });
  return out;
});
if (said.length) {
  said.forEach(x => {
    console.log('  note  ' + x.id + ' is recorded as ' + x.state
      + ' and its own text says:\n           "' + x.line + '"');
    warn.push(x.id + ' carries NO-GO in its own words and the board records it as ' + x.state);
  });
} else console.log('  ok   no document contradicts the state recorded for it');

say('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

await b.close();
if (warn.length) {
  console.log('\nFOR A PERSON TO DECIDE  (' + warn.length + ')');
  warn.forEach(w => console.log('  ' + w));
  console.log('  Nothing was changed. _documents.js sets bad for a document that "records a\n'
    + '  NO-GO or an open blocker that stops release". Either these rows move to bad, or\n'
    + '  the reason they should not is written into the file beside them.');
}
if (fails.length) { console.log('\nFAILED\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\nPASSED');
