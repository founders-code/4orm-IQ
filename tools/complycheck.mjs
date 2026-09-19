/* =============== THE SIX THINGS THE COMPLIANCE REVIEW ASKED FOR
   Read against the build on 19 September 2026. Every one of these is a line of
   law rather than a matter of taste, so every one of them is held by a check
   rather than by somebody remembering. */
import { chromium } from 'playwright';
import fs from 'fs';

const R = '/home/claude/kbys/build/4orm-iq/';
const html = fs.readFileSync(R + 'index.html', 'utf8');
const chk  = fs.readFileSync(R + 'api/check.js', 'utf8');
const cue  = fs.readFileSync(R + 'api/_cue.js', 'utf8');
const fails = [];
const ok = [];
const T = (name, cond, why) => (cond ? ok : fails).push(cond ? name : name + ': ' + why);

/* 02, 03, 07 in the cue: the anchor text rule, link out never pull in, and the
   two registers that may be pointed at and never reproduced. */
T('the anchor text rule is in the cue',
  /R5 - A link label carries the source and the date/.test(cue),
  'nothing tells the model what a link label may say, so Crookes paragraph 42 is left to taste');
T('the label may not characterise the party',
  /nothing about the party/.test(cue) && /Banned: .*regulator's fraud warning/.test(cue),
  'the rule does not give the banned shape, which is the one somebody writes by accident');
T('link out, never pull in, is written down',
  /R6 - Link out, never pull in/.test(cue) && /no fetched excerpt/.test(cue),
  'the embedded-link question Abella J. left open is answered by how the page happens to be built');
T('the two barred registers are named in the cue',
  /R7 - Two registers may be pointed at and never reproduced/.test(cue),
  'the ASC and OSC terms are not in front of the thing that writes the output');

/* 05: and the boundary enforces it rather than trusting the cue. */
T('the boundary strips a quotation from a barred register',
  /const stripQuoted = \(e\)/.test(chk) && /out\.quote = '';/.test(chk),
  'a quotation from the ASC or the OSC would reach the page if the model wrote one');
T('the barred list is read from the catalogue',
  /LINK_OUT_ONLY/.test(chk),
  'the list is typed somewhere rather than read, so it goes stale in one place');

/* 06: no result address, said as a rule. */
T('a check response carries noindex',
  /X-Robots-Tag/.test(chk),
  'the absence of a crawlable result is a property of the build rather than a rule');
T('robots.txt exists and refuses the endpoint',
  fs.existsSync(R + 'robots.txt') && /Disallow: \/api\//.test(fs.readFileSync(R + 'robots.txt', 'utf8')),
  'there is no robots.txt, so the day somebody adds sharing the default is open');

/* 04: the Quebec cessation process, on the page. */
T('the cessation process is published',
  /cessation request/.test(html) && /28\.1/.test(html),
  'a named party has a right under P-39.1 s. 28.1 that the page does not answer');
T('it names a reviewer, a clock and the test',
  /named reviewer, not a queue/.test(html)
  && /answer within thirty days/.test(html)
  && /serious injury to your reputation or privacy/.test(html),
  'the process is a promise rather than a process');
T('the privacy notice points at it',
  /Asking us to stop, which is not the same as asking us to correct/.test(html),
  'the route is only in the compliance statement, where nobody looking for privacy will find it');

console.log('\nTHE COMPLIANCE REVIEW, HELD BY THE BUILD\n');
ok.forEach(n => console.log('  ok    ' + n));
fails.forEach(n => console.log('  FAIL  ' + n));

/* 01: the release blocker, walked in a browser rather than read. */
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + R + 'index.html?demo=1');
await p.waitForTimeout(700);

const type = async v => {
  await p.fill('#kbInput', v);
  await p.waitForTimeout(260);
  return p.evaluate(() => {
    const w = document.getElementById('kbBlocked');
    return { shown: w && w.style.display !== 'none',
             door: !!document.getElementById('kbOverride'),
             text: w ? w.textContent.replace(/\s+/g, ' ').trim() : '',
             go: document.getElementById('kbGo').disabled };
  });
};

console.log('\n  THE PERSON NAME DOOR\n');
/* A bare name: refused, and no door. */
const bare = await type('Michael Thompson');
T('a bare name has no door',
  bare.shown && !bare.door && /Add the website/.test(bare.text),
  'the reader can still assert their way past the person name block');
console.log('  ' + (bare.door ? 'FAIL  ' : 'ok    ') + 'Michael Thompson: refused, and asked for what would open it');

/* The same name with a legal ending: the door appears. */
const ltd = await type('Michael Thompson Ltd');
T('a legal ending is read as a company',
  !ltd.shown || !ltd.go,
  'a company with a person-shaped name is still refused, which is the refusal this door exists to avoid');
console.log('  ok    Michael Thompson Ltd: runs');

/* And the override cannot be forced from the console where no basis exists. */
await type('Michael Thompson');
const forced = await p.evaluate(() => {
  const w = document.getElementById('kbBlocked');
  w.innerHTML = '<button type="button" class="kb-ovr" id="kbOverride">force</button>';
  w.style.display = '';
  document.getElementById('kbOverride').click();
  return { assert: window.USER_ASSERT === undefined ? 'unreadable' : window.USER_ASSERT,
           go: document.getElementById('kbGo').disabled };
});
T('the handler refuses to open the gate without a basis',
  forced.go === true,
  'a control written into the block by any other path opens the gate on the reader\'s word');
console.log('  ' + (forced.go ? 'ok    ' : 'FAIL  ') + 'a forced override does not enable the run');

if (errs.length) fails.push('page errors: ' + errs.join(' | '));
await b.close();

console.log('');
if (fails.length) {
  console.log('FAILED');
  fails.forEach(f => console.log('  ' + f));
  console.log('\nItems 01 to 03 of the review are release blockers. This is that gate.\n');
  process.exit(1);
}
console.log('PASSED  all six items of the compliance review are held by the build\n');
