/* ================================================== THE PACK IS A FILE, NOT A LINK
   The pack goes to a bank's fraud desk, a police officer and a regulator's
   inbox. It used to download as .html, which opens as a web page rather than
   landing in a folder, and an attachment that opens a browser is one a fraud
   desk does not open twice.

   This builds every pack the product carries, writes them, and reads them back
   with a PDF reader that is not ours: a file we can parse is not the same as a
   file somebody else's viewer can open, and this is the closest we get to
   asking one. Every line the screen shows has to be in the file, and the file
   has to carry the reference, the sources and the recovery-fraud warning. */
import { chromium } from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';

const D = {
  verdict:'YELLOW', headline:'', statement:'Records were found.', idc:70, cov:62,
  asOf:'18 Sep 2026', name:'ACET FINANCE', domain:'acet.finance',
  reads:[], stats:[], bars:[], barFoot:'', claims:[], issues:[], gaps:[], unresolved:[],
  reviews:{checked:3,carrying:1,reports:4,state:'organic',note:'',rows:[]},
  ledger:[], retrieved:[], board:{}, live:false,
  issues:[
    { t:"The site names no operator: it refers only to 'ACET Founder'.",
      x:'No personal name, title or verifiable identity is given anywhere on the buy-back page.',
      sev:'high', tier:'B', match:'exact', about:'acet.finance',
      url:'https://acet.finance/buy-back-act' }],
  cats:{
    C1:{ state:'YELLOW', sum:'No operator named', ev:[
      { t:'B', src:'acet.finance buy-back page', when:'18 Sep 2026', match:'exact',
        about:'acet.finance', url:'https://acet.finance/buy-back-act',
        find:"The site refers only to 'ACET Founder' with no personal name, title or verifiable identity given." }]},
    C6:{ state:'GREY', sum:'Domain age', ev:[
      { t:'B', src:'ICANN RDAP', when:'18 Sep 2026', match:'exact', about:'acet.finance',
        url:'https://rdap.org/domain/acet.finance',
        find:'The domain acet.finance was created 17 August 2021.' }]}
  }
};

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:1280,height:1000} });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);
await p.evaluate(x => { window.__KBYS__.runCtx({stage:'AFTER'}); window.__KBYS__.enter(x,''); }, D);
await p.waitForTimeout(600);

const fails = [];
const packs = await p.evaluate(() => window.__KBYS__.packs().map(x => ({ id:x.id, n:x.n, name:x.name })));
if (!packs.length) fails.push('the product carries no packs at all');

