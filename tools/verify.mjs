/**
 * 4orm IQ build check.
 *
 *   node tools/verify.mjs [path/to/previous/index.html]
 *
 * Every check here exists because the thing it looks for actually shipped broken
 * at least once. The declaration diff in particular: removing an inline panel
 * silently took a variable with it twice, and the page died on load with a blank
 * console and no error anyone could see.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '';
const fails = [];
const warn = [];

/* ---------------------------------------------------------------- syntax */
try {
  new Function(script);
} catch (e) {
  fails.push('the inline script does not parse: ' + e.message);
}

/* ------------------------------------------------------------ duplicates */
const ids = [...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]);
const dupIds = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
if (dupIds.length) fails.push('duplicate element ids: ' + dupIds.join(', '));

const fns = [...script.matchAll(/(?:^|\n)[ \t]*function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
const dupFns = [...new Set(fns.filter((v, i) => fns.indexOf(v) !== i))];
if (dupFns.length) fails.push('duplicate function names, the later one silently wins: ' + dupFns.join(', '));

/* --------------------------------------------------------- dead references */
/* Function expressions assigned to a name shadow a declaration just as
   silently, so they are counted too. */
const fnExprs = [...script.matchAll(/(?:^|\n)[ \t]*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function\b/g)].map(m => m[1]);
const allFns = fns.concat(fnExprs);
const dupAll = [...new Set(allFns.filter((v, i) => allFns.indexOf(v) !== i))];
if (dupAll.length && !dupFns.length)
  fails.push('a name is declared as both a function and a function expression: ' + dupAll.join(', '));

const topVars = [...script.matchAll(/(?:^|\n)var\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
const dupVars = [...new Set(topVars.filter((v, i) => topVars.indexOf(v) !== i))];
if (dupVars.length) fails.push('duplicate top level var names, the later one silently wins: ' + dupVars.join(', '));
const idRefs = [...new Set([...script.matchAll(/\bid\("([A-Za-z0-9_-]+)"\)/g)].map(m => m[1]))];
const missing = idRefs.filter(r => !ids.includes(r));
if (missing.length) fails.push('script reaches for elements that do not exist: ' + missing.join(', '));

/* -------------------------------------------------------------- anchors */
const anchors = [...new Set([...html.matchAll(/href="#([A-Za-z0-9_-]+)"/g)].map(m => m[1]))];
const deadAnchors = anchors.filter(a => !ids.includes(a));
if (deadAnchors.length) fails.push('anchors pointing nowhere: ' + deadAnchors.join(', '));

/* -------------------------------------------- the silent override check
   Three outages in this project came from the same shape: the same property
   declared twice on the same selector inside the same at-rule, where the later
   one wins and nothing errors. This walks every rule block in the stylesheet
   and reports any selector that sets a layout property more than once at the
   same breakpoint. */
const styleBlock = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || '';
{
  const WATCH = ['grid-template-columns','grid-template-rows','display','position',
                 'transform','flex-direction','width','max-width'];
  const seen = new Map();          /* "media||selector||prop" -> count */
  let media = '';
  let depth = 0;
  const src = styleBlock;
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf('@media', i);
    const brace = src.indexOf('{', i);
    if (brace < 0) break;
    if (at >= 0 && at < brace) {
      media = src.slice(at, brace).replace(/\s+/g, ' ').trim();
      i = brace + 1; depth = 1;
      continue;
    }
    const selector = src.slice(i, brace).replace(/\s+/g, ' ').trim().replace(/^\}+/, '').trim();
    const close = src.indexOf('}', brace);
    if (close < 0) break;
    const body = src.slice(brace + 1, close);
    if (selector && !selector.startsWith('@')) {
      selector.split(',').map(x => x.trim()).filter(Boolean).forEach(sel => {
        WATCH.forEach(prop => {
          const n = (body.match(new RegExp('(?:^|;|\\s)' + prop + '\\s*:', 'g')) || []).length;
          if (!n) return;
          const key = (depth ? media : '') + '||' + sel + '||' + prop;
          seen.set(key, (seen.get(key) || 0) + n);
        });
      });
    }
    i = close + 1;
    if (depth && src.slice(i, i + 2).trim().startsWith('}')) { depth = 0; media = ''; i = src.indexOf('}', i) + 1; }
  }
  const clashes = [...seen.entries()].filter(([, n]) => n > 1)
    .map(([k]) => { const [m, sel, prop] = k.split('||'); return (m ? m + ' ' : '') + sel + ' { ' + prop + ' }'; });
  if (clashes.length) fails.push('a layout property is declared more than once on the same selector, the later one silently wins:\n      ' + clashes.join('\n      '));
}


/* ======================================================================
   OPS-001 s.23 OUTPUT VALIDATOR AND PIA-001 CONTROLS

   Every check below names the clause it enforces. A control that lives only in
   a document is a control nobody can prove, and every one of these was proved
   by putting the prohibited thing back and watching the suite fail.
   ====================================================================== */
{
  const src = html;

  /* PIA-001 s.20 / OPS-001 s.8: person name and phone-for-person-lookup are
     not permitted inputs. */
  if (/ID_TYPES\s*=\s*\[[^\]]*"Person"/.test(src))
    fails.push('OPS-001 s.8: "Person" is offered as a search type again');
  if (/ID_TYPES\s*=\s*\[[^\]]*"Phone"/.test(src))
    fails.push('OPS-001 s.8: "Phone" is offered as a search type again');
  if (/placeholder="[^"]*person[^"]*"/i.test(src))
    fails.push('OPS-001 s.8: the search box still invites a person name');

  /* The gate blocks the input. It cannot block the copy above the input, and
     for two weeks the landing page offered "a company, person, website, email,
     phone number or wallet" while the box refused two of the six. A reader who
     accepted the invitation was turned away by the product that made it.

     So: no landing copy, no meta description, and no headline may name a
     blocked type, and the sentence that lists what the box takes is generated
     from ID_TYPES rather than typed. */
  {
    const head = (src.match(/<meta name="description"[^>]*>/i) || [''])[0];
    const landing = (src.match(/class="cb(deck|sub)[^"]*"[^>]*>([^<]*)</g) || []).join(' ');
    const hero = (src.match(/<h1[\s\S]*?<\/h1>/gi) || []).join(' ');
    for (const [word, why] of [
      ['person', 'a person name is not an accepted input'],
      ['phone',  'a phone lookup is not an accepted input'],
    ]) {
      const re = new RegExp('\\b' + word, 'i');
      if (re.test(head))    fails.push('the meta description offers "' + word + '": ' + why);
      if (re.test(landing)) fails.push('landing copy offers "' + word + '": ' + why);
      if (re.test(hero))    fails.push('the headline offers "' + word + '": ' + why);
    }
    if (!/id="kbAccepts"/.test(src))
      fails.push('the accepted-types sentence is typed again instead of generated from ID_TYPES');
    if (!/ID_TYPES\.map/.test(src))
      fails.push('the accepted-types sentence no longer reads ID_TYPES, so it can drift again');
    /* And "a name" on its own reads as a person's name, which is the one search
       the product refuses. */
    if (/>\s*A name is enough/i.test(src))
      fails.push('the deck line reads "A name is enough", which invites a person name');
  }
  if (!/function inputAllowed\(/.test(src))
    fails.push('OPS-001 s.8: the input gate function is gone');
  if (!/BLOCKED_INPUT/.test(src))
    fails.push('OPS-001 s.8: the blocked-input map is gone');

  /* PIA-001 s.21: no persistent person-level graph reaches the page. */
  if (!/function rpPeople\(d\)\{\s*return \[\];\s*\}/.test(src))
    fails.push('PIA-001 s.21: rpPeople returns person nodes again');

  /* PIA-001 s.14: a name prints only from a source SR-001 authorised. */
  if (!/RP_PERSON_OUTPUT_SOURCES/.test(src))
    fails.push('PIA-001 s.14: the SR-001 person-output gate is gone');
  if (!/rpPersonOutputAllowed\(ev\[i\]\.sid \|\| ev\[i\]\.src\)/.test(src))
    fails.push('PIA-001 s.14: the name miner no longer consults the SR-001 gate');

  /* The Quebec subject rule. A geofence is about the reader; this is about the
     person being written about, which is what the statute is about. */
  if (!/function rpQcSubject\(/.test(src))
    fails.push('the Quebec subject rule is gone');
  if (!/if\(rpQcSubject\(ev\[i\]\)\) continue;/.test(src))
    fails.push('the Quebec subject rule is defined but never applied');

  /* Content age and dead items. */
  if (!/RP_DEAD/.test(src) || !/function rpBarred\(/.test(src))
    fails.push('the content-age and dead-item filter is gone');
  for (const w of ['dismissed','withdrawn','acquitted','not guilty'])
    if (!new RegExp(w, 'i').test((src.match(/var RP_DEAD =[^\n]*/)||[''])[0]))
      fails.push('the dead-item filter no longer catches "' + w + '"');
  if (!/RP_ADVERSE_YEARS\s*=\s*7\b/.test(src))
    fails.push('the seven year cap on adverse information has moved');
  if (!/var sieved=rpSieve\(d\.issues\|\|\[\]\)/.test(src))
    fails.push('rpFinds no longer sieves the findings before ranking them');
  if (!/found and not reported/.test(src))
    fails.push('items we refuse to publish are dropped silently instead of disclosed');

  /* The conditional imperative. The instruction is the authority's, or it is
     not made. */
  if (/return "Do not send any money\.";/.test(src))
    fails.push('the unconditional imperative is back in the verdict');
  if (/"Stop\. Do not send anything tonight\."/.test(src))
    fails.push('the unconditional stop instruction is back in the verdict');
  if (!/rpOfficialBody\(d\)\+" says do not send money/.test(src))
    fails.push('the RED verdict no longer attributes the instruction to a body');
  /* A call site is not an implementation. This guard passed once while the
     function it names did not exist, and the smoke suite caught it at runtime
     instead. Check the definition, not only the call. */
  if (!/function rpOfficialBody\(d\)\{/.test(src))
    fails.push('rpOfficialBody is called but not defined');

  /* Defamation by juxtaposition: the prior-warning block needs a specific
     identifier. */
  if (/'<div class="snaplist">'\+g\.priors\.map/.test(src))
    fails.push('the prior-warning block renders every prior, including weak ones');
  {
    const f = (src.match(/var priors = \(g\.priors\|\|\[\]\)\.filter\([\s\S]*?\n  \}\);/) || [''])[0];
    if (!f) fails.push('the specificity threshold on prior warnings is gone');
    else if (!/very high/.test(f) || !/\bhigh\b/.test(f))
      fails.push('the prior-warning filter no longer tests specificity, so a '
        + 'shared nameserver can put a firm beside a regulator warning again');
  }

  /* OPS-001 s.25 prohibited copy, in our own voice. */
  /* Two exemptions, both real. A verbatim quote from a retrieved source is us
     showing the reader what that source said, which is the opposite of the harm.
     And a sentence promising we will NEVER do the thing is not us doing it:
     "We never publish a trust score" has to survive a guard against trust
     scores, or the guard deletes the promise. */
  const ownVoice2 = src
    .replace(/quote:"[^"]*"/g, '')
    .replace(/&ldquo;[\s\S]*?&rdquo;/g, '')
    .split(/(?<=[.!?])\s+/)
    .filter(sent => !/\bnever\b/i.test(sent))
    .join(' ');
  const banned25 = [
    'trust score', 'reputation score', 'fraud probability',
    'this person is safe', 'is a scammer', 'bad actor',
    'high-risk individual', 'guaranteed safe', 'we checked everything',
    'no risk exists', 'you should invest'
  ];
  for (const phrase of banned25)
    if (new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(ownVoice2))
      fails.push('OPS-001 s.25 prohibited copy in our own voice: "' + phrase + '"');

  /* A promise we cannot perform is a promise we do not make. */
  if (/previous six months/.test(src))
    fails.push('the six month notification promise is back, and retention cannot support it');
  if (/two business days/.test(src) && /acknowledge/.test(src))
    fails.push('the two business day acknowledgement is back without instrumentation');
}

/* ------------------------------------------------------------- the room
   A flickering light on a screen is a seizure risk. WCAG 2.3.1 draws the line
   at three flashes a second, and the only safe version of this effect is one
   that never flashes: a slow, shallow drift with a long cycle, off entirely
   under prefers-reduced-motion. These guards measure that rather than trust it,
   because "make the flicker punchier" is a note somebody will give one day and
   the person acting on it needs the suite to stop them. */
{
  const kf = (html.match(/@keyframes roomflicker\{[\s\S]*?\n\}/) || [''])[0];
  if (!kf) fails.push('the room flicker keyframes are gone');
  else {
    const ops = [...kf.matchAll(/opacity:\s*([\d.]+)/g)].map(m => Number(m[1]));
    const lowest = Math.min(...ops);
    if (lowest < 0.6)
      fails.push('the room light dims to ' + lowest + '. Below 0.6 the change reads as a flash '
        + 'rather than a flicker, which is the seizure risk this effect has to stay clear of');
    /* Flashes per second. Count the crossings back to full brightness and
       divide by the cycle length. */
    const dur = Number((html.match(/animation:roomflicker\s+([\d.]+)s/) || [0, 0])[1]);
    if (!dur) fails.push('the room flicker has no readable duration');
    else {
      const returns = ops.filter(o => o >= 0.999).length;
      const perSec = returns / dur;
      if (perSec > 2)
        fails.push('the room light returns to full ' + perSec.toFixed(1) + ' times a second. '
          + 'WCAG 2.3.1 allows three; anything near it is a strobe and this must stay well under');
    }
  }
  if (!/@media \(prefers-reduced-motion: reduce\)\{\s*\n?\s*#room \.lit\{animation:none/.test(html))
    fails.push('the room light still flickers under prefers-reduced-motion');
  if (!/body\[data-stage="report"\] #room\{display:none\}/.test(html))
    fails.push('the dark room is drawn over the report, which is a white document');
  if (!/pointer: coarse/.test(html))
    fails.push('the lamp sway runs on touch, where there is no pointer to follow');

}

/* ------------------------------------------------- the evidence layer
   4orm sells the ability to prove a record went unaltered. Running its own
   operations log on trust would be strange, so the log is chained and these
   guards keep it that way. */
{
  const ops  = fs.readFileSync(new URL('../api/_ops.js', import.meta.url), 'utf8');
  const sql  = fs.readFileSync(new URL('../db/telemetry.sql', import.meta.url), 'utf8');
  /* Comments describe what the file refuses to do, and a guard that reads them
     flags the promise instead of the breach. This is the third time in this
     suite: strip comments, test code. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const cnt  = strip(fs.readFileSync(new URL('../api/counter.js', import.meta.url), 'utf8'));
  const auth = fs.readFileSync(new URL('../api/_auth.js', import.meta.url), 'utf8');
  const met  = fs.readFileSync(new URL('../api/admin-metrics.js', import.meta.url), 'utf8');

  if (!/export function rowHash/.test(ops)) fails.push('the row hash function is gone');
  if (!/for update/i.test(ops))
    fails.push('the chain head is advanced without locking it, so two checks in the same '
      + 'millisecond can fork the chain');
  if (!/prev_hash/.test(sql) || !/row_hash/.test(sql) || !/ops_chain/.test(sql))
    fails.push('the operations schema is no longer chained');
  /* The visitor-day must never be written without a salt, or an IP address is
     recoverable from it by trying four billion of them. */
  if (!/if \(!salt\) return null/.test(ops))
    fails.push('the visitor-day no longer requires OPS_SALT, so it is a reversible IP hash');
  if (!/OPS_SALT/.test(ops)) fails.push('the visitor-day salt is gone');

  /* The counter serves a real number or none. */
  /* The hazard is a number that did not come from the log: a seed, a floor, a
     base to add on. A `|| 0` guarding a missing chain height is not that, which
     is what the first version of this guard could not tell apart. */
  if (/\b(checks|people)\s*:\s*\d/.test(cnt))
    fails.push('the counter assigns a literal number to checks or people');
  if (/\b(seed|baseline|startAt|floor|offset)\b/i.test(cnt))
    fails.push('the counter has a seed or an offset, so it does not start at what happened');
  if (/Math\.(random|max)\s*\(/.test(cnt))
    fails.push('the counter computes rather than reads');
  if (!/available: false/.test(cnt))
    fails.push('the counter no longer has an unavailable state');
  if (!/head_hash/.test(cnt))
    fails.push('the counter no longer publishes the chain head it was read from');

  /* An element hidden by a class rule cannot be shown by clearing its inline
     style: the style falls back to the class and it stays invisible while every
     line around it looks right. This shipped once. Toggle visibility with the
     hidden attribute, and let the class style only the look. */
  if (/\.servedh\{[^}]*display:none/.test(html))
    fails.push('the chain head is hidden by a class rule, so it can never be shown');
  if (/id\("servedH"\)[\s\S]{0,220}style\.display\s*=\s*""/.test(html))
    fails.push('the chain head is un-hidden by clearing an inline style, which does not work '
      + 'when a class rule sets display:none');

  /* ---------------------------------------------------------------- *
     THE HASH SCHEMA, AND THE RULE RECORD

     A row's hash is taken over a fixed field list. Growing that list used to
     invalidate every hash already written, which is indistinguishable from
     somebody having altered the log, so rows now name the function that hashed
     them and the verifier picks by that name. Everything below protects that
     property. Comments are stripped first: three guards in this suite have
     flagged a sentence promising not to do a thing rather than the thing.
     ---------------------------------------------------------------- */
  const opsCode = strip(ops);
  if (!/const CANON = \{/.test(opsCode))
    fails.push('the canonical field lists are no longer versioned, so adding a recorded field '
      + 'invalidates every hash already written');
  if (!/\bv1:\s*r\s*=>/.test(opsCode))
    fails.push('the v1 canonical function is gone, orphaning every row written under it');
  if (!/if \(!fn\) throw new Error/.test(opsCode))
    fails.push('an unknown hash schema no longer fails, so a row can be verified under rules '
      + 'it was never written under');
  if (!/rowHash\(prev, r, row\.hash_schema \|\| 'v1'\)/.test(opsCode))
    fails.push('the verifier no longer hashes each row under the schema that row names');
  /* SQL comments start with two dashes, which the JS stripper above leaves
     alone. This guard passed once while the column it checks for had been
     deleted, because the comment explaining the column was still there. That
     is the fourth time in this suite. Strip, then test. */
  const sqlCode = sql.replace(/--.*$/gm, '');
  if (!/hash_schema/.test(sqlCode))
    fails.push('the operations schema has no hash_schema column, so no row can say how it was hashed');

  /* The rule record. A run row cites a policy version and never the policy's
     contents, which is what lets a rule change without touching a hash. The
     cost is that the version points at nothing unless the rules are recorded. */
  if (!/export async function recordPolicy\s*\(/.test(opsCode))
    fails.push('rule changes are not recorded, so every run row cites a version that cannot '
      + 'be looked up');
  if (!/version_reused_with_different_rules/.test(opsCode))
    fails.push('a version can be reused with different rules, so a run can cite a rule set '
      + 'that changed underneath it');
  if (!/name='ops_policy' for update/.test(opsCode))
    fails.push('the rule chain head is advanced without locking it');
  if (!/create table if not exists ops_policy\s*\(/.test(sqlCode))
    fails.push('the rule history table is gone');
  if (!/^\s*evidence_url\s+text/im.test(sqlCode))
    fails.push('a rule change no longer records the evidence behind it, which makes it an '
      + 'assertion, which is the thing this layer exists to stop');
  {
    const pol = strip(fs.readFileSync(new URL('../api/_policy.js', import.meta.url), 'utf8'));
    const chk2 = strip(fs.readFileSync(new URL('../api/check.js', import.meta.url), 'utf8'));
    if (!/POLICY\s*=\s*\{/.test(pol)) fails.push('the rule declaration is gone');
    if (!/recordPolicy/.test(chk2))
      fails.push('nothing records the rule set, so the version on every row points at nothing');
    if (!/await ensurePolicyRecorded\(\)/.test(chk2))
      fails.push('the rule set is not recorded before the run that cites it');
    if (/sources_enabled:\s*\d/.test(pol))
      fails.push('the rule record types a register count rather than reading it off the register');
  }

  /* ---------------------------------------------------------------- *
     THE TWO QUESTIONS

     Optional, and they have to STAY optional. The failure that matters is not
     a broken chip, it is a question that quietly becomes a gate on a page
     somebody reaches at eleven at night with money in a wire form.
     ---------------------------------------------------------------- */
  if (!/var ASK_STEPS = \[/.test(html))
    fails.push('the context questions are gone');
  /* They are asked after submit, in the thread. A row of controls that appears
     while somebody is still typing is the page interrupting them, and it is
     what this replaced. */
  if (/input\.addEventListener\("input"[\s\S]{0,400}(ctxShow|ASK_STEPS|chatPills)/.test(html))
    fails.push('the questions are being shown while somebody is still typing');
  if (!/function askOpen/.test(html) || !/askOpen\(input\.value\.trim\(\)\)/.test(html))
    fails.push('submitting the bar no longer opens the thread');
  if (/skip/i.test((html.match(/function askNext[\s\S]{0,2200}/) || [''])[0]))
    fails.push('a skip is back on the questions');
  if (!/onlyIf:\s*\{\s*sector:"AUTO"\s*\}/.test(html))
    fails.push('the private-seller question is gone, so a private sale reads as an '
      + 'unlicensed dealer, which would be the largest false positive in the product');
  /* A channel answer only means anything for a vehicle. Carried over from a
     sector somebody switched away from, it is a fact about the run that
     nobody stated. */
  if (!/if\(CTX\.sector==="AUTO" && CTX\.channel\)/.test(html))
    fails.push('an answer to a question that no longer applies is carried anyway');

  /* Stage changes layout and never judgement. Every delivery branch must read
     the evidence, and the one control the page hands over must be gated on an
     official finding rather than on a box somebody ticked. */
  if (!/function rpDelivery/.test(html))
    fails.push('the delivery rules are gone');
  if (!/if\(stage==="SENT"\)\{[\s\S]{0,200}if\(esc2==="OFFICIAL"\)/.test(html))
    fails.push('the bank instruction is no longer gated on an official finding, so ticking '
      + '"already sent" is enough to tell somebody they were defrauded');
  if (!/var RP_PATTERN_PLATFORMS = 3;/.test(html))
    fails.push('the pattern threshold moved. Below three independent platforms this product '
      + 'convicts businesses on complaints, which is the thing it replaces');
  if (!/e\.t!=="C"&&e\.t!=="D"/.test(html))
    fails.push('the pattern count no longer restricts itself to consumer sources, so a '
      + 'regulator record is being counted twice');

  /* The console must run live by default. It shipped for a day defaulting to
     the seeded corpus, which meant a visitor sent the bare link got a canned
     answer that looked exactly like a check and wrote nothing to the log. The
     demo is now the thing you have to ask for. */
  if (!/var LIVE = !\/\[\?&\]demo=1/.test(html))
    fails.push('the console no longer runs live by default, so a visitor sent the bare '
      + 'link gets the seeded corpus instead of a check');
  if (!/if\(LIVE\) bumpServed\(\);/.test(html))
    fails.push('the demo can move the public counter');

  /* Auth fails closed, and identity is not authorisation. */
  if (!/if \(!secret\) return \{ ok: false, status: 503/.test(auth))
    fails.push('the back office no longer fails closed when Clerk is unconfigured');
  if (!/ADMIN_EMAILS/.test(auth))
    fails.push('the admin allowlist is gone, so anybody Clerk authenticates gets in');
  if (/ADMIN_TOKEN/.test(met))
    fails.push('the shared admin token is back, replacing real authentication');
  if (!/requireAdmin/.test(met))
    fails.push('the metrics endpoint no longer requires an admin');

  /* The allowlist is checked against an email, and a default Clerk session
     token carries none. Without a way to establish one, every sign-in is a 403
     and the door is welded shut rather than locked. Test the code, not the
     comment that describes it. */
  const authCode = strip(auth);
  if (!/api\.clerk\.com\/v1\/users/.test(authCode) && !/template\s*:/.test(authCode))
    fails.push('nothing establishes the email the allowlist is checked against, so no '
      + 'account can ever be authorised');
  if (/api\.clerk\.com\/v1\/users/.test(authCode) && !/encodeURIComponent\(claims\.sub\)/.test(authCode))
    fails.push('the Clerk user lookup is not keyed on the verified subject, so it reads '
      + 'somebody other than the token holder');
  if (/api\.clerk\.com\/v1\/users/.test(authCode) && !/verification\.status === 'verified'/.test(authCode))
    fails.push('an unverified email address can satisfy the allowlist');
  if (!/const byEmail = !!email && allow\.includes\(email\)/.test(authCode))
    fails.push('the allowlist check no longer requires a non-empty email, so a failed '
      + 'lookup could pass');

  /* The writer has to be called by the thing it records, which it was not for
     a full day: _ops.js existed, was tested, and nothing invoked it. A writer
     nobody calls is an empty table and a counter that shows nothing. */
  const chk = fs.readFileSync(new URL('../api/check.js', import.meta.url), 'utf8');
  if (!/from '\.\/_ops\.js'/.test(chk))
    fails.push('check.js does not import the operations writer, so no run is ever recorded');
  if (!/await recordOps\(req,/.test(chk))
    fails.push('check.js imports the operations writer and never calls it');
  if (!/recordSource\(/.test(chk))
    fails.push('per-register health is never recorded, so the back office cannot show source health');
  /* And it must record the shape, never the subject. */
  if (/recordOps\(req,\s*\{[^}]*\b(identifier|domain|query|name)\s*:/.test(chk))
    fails.push('the operations write carries the identifier, which is the one field it must not hold');
}

/* --------------------------------------------------- markup without styling
   The pack preview dialog shipped with fifteen classes in the markup and not
   one CSS rule for any of them, so it rendered as a plain block near the foot
   of the report and clicking a pack looked like a jump to the bottom of the
   page. Nothing in the suite could see it, because every element existed and
   every handler fired. This guard reads the classes out of the markup and
   checks each one is styled somewhere. */
{
  const need = ['rp-pv','rp-pvsheet','rp-pvhd','rp-pvbody','rp-pvft','rp-pvname',
                'rp-pvx','rp-pvdl','rp-pvlead','rp-pvsec','rp-pvk','rp-pvp',
                'rp-pvr','rp-pvclock','rp-pvfn'];
  /* `.rp-pvclock .rp-k{...}` styles a child, not the element. Require a rule
     whose selector ENDS at the class, which is what actually gives the element
     its own box. */
  const unstyled = need.filter(c => !new RegExp('\\.' + c + '\\s*[{,]').test(html));
  if (unstyled.length)
    fails.push('the pack preview dialog has ' + unstyled.length + ' unstyled class(es), so it '
      + 'renders in document flow instead of as a dialog: ' + unstyled.join(', '));
  /* And it must be taken out of flow, or it is a block at the bottom of a page. */
  if (!/#rpt \.rp-pv\{[^}]*position:fixed/.test(html))
    fails.push('the pack preview dialog is not position:fixed, so opening one scrolls '
      + 'the reader to the foot of the report');
}

/* ---------------------------------------------------------------- SR-001
   The register controls the build, or it is a spreadsheet. These guards are
   what make it the first thing. */
{
  const src = html;
  if (!/SR001-MANIFEST-START/.test(src) || !/SR001-MANIFEST-END/.test(src))
    fails.push('SR-001: the generated manifest block is gone from the build');
  const man = (src.match(/SR001-MANIFEST-START[\s\S]*?var SR001 = ([\s\S]*?);\n\/\* SR001-MANIFEST-END/) || [])[1];
  if (!man) fails.push('SR-001: the manifest cannot be parsed');
  else {
    let m; try { m = JSON.parse(man); } catch { fails.push('SR-001: the manifest is not valid JSON'); }
    if (m) {
      if (!Array.isArray(m.enabled)) fails.push('SR-001: the manifest has no enabled list');
      /* Every source the build queries must be on the register. The generator
         refuses to write otherwise, and this is the second lock in case
         somebody edits CATS without regenerating. */
      const cats = eval((src.match(/var CATS\s*=\s*(\[[\s\S]*?\n\]);/) || [null,'[]'])[1].replace(/<\/?b>/g, ''));
      const inBuild = new Set();
      cats.forEach(c => (c.src || []).forEach(s => inBuild.add(String(s[0]).trim())));
      if (m.total && inBuild.size > m.total)
        fails.push('SR-001: the build queries ' + inBuild.size + ' sources and the register carries '
          + m.total + '. Re-run tools/sr001-build.mjs.');
      /* A name may print only from a source the register cleared for it, and
         the two gates must agree. */
      const po = Object.keys(m.personOutput || {}).length;
      const code = (src.match(/var RP_PERSON_OUTPUT_SOURCES = \{([^}]*)\}/) || [null,''])[1].trim();
      if (po === 0 && code !== '')
        fails.push('SR-001 clears no source for person-level output, but the build hardcodes some');
    }
  }
  if (!/function srEnabled\(name\)/.test(src))
    fails.push('SR-001: the enforcement function is gone');
  if (!/function srScope\(c\)/.test(src))
    fails.push('SR-001: srScope, the one place that answers which registers a check may use, is gone');
  if (!/srEnabled\(n\) \? \(status/.test(src))
    fails.push('SR-001: the board no longer marks an uncleared register out of scope');
  if (!/SR_OUT_OF_SCOPE = "policy"/.test(src))
    fails.push('SR-001: the out-of-scope board state is gone, and an uncleared register '
      + 'will read as one we reached');
  /* Both rules, not either. The chip needs its own border treatment and its
     own dot treatment, and a guard satisfied by one of the two passed while the
     other was renamed. */
  if (!/\.src\[data-s="policy"\]\{/.test(src))
    fails.push('SR-001: the out-of-scope chip has no styling, so it draws as ready');
  if (!/\.src\[data-s="policy"\] i\{/.test(src))
    fails.push('SR-001: the out-of-scope chip keeps a lit dot, which reads as reached');

  /* Fail visible. Enforcement off is allowed; enforcement off and silent is not. */
  const enforcing = /var SR001_ENFORCE = true;/.test(src);
  if (!enforcing) {
    if (!/id="srWarn"/.test(src))
      fails.push('SR-001 enforcement is off and the page does not say so');
    if (!/id\("srWarn"\)/.test(src))
      fails.push('SR-001 enforcement is off and the banner is never shown');
    if (process.argv.includes('--production'))
      fails.push('SR-001 enforcement is off. This build queries registers the '
        + 'register has not cleared, and must not be deployed.');
    else
      console.log('  NOTE  SR-001 enforcement is off. Run with --production before deploying.');
  }
}

/* ------------------------------------------------------------ house rules */
if (/[—–]/.test(html)) fails.push('an em dash or en dash is present');
const banned = ['not just', 'genuinely', 'substantially', 'delve', 'seamless',
                'robust', 'crucial', 'vital', 'holistic', 'underscore', 'testament'];
const hits = banned.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(html));
if (hits.length) fails.push('banned words: ' + hits.join(', '));

/* The experience behind this product is ours, told in the first person. Writing
   it as "our founders" puts a third party between the reader and the people who
   sat in those rooms, and it reads like a marketing page describing itself. */
{
  const prose = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/\bfounders\b/i.test(prose))
    fails.push('copy refers to "founders" in the third person, it should be "we"');
}

/* -------------------------------------------- the rules that are the product */
/* A trust score in our own voice is a failure. The same words inside a verbatim
   quote from a retrieved source are the opposite: that is us showing a reader what
   a reputation service said, which is the whole point. Strip quotes before testing. */
const ownVoice = html.replace(/quote:"[^"]*"/g, '').replace(/&ldquo;[\s\S]*?&rdquo;/g, '');
if (/trust\s*score\s*\d/i.test(ownVoice)) fails.push('a trust score appears in our own copy');
if (/\bORANGE\b|\bBLACK\b/.test(html.replace(/#[0-9A-Fa-f]{6}/g, ''))) {
  fails.push('a verdict word outside RED, GREY, YELLOW, GREEN is present');
}
['RED', 'GREY', 'YELLOW', 'GREEN'].forEach(v => {
  if (!script.includes('"' + v + '"')) warn.push('verdict ' + v + ' is not referenced');
});

/* ------------------------------- the board and the categories agree with the api */
const catCount = (script.match(/\{id:"\d\d", key:"C/g) || []).length;
if (catCount !== 10) fails.push('there are ' + catCount + ' categories, not 10');

const schema = fs.readFileSync(path.join(root, 'api', '_schema.js'), 'utf8');
if (!/minItems:\s*10/.test(schema) || !/maxItems:\s*10/.test(schema)) {
  fails.push('api/_schema.js does not require exactly 10 categories');
}
const retrieval = fs.readFileSync(path.join(root, 'api', '_retrieval.js'), 'utf8');
if (!/ALL_CATS\s*=\s*\[[^\]]*'C10'/.test(retrieval)) {
  fails.push('api/_retrieval.js ALL_CATS does not include C10');
}

const boardBlock = script.slice(script.indexOf('var SOURCES = ['), script.indexOf('var TOTAL_SOURCES'));
if (boardBlock.indexOf('GENERATED:SOURCES') === -1 && script.indexOf('GENERATED:SOURCES') === -1) {
  fails.push('the board is not generated from the catalogue. Run tools/sync-catalogue.mjs.');
}
const regNames = [...boardBlock.matchAll(/items:\[([^\]]*)\]/g)]
  .flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
/* No count is typed into the page any more. If one ever comes back, catch it. */
const typed = html.match(/Registers <b>(\d+)<\/b>/);
if (typed) fails.push('a register count is typed into the header. It must be computed: ' + typed[1]);

/* ------------------------------------- the console and the catalogue agree
   The board in index.html is GENERATED from api/_catalogue.js. If somebody
   edits one without running tools/sync-catalogue.mjs the two drift, and a
   board that says one number while the API plans against another is the exact
   disagreement that has cost this project three outages. */
{
  const cat = await import('../api/_catalogue.js');
  const ref = await import('../api/_reference.js');

  const catNames = cat.CATALOGUE.filter(x => x.enabled).map(x => x.display_name);
  const onlyBoard = regNames.filter(n => !catNames.includes(n));
  const onlyCat   = catNames.filter(n => !regNames.includes(n));
  if (onlyBoard.length || onlyCat.length) {
    fails.push('index.html and api/_catalogue.js disagree about the board. Run tools/sync-catalogue.mjs.' +
      (onlyBoard.length ? '\n      only in the page: ' + onlyBoard.join(', ') : '') +
      (onlyCat.length   ? '\n      only in the catalogue: ' + onlyCat.join(', ') : ''));
  }
  if (regNames.length !== cat.TOTAL_SOURCES) {
    fails.push('the board holds ' + regNames.length + ' registers, the catalogue counts ' + cat.TOTAL_SOURCES);
  }
  const noRef = catNames.filter(n => !ref.REFERENCE[n]);
  if (noRef.length) fails.push('sources with no reference entry: ' + noRef.join(', '));

  /* Every source must route somewhere and fail to a gap, never to silence. */
  const badFail = cat.CATALOGUE.filter(x => x.failure_behavior !== 'gap');
  if (badFail.length) fails.push('a source whose failure is not published as a gap: ' +
    badFail.map(x => x.source_id).join(', '));
  const badVert = cat.CATALOGUE.filter(x =>
    !x.verticals.every(v => v === 'ALL' || cat.VERTICALS.includes(v)));
  if (badVert.length) fails.push('a source routed to a vertical that does not exist: ' +
    badVert.map(x => x.source_id).join(', '));
  const dupIds2 = cat.CATALOGUE.map(x => x.source_id)
    .filter((v, i, a) => a.indexOf(v) !== i);
  if (dupIds2.length) fails.push('duplicate source_id in the catalogue: ' + [...new Set(dupIds2)].join(', '));
  const dupNames = catNames.filter((v, i, a) => a.indexOf(v) !== i);
  if (dupNames.length) fails.push('duplicate display_name in the catalogue: ' + [...new Set(dupNames)].join(', '));
}

/* -------------------------------------------- every board register documented */
const regInfo = script.slice(script.indexOf('var REGINFO = {'), script.indexOf('\n};', script.indexOf('var REGINFO = {')));
const undocumented = regNames.filter(n => !regInfo.includes('"' + n + '"'));
if (undocumented.length) fails.push('board registers with no reference entry: ' + undocumented.join(', '));

/* --------------------- every specimen record carries a plain language sentence.
   The schema makes `plain` required on every evidence record, because that one
   sentence is what a reader who has never opened a registry actually reads. The
   demo corpus is hand written, so nothing enforced it there and it silently had
   none at all: the whole plain language layer was invisible in the showroom. */
const evCount = (script.match(/\{t:"[ABCD4]",src:"/g) || []).length;
const plainCount = (script.match(/\n\s*plain:"/g) || []).length;
if (evCount !== plainCount)
  fails.push(evCount + ' specimen evidence records but ' + plainCount + ' plain language sentences. ' +
    'The schema requires one on every record, and the demo corpus is hand written so nothing else enforces it.');

/* the plain sentence is written for a reader, so it has to be a sentence */
const shortPlain = [...script.matchAll(/plain:"((?:[^"\\]|\\.)*)"/g)]
  .map(m => m[1]).filter(t => t.length < 40);
if (shortPlain.length) fails.push('plain language sentences too short to say anything: ' + shortPlain.join(' | '));

/* --------------------------------------- the explainer note is green, everywhere.
   Light green is the signal that says "this is the part that explains it". If a
   note block drifts back to blue, blue stops meaning the product. */
const evplainRule = (styleBlock.match(/\.evplain\s*\{[^}]*\}/) || [''])[0];
if (!/--ok-bg/.test(evplainRule))
  fails.push('.evplain is no longer on the light green ground');
const shPlainRule = (styleBlock.match(/\.sh-plain\s*\{[^}]*\}/) || [''])[0];
if (!shPlainRule) fails.push('the printed summary has no plain language block');
else if (!/#E7F7EF/i.test(shPlainRule))
  fails.push('.sh-plain on the printed summary is no longer light green');

/* ------------------- the wait screen must let go of the reader by itself.
   It sat open after the sweep landed and waited to be dismissed, which reads
   as a hung page. The countdown is the thing that fixes it, so the call from
   waitFinish is checked rather than assumed. */
const wfStart = script.indexOf('function waitFinish');
/* the body only, to the first close at column zero. The helpers that follow
   share the name, and matching those would pass a build where the call is gone. */
const waitFin = script.slice(wfStart, script.indexOf('\n}', wfStart));
if (!/[^n]\s*waitAutoGo\s*\(/.test(waitFin))
  fails.push('waitFinish no longer starts the countdown off the disclaimer, so the panel will sit open');
if (!/function\s+waitAutoCancel/.test(script))
  fails.push('the countdown can no longer be held, so a reader mid card gets cut off');

/* ------------------------ the summary box is sized by the band, not by itself.
   The detail under the statement scrolls. If the verdict goes back into flow
   the copy pushes the box taller than the gauges beside it, which is the one
   thing the box was asked not to do. */
if (!/\.sbleft \.verdictwrap\{position:absolute;inset:0\}/.test(styleBlock.replace(/\s+/g, m => m.includes('\n') ? '\n' : ' ')))
  warn.push('check the summary band: the verdict may be back in flow and able to grow the box');
const vmoreRule = (styleBlock.match(/\.vmore\s*\{[^}]*\}/) || [''])[0];
if (!/overflow-y:\s*auto/.test(vmoreRule))
  fails.push('the summary detail no longer scrolls');

/* --------------------------------- the marks, and the one rule about them.
   A mark is the supplied image file or it is not on the page. It is never
   redrawn in type, never traced, never recoloured, never stood in for. The
   standalone 4orm Finance lockup was removed from the landing on request, so
   what is guarded is not that a mark is PRESENT but that every mark which IS
   present is the real file, and that none has been rebuilt out of characters. */
{
  /* Every element that carries a mark class must either BE the real image or
     immediately wrap it. Absent is allowed, because a mark can be removed from
     a page on request. Faked is never allowed. */
  const carriers = ['herofin', 'iqmark', 'rp-hlogo', 'navbrand'];
  carriers.forEach(c => {
    const tagRe = new RegExp('<([a-z]+)[^>]*class="[^"]*\\b' + c + '\\b[^"]*"[^>]*>', 'g');
    let m;
    while ((m = tagRe.exec(html)) !== null) {
      const tag = m[0];
      const real = /src="data:image\/png;base64,/.test(tag)
        || /<img[^>]+src="data:image\/png;base64,/.test(html.slice(m.index, m.index + 400));
      if (!real) fails.push('the mark at .' + c + ' is not the real image file');
    }
  });
  /* The wordmark rebuilt out of letterforms. This has happened. */
  if (/>4<\/[a-z]+>\s*orm/i.test(html) || /class="[^"]*mark[^"]*"[^>]*>\s*<[a-z]+>4</i.test(html))
    fails.push('the 4orm wordmark has been rebuilt in markup instead of using the asset');
}
if (!/class="iqmark" src="data:image\/png;base64,/.test(html))
  fails.push('the 4 in the headline lockup is not the real mark file');
if (!/<span class="iqlock"/.test(html))
  fails.push('the headline no longer carries the 4ormIQ lockup');
/* The "4orm" in the headline is the logo file with FINANCE masked off, so the
   mark and the letterforms are the real ones. IQ is the only type in it, and
   it is set at the weight of the logo's own strokes, not the headline's 800. */
const iqRule = (styleBlock.match(/\.iqiq\{[^}]*\}/) || [''])[0];
if (!/font-weight:\s*600/.test(iqRule))
  fails.push('IQ in the headline lockup is not at the logo\'s stroke weight, so it will read as too heavy');
const markRule = (styleBlock.match(/\.iqmark\{[^}]*\}/) || [''])[0];
if (!/vertical-align:\s*baseline/.test(markRule))
  fails.push('the headline mark is no longer anchored to the text baseline, which is what left it sitting low');
/* flex:none on .tlead. The console rule gives it flex:1 1 420px, and in a
   column flex container that basis is a height, which opens dead air under
   the paragraph. It has already done that once. */
if (!/\.cbtitle \.tlead\{flex:none/.test(styleBlock))
  fails.push('.tlead has lost flex:none on the landing, which reopens the gap under the paragraph');

/* ------------------------------------------------ the report, and its stage
   The answer page runs on the same payload as the board. Each of these was
   proved by breaking it: remove the guard's subject and the check fails. */
if (!/id="rpt"/.test(html)) fails.push('the report section #rpt is gone');
if (!/body\[data-stage="report"\] #rpt\{display:block\}/.test(styleBlock))
  fails.push('the report stage no longer shows #rpt');
if (!/#rpt \.rp-wrap\{[^}]*max-width/.test(styleBlock))
  fails.push('#rpt .rp-wrap lost its max-width, so the report runs edge to edge');
{
  const unscoped = [...styleBlock.matchAll(/(?:^|[{}]\s*)(\.rp-[A-Za-z0-9_-]+[^{};]*)\{/g)]
    .map(m => m[1].trim()).filter(x => x);
  if (unscoped.length)
    fails.push('report rules not scoped to #rpt (the reset will outrank them): '
      + unscoped.slice(0, 4).join(', '));
}
if (/class="[^"]*\brp-rp-/.test(html))
  fails.push('a report class was prefixed twice (rp-rp-), so its rules never match');
{
  const packs = (script.match(/var RP_PACKS = \[/) || []).length;
  if (!packs) fails.push('the recipient packs are gone');
  const ids = (script.match(/"id": "(bank|card|police|cafc|bureau|bcsc|ic3|ftc|crypto)"/g) || []);
  if (ids.length !== 9) fails.push('expected 9 recipient packs, found ' + ids.length);
}
{
  const hand = (script.match(/toResult\(d,q\);\s*rpEnter\(d,q\);/g) || []).length;
  if (hand !== 2) fails.push('both run paths must open the report, found ' + hand + ' of 2');
}
if (!/rpEnter\(er,q\)/.test(script))
  fails.push('a failed live run no longer opens the report');
if (!/rpPickPlain\(pool,\s*x\)/.test(script))
  fails.push('findings lost their one-sentence-each pairing');
if (!/countApplicable\(d\)\|\|reached/.test(script))
  fails.push('the report stopped counting coverage the way the board counts it');
{
  /* The shell holds no party. Everything about the party is written at render
     time from the run's own payload, so a stale name can never survive a check. */
  const empties = ['rpIdent', 'rpWho', 'rpDom', 'rpSay', 'rpFigs', 'rpFinds', 'rpClaims',
                   'rpSteps', 'rpBundle', 'rpPaks', 'rpStamp'];
  for (const e of empties) {
    const m = new RegExp('id="' + e + '"[^>]*>([^<]*)<').exec(html);
    if (m && m[1].trim()) fails.push('the report shell has content baked into #' + e
      + ': ' + m[1].trim().slice(0, 40));
  }
}

/* ------------------------------------------- names, the verdict, the console
   A name printed on a page somebody hands to their bank must have come off a
   record that names it as a person, so the miner is held to official records
   carrying a role word. */
if (!/if\(ev\[i\]\.t!=="A"\) continue;/.test(script))
  fails.push('the name miner is reading past official records');
if (!/RP_ROLE\.test\(text\)/.test(script))
  fails.push('the name miner no longer requires a role word, so a company name can print as a person');
if (!/function rpOfficialNames/.test(script))
  fails.push('official record names are no longer separated out');
if (!/rpIdRow\(rpAgency\(off\[i\]\.src\)/.test(script))
  fails.push('official names lost the agency that holds them');
{
  /* This used to guard the eyebrow pill, which was wrong. The pill is a label;
     the sentence under it is the verdict. Shrinking the label was a deliberate
     change and the guard should not have blocked it. What must stay large is
     the headline, so that is what is measured now. */
  const m = /#rpt \.rp-who\{[^}]*font-size:clamp\(([\d.]+)px/.exec(styleBlock);
  if (!m || Number(m[1]) < 24)
    fails.push('the verdict headline is no longer set large enough to be the first thing read');
  /* And the pill must stay a label, not grow back into a second headline. */
  const p = /#rpt \.rp-eyebrow\{[^}]*font-size:clamp\(([\d.]+)px[^)]*,\s*([\d.]+)px\)/.exec(styleBlock);
  if (p && Number(p[2]) > 13)
    fails.push('the verdict pill has grown back to headline size');
}
if (!/body\[data-stage="console"\] \.searchbox\{display:none\}/.test(
      styleBlock.replace(/\s*\n\s*/g, ''))) {
  const joined = styleBlock.replace(/\s+/g, '');
  if (!/body\[data-stage="console"\]\.cbtitle,body\[data-stage="console"\]\.cbmain\.idrow,body\[data-stage="console"\]\.searchbox\{display:none\}/.test(joined))
    fails.push('the board still carries the landing pitch, the type pills or the search bar');
}
if (!/id\("navNewCheck"\)/.test(script))
  fails.push('with the search bar off the board there is no way to start a new check');

/* --------------------------------- the packs, and the way into a dark card
   A question mark asks a question. It does not say there is a page of working
   behind the card, which is the thing a reader has to know. */
if (!/#rpt \.rp-pakgrid\{[^}]*grid-template-columns:1fr/.test(styleBlock))
  fails.push('the recipient packs are no longer one column top to bottom');
if (/<span class="statq" aria-hidden="true">\?<\/span>/.test(script))
  fails.push('a dark card still carries a question mark instead of Read more');
{
  /* The stat cells, the rail, the bars, and the rail again when a run settled
     nothing and every card renders empty. */
  const n = (script.match(/<span class="statq">Read more<\/span>/g) || []).length;
  if (n < 3) fails.push('a dark card lost its way in: Read more appears '
    + n + ' times, and it belongs on the stat cells, the rail and the bars');
}

/* --------------------------------------- the results page, in plain words
   The page is read by a frightened person on a phone. Every one of these was
   a real misreading found in review, not a style preference. */
{
  /* The tonight banner survives the securities rewrite, deliberately. It names
     no firm and recommends a pause rather than a decision about an investment,
     which is the distinction the whole verdict rewrite turns on. It used to
     appear twice: once here and once as the YELLOW verdict headline. The
     headline was entity specific and answered "should I send my money to this
     firm", so it went. This one stays and is required. */
  const n = (script.match(/Do not send anything tonight\./g) || []).length;
  if (n < 1) fails.push('the tonight banner is gone, which is the one line the '
    + 'page exists to deliver');
  const vw = (script.match(/function rpVerdictWord\(v,d\)\{[\s\S]*?\n\}/) || [''])[0];
  if (/Do not send anything tonight/.test(vw))
    fails.push('the tonight instruction is back inside the verdict headline, '
      + 'where it is a recommendation about a named firm');
}
if (!/id\("rpAlreadyBtn"\)/.test(script))
  fails.push('the reader who has already paid has no route again');
if (!/function rpRegistered/.test(script))
  fails.push('a registration no longer outranks a complaint');
if (!/function rpGoods/.test(script))
  fails.push('the page can only say what is wrong again');
{
  /* A registered firm with nothing official against it must not be written the
     same way as an unregistered one. */
  if (!/rpRegistered\(d\) && !rpHasOfficial\(d\)/.test(script))
    fails.push('the verdict stopped checking whether the firm is registered');
}
{
  const banned = [
    ['Not reached', 'read as "we did not get round to it"'],
    ['Nothing on file', 'read as good news'],
    ['Public concern identified', 'passive, and nobody is doing anything in it'],
    ['Official warning located', '"located" is what you do with lost keys'],
    ['Nothing adverse found', '"adverse" is a lawyer word and it reads as "you are fine"'],
    ['Take care', 'in British English that is how you end a phone call'],
    ['>Before you send<', 'a heading that presumes the reader is going to send'],
    ['Shares an identifier with', '"identifier" is not a word people use'],
    ['First trace anywhere', 'detective fiction'],
    ['Retrieval decides what was reached', 'an internal design principle on a consumer page'],
  ];
  /* Comments explain why a phrase was removed, so they are stripped before the
     check reads the script, or the explanation trips its own guard. */
  const prose = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const [phrase, why] of banned) {
    if (prose.includes('"' + phrase) || prose.includes(">" + phrase))
      fails.push('the results page says "' + phrase + '" again: ' + why);
  }
}

/* A run that settles nothing still fills the rail. An empty column beside the
   answer reads as a page that failed to load, not as an honest gap. */
if (!/if\(!d\.cats\)\{/.test(script))
  fails.push('a run with no checks renders an empty rail again');
{
  /* The empty rail must carry the same seven headings a full one does, so the
     layout does not change shape when a run settles nothing. */
  const m = /if\(!d\.cats\)\{[\s\S]*?var empty=\[([\s\S]*?)\n    \];/.exec(script);
  const body = m ? m[1] : '';
  const want = ['The ten checks','Reviews, what other people are saying','Source board',
                'Cross-examination','Material issues','Operator graph','Gaps'];
  const missing = want.filter(t => !body.includes('["' + t + '"') && !body.includes('["' + t + '",'));
  if (!m) fails.push('the empty rail cards are gone');
  else if (missing.length)
    fails.push('the empty rail is missing cards a full one has: ' + missing.join(', '));
}

/* --------------------------------- a check, opened, has to explain itself
   The rules told a reader what the rules are and never which one fired, and the
   register table carried our plumbing instead of what each register said. */
/* Guard the behaviour, not the sentence. The wording changed once and the
   guard failed for the wrong reason: what matters is that exactly one rule can
   be marked, and that the marker renders. */
if (!/var on = fired && r\[0\]===fired && !hit;/.test(script))
  fails.push('the rules no longer mark exactly one applied rule');
if (!/<span class="rhit">/.test(script))
  fails.push('the applied rule has no visible marker');
if (!/\.rulerow \.rhit\{/.test(html))
  fails.push('the applied-rule marker is unstyled');
if (!/var RULE_WORD/.test(script))
  fails.push('the rule badges print a colour again instead of an outcome');
if (!/var SRC_SAID/.test(script))
  fails.push('the register table stopped saying what each register returned');
if (/<th>Access<\/th>|<th>Terms<\/th>/.test(script))
  fails.push('the register table shows our plumbing again: Access and Terms mean nothing to a reader');
if (!/What it said about this party/.test(script))
  fails.push('the register table lost the column a reader opened it for');
/* A dot sized on an inline element never draws. That has shipped broken twice,
   but whether it draws depends on the parent being a flex container, which the
   stylesheet text cannot answer. It is measured in smoke18 instead. */

/* -------------------------------------- the network's class names are its own
   A class name collision is not a duplicate rule, and every duplicate-rule
   check in this file walked straight past it: the report's narrative rows own
   .nlab and set it to 15px bold, which won on every register name on the web
   and blew each one to twice the width the frame was built for. Names were
   running off the frame and into the cards above for that reason alone. So
   every class the network creates must be declared once in this stylesheet and
   belong to nothing else. */
const netStart_ = script.indexOf('function netBuild');
const netEnd_ = script.indexOf('function netPaint');
const netSrc_ = netStart_ > -1 && netEnd_ > netStart_ ? script.slice(netStart_, netEnd_) : '';
if (!netSrc_) fails.push('the network no longer builds: netBuild is gone');
const netClasses_ = [...new Set([...netSrc_.matchAll(/class:"([^"]+)"/g)]
  .flatMap(m => m[1].split(/[\s"+()?:]+/))
  .map(c => c.trim())
  .filter(c => /^[a-z][a-z0-9-]*$/.test(c)))];
/* Only the base rules, anchored to the start of a line. A modifier written as
   .netname.core and an override inside a reduced-motion media query are both
   deliberate second mentions; a second rule of its own is the collision. */
for (const c of netClasses_) {
  const decls = (styleBlock.match(new RegExp('^\\.' + c + '\\s*\\{', 'gm')) || []).length;
  if (decls > 1) fails.push('.' + c + ' is declared ' + decls + ' times in the stylesheet: '
    + 'the network shares a class name with another component, and the later rule wins on the web');
}
for (const c of ['netname', 'nnode', 'nlink', 'hubring', 'hubtrack']) {
  if (!new RegExp('^\\.' + c + '\\s*\\{', 'm').test(styleBlock))
    fails.push('the network draws .' + c + ' and nothing styles it');
}
/* And the mark at the centre is the asset, never type and never redrawn. */
if (!/var NET_MARK = "data:image\/png;base64,/.test(script))
  fails.push('the mark at the centre of the network is not the real asset');
if (!/netMk\("image"/.test(netSrc_))
  fails.push('the mark at the centre of the network is no longer placed as an image');

/* -------------------------------------- declaration diff against a prior build */
const prev = process.argv[2];
if (prev && fs.existsSync(prev)) {
  const before = fs.readFileSync(prev, 'utf8');
  const decl = t => new Set([...t.matchAll(/\n(?:var|function)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
  const lost = [...decl(before)].filter(x => !decl(html).has(x));
  if (lost.length) warn.push('declarations no longer present: ' + lost.join(', ') +
    '  (intended removals are fine; anything you did not mean to remove is a bug)');
}

/* ----------------------------------------------------------------- report */
const line = s => console.log('  ' + s);
console.log('\n4orm IQ build check');
console.log('  categories        ' + catCount);
console.log('  board registers   ' + regNames.length);
console.log('  functions         ' + fns.length);
console.log('  element ids       ' + ids.length);
if (warn.length) { console.log('\nWorth a look'); warn.forEach(line); }
if (fails.length) {
  console.log('\nFAILED');
  fails.forEach(line);
  process.exit(1);
}
console.log('\nPASSED\n');
