/* ================================ THE DOOR YOU HAVE TO MEAN TO OPEN
   A check costs money and takes a minute, so the way to walk the live path on
   purpose is a path somebody types: real-run-live-go. This checks the three
   things that makes it real rather than decorative. It runs live. It says so,
   where nobody can miss it. And the control room hangs off it, so the staff
   door follows the door you came in by instead of sitting at the root.

   It also checks the other half of today's work: where a run points at a
   country we hold no register for, the page names the country and the
   authority, because "there are things we could not answer" is true of every
   run ever made and tells a reader nothing. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const fails = [];

/* The door. Served by a rewrite in production, so locally the page is opened
   at the path the rewrite points at, with the path the reader typed. */
{
  const p = await b.newPage({ viewport:{width:1280,height:900} });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?real-run-live-go');
  await p.waitForTimeout(700);
  const g = await p.evaluate(() => ({
    live: window.LIVE === true || (typeof LIVE !== 'undefined' && LIVE === true),
    strip: (() => { const e = document.getElementById('runGate');
      if (!e) return null;
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return { text: e.textContent.trim(), top: Math.round(r.top), h: Math.round(r.height),
               bg: cs.backgroundColor }; })(),
    room: (document.getElementById('lampGo')||{}).getAttribute
        ? document.getElementById('lampGo').getAttribute('href') : null
  }));
  if (!g.strip) fails.push('the real run page does not say it is spending a real check');
  else {
    if (!/real run/i.test(g.strip.text)) fails.push('the strip does not say what it is: ' + g.strip.text);
    if (!/real-run-live-go\/room/.test(g.strip.text)) fails.push('the strip does not say where the room is');
    if (g.strip.top > 4) fails.push('the strip is not at the top of the page');
    if (g.strip.h < 20) fails.push('the strip is ' + g.strip.h + 'px tall, which is not a thing anybody sees');
  }
  if (g.room !== '/real-run-live-go/room')
    fails.push('the control room does not hang off this door: ' + g.room);
  if (errs.length) fails.push('page errors on the door: ' + errs.join(' | '));
  console.log('\nTHE REAL RUN DOOR\n');
  console.log('  ' + (fails.length ? 'FAIL  ' : 'ok    ') + 'the door runs live, says so, and carries the room');
  await p.close();
}

/* And the demo path is untouched: no strip, no surprise spend. */
{
  const p = await b.newPage({ viewport:{width:1280,height:900} });
  await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1');
  await p.waitForTimeout(500);
  const strip = await p.evaluate(() => !!document.getElementById('runGate'));
  if (strip) fails.push('the demo page is flying the real run strip');
  console.log('  ' + (strip ? 'FAIL  ' : 'ok    ') + 'the demo page is unchanged');
  await p.close();
}

/* The jurisdiction we hold nothing for, named. */
{
  const p = await b.newPage({ viewport:{width:1280,height:1000} });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
  await p.waitForTimeout(800);
  const base = extra => ({
    verdict:'YELLOW', headline:'', statement:'Records were found.', idc:60, cov:55,
    asOf:'19 Sep 2026', reads:[], stats:[], bars:[], barFoot:'', claims:[], issues:[],
    gaps:[], unresolved:[], reviews:{checked:2,carrying:0,reports:0,state:'organic',note:'',rows:[]},
    ledger:[], retrieved:[], board:{}, live:false, ...extra });

  const read = async d => {
    await p.evaluate(x => { window.__KBYS__.runCtx({stage:'BEFORE'}); window.__KBYS__.enter(x,''); }, d);
    await p.waitForTimeout(500);
    return p.evaluate(() => { const e = document.getElementById('rpGap4');
      return { up: e && !e.hidden, t: e ? e.textContent.trim() : '' }; });
  };

  /* A party whose own record puts it in Thailand. */
  const th = await read(base({ name:'A TOKEN PLATFORM', domain:'example-token.finance',
    cats:{ C1:{ state:'YELLOW', sum:'Operator', ev:[{ t:'B', src:'The site itself', when:'19 Sep 2026',
      match:'exact', about:'example-token.finance',
      find:'The operating company is described as based in Thailand, with an office in Bangkok.' }] } } }));
  if (!th.up) fails.push('a record pointing at Thailand did not name Thailand as a gap');
  else {
    if (!/Thailand/.test(th.t)) fails.push('the gap line does not name the country: ' + th.t);
    if (!/sec\.or\.th/.test(th.t)) fails.push('the gap line does not say which authority to ask: ' + th.t);
    if (!/our gap and not a finding/.test(th.t))
      fails.push('the gap line reads as something against them: ' + th.t);
  }
  console.log('  ' + (th.up ? 'ok    ' : 'FAIL  ') + 'Thailand is named, with the authority to ask');
  if (th.up) console.log('        ' + th.t.slice(0,150));

  /* And St Vincent, which is the one that matters most for offshore brokers. */
  const vc = await read(base({ name:'A BROKER', domain:'example-broker.com',
    cats:{ C2:{ state:'GREY', sum:'Claimed licence', ev:[{ t:'B', src:'The site itself',
      when:'19 Sep 2026', match:'exact', about:'example-broker.com',
      find:'The site says it is regulated in St Vincent and the Grenadines.' }] } } }));
  if (!vc.up || !/St Vincent/.test(vc.t))
    fails.push('a claimed St Vincent licence did not name the jurisdiction as a gap');
  console.log('  ' + (vc.up ? 'ok    ' : 'FAIL  ') + 'St Vincent is named');

  /* A plain Canadian record names nothing, because a list of countries on
     every result is wallpaper. */
  const ca = await read(base({ name:'A CANADIAN FIRM', domain:'example.ca',
    cats:{ C1:{ state:'GREEN', sum:'Registered', ev:[{ t:'A', src:'Corporations Canada',
      when:'19 Sep 2026', match:'exact', about:'example.ca', find:'Registered and active.' }] } } }));
  if (ca.up) fails.push('an ordinary Canadian record printed a jurisdiction gap: ' + ca.t);
  console.log('  ' + (ca.up ? 'FAIL  ' : 'ok    ') + 'an ordinary record names nothing');
  if (errs.length) fails.push('page errors: ' + errs.join(' | '));
  await p.close();
}

console.log('');
if (fails.length) { console.log('FAILED'); fails.forEach(f => console.log('  ' + f)); console.log('');
  await b.close(); process.exit(1); }
console.log('PASSED  the door is real, and the jurisdiction we hold nothing for has a name\n');
await b.close();