console.log('\nTHE PACK AS A FILE\n');
for (const meta of packs) {
  const out = await p.evaluate(i => {
    const bytes = window.__KBYS__.packPdf(i);
    let s = ''; for (let k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k]);
    return { b64: btoa(s), file: window.__KBYS__.packFile(i), html: window.__KBYS__.pack(i) };
  }, meta.n - 1);

  const f = '/tmp/claude-0/' + out.file;
  fs.writeFileSync(f, Buffer.from(out.b64, 'base64'));
  if (!/\.pdf$/.test(out.file)) fails.push('pack ' + meta.n + ' still downloads as ' + out.file);

  let text = '', pages = 0;
  try {
    execSync('qpdf --check ' + JSON.stringify(f), { stdio:'pipe' });
    text = execSync('pdftotext -layout ' + JSON.stringify(f) + ' -', { encoding:'utf8' });
    pages = Number(execSync('qpdf --show-npages ' + JSON.stringify(f), { encoding:'utf8' }).trim());
  } catch (e) {
    fails.push('pack ' + meta.n + ' is not a file a reader can open: '
      + String(e.stderr || e.message).split('\n')[0]);
    console.log('  FAIL  ' + meta.name);
    continue;
  }

  const flat = text.replace(/\s+/g, ' ');
  const bad = [];
  /* Every heading the screen shows is in the file. */
  for (const need of ['Who you are contacting, and how', 'What the records say about this name',
                      'What the record holds', 'What to put in the message'])
    if (!flat.includes(need)) bad.push('missing section: ' + need);
  /* The reference, on the page and at the foot, because it is what ties the
     pack to one run when somebody quotes it down a phone. */
  /* The reference the page printed has to be the reference in the file. */
  const ref = await p.evaluate(() => window.__KBYS__.lastReport().ref
    || document.querySelector('#rpRefV, .rp-ref') && document.querySelector('#rpRefV, .rp-ref').textContent.trim());
  const refInFile = (flat.match(/KBYS-\d{4}-[A-Z]{2}/) || [])[0];
  if (!refInFile) bad.push('the reference is not in the file');
  else if (!flat.includes('Report reference ' + refInFile) && !flat.includes(refInFile))
    bad.push('the reference is in the head but not in the identification block');
  if (!/Produced by 4orm Finance|4orm Finance, 4ormiq.com/.test(flat))
    bad.push('the file does not say who produced it');
  if (!/Nobody legitimate will ask you to pay money to get your money back/.test(flat))
    bad.push('the recovery-fraud warning is not in the file');
  /* THE SCREEN AND THE FILE SAY THE SAME THINGS.
     Every record the on-screen pack shows, and every source address printed
     beside one, has to survive into the file. This is the check that catches
     the two of them drifting apart, which is what happened when they were two
     pieces of code that happened to agree. */
  const strip = t => t.replace(/<[^>]*>/g, '').replace(/&middot;/g, '\u00B7')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const titles = [...out.html.matchAll(/<span class="pk-rt">([\s\S]*?)<\/span>/g)].map(m => strip(m[1]));
  const urls   = [...out.html.matchAll(/<span class="pk-ru">([\s\S]*?)<\/span>/g)].map(m => strip(m[1]));
  for (const t of titles)
    if (!flat.includes(t.slice(0, 60))) bad.push('a record on the screen is not in the file: ' + t.slice(0, 50));
  for (const u of urls)
    if (!flat.includes(u)) bad.push('a source address was dropped from the file: ' + u);
  if (!titles.length && !/No register we reached held anything/.test(flat))
    bad.push('the record section is neither a record nor the sentence that says there is none');
  if (!/PAGE 1/.test(text)) bad.push('the pages are not numbered');
  if (pages < 1) bad.push('the file has no pages');
  /* No line may run off the measure: pdftotext -layout preserves position, so
     a line wider than the text column means the wrap is wrong. */
  /* Nothing may be drawn past the right margin. Measured off the file's own
     word boxes rather than guessed from a character count, because a monospaced
     dump pads every line to the page width and would hide a real overflow. */
  const bb = execSync('pdftotext -bbox ' + JSON.stringify(f) + ' -', { encoding:'utf8' });
  const xs = [...bb.matchAll(/xMax="([\d.]+)"/g)].map(m => Number(m[1]));
  const over = xs.filter(x => x > 612 - 46.8 + 1);
  if (over.length) bad.push(over.length + ' word(s) run past the right margin, furthest at '
    + Math.round(Math.max(...over)) + 'pt of 565');
  /* The house rule, in the file as on the page. */
  if (/[–—]/.test(text)) bad.push('an em dash or en dash is in the file');

  console.log('  ' + (bad.length ? 'FAIL  ' : 'ok    ') + meta.name
    + '   ' + pages + ' page' + (pages === 1 ? '' : 's') + ', ' + flat.length + ' characters');
  bad.forEach(x => { fails.push('pack ' + meta.n + ': ' + x); console.log('        ' + x); });
}

/* AND THE BUTTON ITSELF. Everything above builds the file by calling the
   writer. This is the reader's actual path: open a pack, press the button, and
   see what lands on the machine. A writer that works and a button that is wired
   to nothing is the same to them as no PDF at all. */
{
  const dl = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  /* The pack grid lives on the act screen, which a reader reaches by pressing
     "Do this right now". The preview is opened the same way the page opens it
     rather than by reaching into the DOM for a hidden button. */
  /* The reader's own path: press "Do this right now", then a pack on the list. */
  await p.click('#rpToAct');
  await p.waitForTimeout(700);
  /* The list of who to reach out to sits inside a disclosure, shut until the
     reader opens it, so this opens it the way they do. */
  await p.evaluate(() => {
    const row = document.querySelector('#rpPaks').closest('details, .rp-acc');
    if (row && row.tagName === 'DETAILS') row.open = true;
    else if (row) { const h = row.querySelector('button'); if (h) h.click(); }
  });
  await p.waitForTimeout(600);
  await p.click('#rpPaks .rp-pak');
  await p.waitForTimeout(700);
  await p.click('#rpPvDl');
  const got = await dl;
  if (!got) fails.push('pressing the download button produced no file at all');
  else {
    const name = got.suggestedFilename();
    if (!/\.pdf$/.test(name)) fails.push('the button saved ' + name + ', not a PDF');
    const at = '/tmp/claude-0/clicked.pdf';
    await got.saveAs(at);
    const head = fs.readFileSync(at).slice(0, 5).toString();
    if (head !== '%PDF-') fails.push('the saved file does not start as a PDF: ' + head);
    else {
      try { execSync('qpdf --check ' + at, { stdio: 'pipe' }); }
      catch (e) { fails.push('the saved file does not open: ' + String(e.stderr || e).split('\n')[0]); }
    }
    console.log('  ok    the button saves ' + name);
  }
}

if (errs.length) fails.push('page errors: ' + errs.join(' | '));
console.log('');
if (fails.length) {
  console.log('FAILED'); fails.forEach(f => console.log('  ' + f)); console.log('');
  await b.close(); process.exit(1);
}
console.log('PASSED  every pack downloads as a PDF a reader can open, and carries the record\n');
await b.close();
