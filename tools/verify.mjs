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
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
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
      const near = html.slice(m.index, m.index + 400);
      const real = /src="data:image\/png;base64,/.test(tag)
        || /<img[^>]+src="data:image\/png;base64,/.test(near);
      /* THE ONE PERMITTED EXCEPTION, AND IT IS NOT A SUBSTITUTE.
         The two standing documents carry the same header as the sources sheet.
         A third and fourth copy of the same 25KB base64 is 50KB on every page
         load for a picture the browser already holds, so their <img> is marked
         data-logo and filled AT BOOT from the real one that is already in the
         document. It is still the supplied file and nothing else: no type, no
         trace, no stand-in. The filler is checked below, so a document can
         never ship with an empty frame where the mark should be. */
      const deferred = /<img[^>]+data-logo=/.test(near);
      if (!real && !deferred) fails.push('the mark at .' + c + ' is not the real image file');
    }
  });
  /* A deferred mark is only allowed because something fills it. If the filler
     goes, so does the exception, and every data-logo frame ships empty. */
  const deferredCount = (html.match(/<img[^>]+data-logo=/g) || []).length;
  if (deferredCount) {
    if (!/querySelectorAll\("\.rp-hlogo img\[data-logo\]"\)/.test(html))
      fails.push('marks are deferred with data-logo but nothing fills them at boot');
    if (!/querySelector\("#rpSources \.rp-hlogo img"\)/.test(html))
      fails.push('the deferred marks are not filled from the real image already on the page');
  }
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
  /* And the pill must stay a label, not grow back into a second headline. The
     ceiling moved from 13 to 14 when the pill was asked to carry the
     regulator's full name: a body spelled out in words needs the extra half
     point to stay readable, and 14 is still barely a quarter of the headline. */
  const p = /#rpt \.rp-eyebrow\{[^}]*font-size:clamp\(([\d.]+)px[^)]*,\s*([\d.]+)px\)/.exec(styleBlock);
  if (p && Number(p[2]) > 14)
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
/* The same check, on every class the REGISTER draws. It shipped with .rt and
   .rn2, and a bare .rt rule three thousand lines away put a border and padding
   round the panel's own heading. Two components, one short name, and the later
   rule wins: this is the third time that has happened on this page. */
const regStart_ = script.indexOf('function regItem(');
const regEnd_ = script.indexOf('var regReturn');
const regSrc_ = regStart_ > -1 && regEnd_ > regStart_ ? script.slice(regStart_, regEnd_) : '';
if (!regSrc_) fails.push('the register no longer renders');
const regHtml_ = html.slice(html.indexOf('<div class="regscrim"'), html.indexOf('<div class="dirbox"'));
const drawn_ = [...new Set(
  [...regSrc_.matchAll(/class="([a-z0-9 -]+)"/g)].concat(
   [...regHtml_.matchAll(/class="([a-z0-9 -]+)"/g)])
  .flatMap(m => m[1].split(/\s+/)).filter(Boolean))];
for (const c of drawn_)
  if (!/^reg/.test(c))
    fails.push('the register draws .' + c + ', which is not prefixed and can collide with '
      + 'another component that owns the same short name');

for (const c of netClasses_.concat(drawn_)) {
  const decls = (styleBlock.match(new RegExp('^\\.' + c + '\\s*\\{', 'gm')) || []).length;
  if (decls > 1) fails.push('.' + c + ' is declared ' + decls + ' times in the stylesheet: '
    + 'two components share a class name, and the later rule wins on the web');
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

/* -------------------------------------- the report is four screens
   It was one long page, and the reader who needed the second half had to scroll
   past the half that had already told them what to do. Each screen now has one
   job, and each is carved out of the same markup, so the check that matters is
   that every block ended up on the screen whose job it belongs to. A block that
   drifts back onto the first screen is not a cosmetic problem: the first screen
   is what somebody reads at eleven at night before they send money. */
const sheet_ = id => {
  const a = html.indexOf('<div class="rp-sheet" id="' + id + '"');
  if (a < 0) return '';
  const rest = html.slice(a + 10);
  const b = rest.indexOf('<div class="rp-sheet" id="');
  return b < 0 ? html.slice(a) : html.slice(a, a + 10 + b);
};
const SHEETS_ = ['rpReport', 'rpFound', 'rpAct', 'rpSources'];
const sheets_ = {};
for (const x of SHEETS_) {
  sheets_[x] = sheet_(x);
  if (!sheets_[x]) fails.push('the report screen ' + x + ' is gone');
}
/* Only the result is up at rest. Two screens showing at once is the old
   one-page report with extra headings. */
for (const x of SHEETS_.slice(1))
  if (!new RegExp('id="' + x + '" hidden').test(html))
    fails.push(x + ' is not hidden at rest, so two report screens show at once');
if (/id="rpReport" hidden/.test(html))
  fails.push('the result screen starts hidden, so a finished check lands on nothing');

const belongs_ = (needle, on, what) => {
  const where = SHEETS_.filter(x => sheets_[x].includes(needle));
  if (!where.length) fails.push(what + ' is not on any report screen');
  else if (where.length > 1) fails.push(what + ' is on more than one report screen: ' + where.join(', '));
  else if (where[0] !== on) fails.push(what + ' is on ' + where[0] + ', it belongs on ' + on);
};
belongs_('What we could not answer', 'rpReport', 'the gap note');
belongs_('id="rpAlready"', 'rpReport', 'the door for somebody who has already paid');
belongs_('id="rpToFound"', 'rpReport', 'the way on to what we found');
belongs_('id="rpFindsSec"', 'rpFound', 'the findings');
/* The door to the whole console is the last thing on the last screen, after
   everything a reader can act on without it. */
belongs_('id="rpOpenRecord"', 'rpAct', 'the door to the whole record');
belongs_('id="rpTwoWays"', 'rpFound', 'the two things a pattern of complaints can mean');
belongs_('id="rpToAct"', 'rpFound', 'the way on to what to do');
belongs_('id="rpStepsSec"', 'rpAct', 'the three things to do now');
belongs_('id="rpBundle"', 'rpAct', 'what to have ready before the call');
belongs_('id="rpPaks"', 'rpAct', 'who to tell');
belongs_('id="rpClaimsSec"', 'rpAct', 'their words against the records');
{
  const a = sheets_.rpAct;
  if (a.indexOf('id="rpOpenRecord"') < a.indexOf('id="rpClaimsSec"'))
    fails.push('the door to the whole record sits above the four things to do, it belongs at the foot of the screen');
}

/* The gap note reads as the last thing the result screen could not tell them,
   which is exactly the thought that should precede the door for somebody who
   has already sent the money. Order, not presence. */
{
  const r = sheets_.rpReport;
  if (r.indexOf('What we could not answer') > r.indexOf('id="rpAlready"'))
    fails.push('what we could not answer sits below the already-sent door, it belongs just above it');
  if (r.indexOf('id="rpAlready"') > r.indexOf('id="rpToFound"'))
    fails.push('the way on to what we found sits above the already-sent door');
}

/* THE TWO PILLS, and the ONE screen that does not carry them.
   What we found is the middle of a read. A reader gets there by choosing to go
   deeper, and the only thing they should be offered at the top is the way back;
   the way on is the door at the foot of the page. Three ways off a screen whose
   whole job is to be read to the bottom is two too many. Everywhere else the
   pair stays, side by side, hard right. */
const PILLED_ = ['rpReport', 'rpAct', 'rpSources'];
for (const x of PILLED_) {
  if (!/Sources and method/.test(sheets_[x])) fails.push(x + ' has lost the sources and method pill');
  if (!/Find support/.test(sheets_[x])) fails.push(x + ' has lost the find support pill');
}
{
  const f = sheets_.rpFound;
  if (/Sources and method/.test(f) || /Find support/.test(f))
    fails.push('what we found has the pills back in its header, and it is meant to offer only the way back');
  const backs = (f.match(/class="rp-navb rp-back"/g) || []).length;
  if (backs !== 1) fails.push('what we found has ' + backs + ' controls in its header and should have exactly one');
}

/* THE REFERENCE IS NOT PRINTED TWICE.
   It is the first line of the report card, at eighteen points, which is where
   somebody reads it down a phone to a fraud desk. A second copy in ten point
   mono in the corner of every screen said the same thing smaller and took the
   corner the pills belong in. */
if (/class="rp-stamp"/.test(html))
  fails.push('the reference stamp is back in the top right corner');
if (/rpStamp/.test(script) && /innerHTML\s*=\s*stamp/.test(script))
  fails.push('something still writes the corner stamp');

/* AND THE PILLS OWN THE RIGHT EDGE, ON EVERY SCREEN THAT HAS THEM.
   The way back used to sit in the same flex row, so on the act screen the two
   fought for the right edge and on sources they wrapped onto a second line. */
if (!/#rpt \.rp-head\{[^}]*grid-template-columns:1fr auto 1fr/.test(styleBlock))
  fails.push('the report header is no longer three columns, so the way back and the pills share an edge again');
if (!/#rpt \.rp-navmid\{[^}]*justify-self:center/.test(styleBlock))
  fails.push('the way back is no longer centred on the page');
if (!/#rpt \.rp-nav\{[^}]*flex-wrap:nowrap/.test(styleBlock))
  fails.push('the two pills may wrap onto two rows again');
for (const x of ['rpAct', 'rpSources']) {
  const h = sheets_[x].slice(0, sheets_[x].indexOf('</div>', sheets_[x].indexOf('rp-nav')));
  if (!/rp-navmid/.test(sheets_[x]))
    fails.push(x + ' does not put its way back in the middle column');
}
{
  const nav = html.slice(html.indexOf('<div class="navactions">'), html.indexOf('</nav>', html.indexOf('<div class="navactions">')));
  const a = nav.indexOf('Sources and method'), b = nav.indexOf('Find support');
  if (a < 0) fails.push('the landing has no sources and method pill');
  else if (b < 0) fails.push('the landing has no find support pill');
  else if (nav.slice(Math.min(a, b), Math.max(a, b)).split('<button').length > 2)
    fails.push('sources and method and find support are not next to each other on the landing');
}

/* THE THREE DOORS ARE ONE CONTROL IN THREE PLACES.
   Already sent money, What we found, Do this right now. They carried byte
   identical geometry, written out twice three hundred lines apart under a
   comment claiming it lived in one place, and they drifted twice anyway. The
   shape is declared ONCE now and only the colour is declared per door, so a
   change to one is a change to all three by construction rather than by
   discipline. The height went 110 (a note), 220 (a billboard), and is 147:
   two thirds of double, and a door. */
{
  const shape = (styleBlock.match(/#rpt \.rp-alreadybtn,#rpt \.rp-onbtn\{\n?[^}]*\}/) || [''])[0];
  if (!shape) fails.push('the three doors no longer share one shape rule, so they will drift apart again');
  else {
    const h = (shape.match(/min-height:(\d+)px/) || [])[1];
    if (h !== '147') fails.push('the doors are ' + h + 'px. 147 is two thirds of the doubled size and is what was asked for');
    for (const prop of ['padding', 'grid-template-columns', 'gap'])
      if (!new RegExp(prop + ':').test(shape))
        fails.push('the shared door rule no longer declares ' + prop + ', so each door sets its own');
  }
  /* And no door declares a dimension ALONE. A rule naming both is the shared
     one and is the point; a rule naming one is the drift starting again. */
  /* Comments out first. A comment sitting above a rule gets swept into the
     selector capture, and one of them contained the word "colour, which" with a
     comma in it, so every rule under it read as a multi-selector and the whole
     check silently passed on the thing it exists to catch. */
  const cssNoComments = styleBlock.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of cssNoComments.matchAll(/([^{}]+?)\{([^}]*)\}/g)) {
    const sel = m[1].trim(), decl = m[2];
    if (!/\.rp-(alreadybtn|onbtn)/.test(sel)) continue;
    if (sel.includes(',')) continue;                       /* names both: shared */
    if (/:hover|:focus|\.rp-open/.test(sel)) continue;      /* states carry no size */
    const geo = decl.match(/(?:^|;)\s*(padding|min-height|width|height|font-size|gap|grid-template-columns)\s*:/);
    if (geo) fails.push('"' + sel + '" sets its own ' + geo[1] + ', and the doors are meant to share every dimension');
  }
}

/* THE THREAD BELONGS TO THE LANDING, AND NOWHERE ELSE.
   .chat carried a bare display:flex that applied at every stage. .landing-only
   sets display:none at one class of specificity and .chat matches it exactly,
   so the later rule won and the whole conversation sat behind the record. That
   is the SIXTH time this cascade has cost this file a bug, and the warning was
   the comment directly above the rule. Only the landing-scoped rule may set
   display on the thread. */
{
  const bare = (styleBlock.match(/\n\.chat\{[^}]*\}/) || [''])[0];
  if (/display:/.test(bare))
    fails.push('the bare .chat rule sets display again, so the thread shows behind the whole record');
  if (!/body\[data-stage="landing"\] \.chat\.landing-only\{display:flex\}/.test(styleBlock))
    fails.push('nothing shows the thread on the landing');
}

/* THE ONE PAGE SUMMARY COMES BEFORE THE WHOLE RECORD.
   The summary is what a reader hands to a bank. The record is for somebody who
   wants the working. Ordering them the other way asked everybody to walk past
   the hard thing to reach the useful one. */
{
  const a = sheets_.rpAct;
  if (!/id="rpDownloadSummary"/.test(a))
    fails.push('the act screen no longer offers the one page summary');
  else if (a.indexOf('id="rpDownloadSummary"') > a.indexOf('id="rpOpenRecord"'))
    fails.push('the whole record sits above the one page summary, and the summary is the one most readers need');
}

/* "NOBODY IS NAMED ANYWHERE WE LOOKED" MUST NOT BE PRINTED WHEN SOMEBODY IS.
   RP_PERSON_OUTPUT_SOURCES is empty by design: no source is cleared for person
   level output until counsel signs it off. So the name scan returns nothing and
   the card fell through to the "we found nothing" branch, on a page that prints
   the regulator's own words naming a chief executive two paragraphs above.
   We do not publish it is a different sentence from it does not exist, and
   printing the second when the first is true is the exact class of small lie
   this product exists not to tell. */
if (!/function rpNamesWithheld/.test(script))
  fails.push('nothing counts the names we found and did not publish, so the card cannot tell a withheld name from no name');
if (!/We do not publish individuals/.test(script))
  fails.push('the report card no longer says a name was found and withheld');
{
  /* And the gate itself is still shut. This is the line counsel has to move. */
  const gate = (script.match(/var RP_PERSON_OUTPUT_SOURCES\s*=\s*\{([^}]*)\}/) || [])[1];
  if (gate === undefined) fails.push('the person-output gate is gone');
  else if (gate.trim()) warn.push('a source is now cleared for person level output: ' + gate.trim() +
    '  (correct only if counsel has signed that source off in SR-001)');
}

/* THE LANDING LEADS WITH THE HEADLINE, AND THE MARK IS SIZED OFF IT.
   The 4ormIQ lockup is set in em against this line, so the two can never fall
   out of step. The inch of air under the deck pushes the bar, the sentence
   under it and the five figures down together, because the margin is on the
   deck and they are all its siblings. */
{
  const h1 = (styleBlock.match(/body\[data-stage="landing"\] \.cbh1\{[^}]*\}/) || [''])[0];
  /* THE SIZE IS THE SITE'S, NOT AN OPINION.
     4ormfinance.com sets its hero at clamp(38px,5.8vw,70px), weight 750,
     letter-spacing -.033em, line-height 1.04. The cap, the weight, the
     tracking and the leading here are those values exactly. Only the viewport
     step differs, and only because this line carries the lockup and holds one
     line above 1080, which caps how fast it can grow. */
  /* A ceiling, not an equality. The site caps its hero at 70 and this line
     must never exceed that; it sits under it on purpose, because the site's
     wraps and this one does not, so the same point size reads larger here. */
  const cap = (h1.match(/clamp\([^,]+,[^,]+,(\d+)px\)/) || [])[1];
  if (!cap) fails.push('the landing headline has no size cap');
  else if (Number(cap) > 70)
    fails.push('the landing headline is capped at ' + cap + 'px, above the 70px the site caps its hero at');
  /* And the two sides of the breakpoint have to use the same step, or the
     headline grows as the window narrows. */
  {
    const step = (h1.match(/clamp\([^,]+,([\d.]+)vw,/) || [])[1];
    const wrapRule = (styleBlock.match(/@media\(max-width:1080px\)\{[\s\S]{0,600}?\}\s*\n\}/) || [''])[0];
    const wrapStep = (wrapRule.match(/font-size:clamp\([^,]+,([\d.]+)vw,/) || [])[1];
    if (step && wrapStep && step !== wrapStep)
      fails.push('the landing headline uses ' + step + 'vw above 1080 and ' + wrapStep
        + 'vw below it, so its size jumps at the breakpoint');
  }
  if (!/letter-spacing:-\.033em/.test(h1))
    fails.push('the landing headline no longer carries the tracking the site sets on its hero');
  if (!/font-weight:750/.test(h1))
    fails.push('the landing headline no longer carries the weight the site sets on its hero');
  if (!/line-height:1\.04/.test(h1))
    fails.push('the landing headline no longer carries the leading the site sets on its hero');
  if (!/white-space:nowrap/.test(h1))
    fails.push('the landing headline may wrap above the fold, which lets the sentence '
      + 'break away from the lockup on a wide screen');
  /* And below the desk it has to wrap, or it shrinks under the body copy. */
  if (!/@media\(max-width:1080px\)\{\s*\n\s*body\[data-stage="landing"\] \.cbh1\{[\s\S]{0,240}white-space:normal/.test(styleBlock))
    fails.push('the landing headline is held to one line on a phone, where it has to '
      + 'shrink below the body copy to fit');
  {
    const sub = (styleBlock.match(/body\[data-stage="landing"\] \.cbsub\{[^}]*\}/) || [''])[0];
    if (!/clamp\(16px,1\.5vw,19px\)/.test(sub))
      fails.push('the landing lead is no longer set to the size the site sets its hero lead');
  }
  if (!/\.iqmark\{[^}]*height:1\.356em/.test(styleBlock))
    fails.push('the 4ormIQ mark is no longer sized in em off the headline, so the two can drift apart');
  /* Tolerates a comment between the brace and the declaration, which is how
     every other rule in this file is written. */
  const deckRule = (styleBlock.match(/body\[data-stage="landing"\] \.cbdeck\{[\s\S]*?\}/) || [''])[0];
  const deck = (deckRule.match(/margin:(\d+)px/) || [])[1];
  if (!deck) fails.push('the landing deck has no top margin, so nothing separates it from the headline');
  /* A floor, not a target. It was asked to come closer to the headline; what
     must never happen is the two touching. */
  else if (Number(deck) < 34)
    fails.push('the landing deck sits ' + deck + 'px under the headline, close enough to read as one block');
}

/* The phase map only names the steps now. It used to carry a ceiling each, and
   those ceilings are what made the bar sprint and then park; the bar is a clock
   and does not read them. Kept because the labels come off them. */
{
  const map = (script.match(/var PHASE_PCT = \{([^}]*)\}/) || [])[1];
  if (map === undefined) fails.push('the phase map is gone, so the waiting screen has no labels');
}

/* THE BAR IS A CLOCK.
   Three builds of this were a ceiling per phase, and each one had the same
   fault in a different place: the phases do not take the time their ceilings
   imply. It reached seventy in fifteen seconds and then spent a minute on the
   next thirty points, because retrieval is fast and the reasoning call is not.
   Re-cutting the ceilings moved the lump; it could never remove it, because a
   ceiling is a guess about duration wearing the clothes of a measurement.

   So the bar stops guessing. It walks from one to ninety nine at a constant
   rate over the time a check actually takes. Events change the words under it,
   which is what they are for. A run that finishes early jumps to a hundred; a
   run that goes long eases toward ninety nine and never arrives, because only
   a finished assessment writes a hundred. */
if (!/function waitExpected\(\)/.test(script))
  fails.push('the bar has no expected duration, so it is back to guessing from phase ceilings');
{
  const live = (script.match(/var WAIT_LIVE_MS = (\d+)/) || [])[1];
  if (!live) fails.push('the expected duration for a live run cannot be read');
  else if (Number(live) < 60000)
    fails.push('a live check is expected to take ' + live + 'ms, which will race the bar to the end and leave it parked');
  /* And a page loaded as the walkthrough that then receives real server events
     is a real run: the clock is raised and re-anchored so the bar carries on
     from where it is rather than standing still while the longer curve catches
     up. Anchoring off the shown value rather than the ceiling did exactly that
     for ten seconds. */
  if (!/function waitExpectLive/.test(script))
    fails.push('a run cannot raise its own expected duration, so a live run on a seeded page keeps the three second clock');
  if (!/\(waitCeil - 1\) \/ 98/.test(script))
    fails.push('the clock is re-anchored off the lagging shown value, which stops the ceiling until it catches up');
  /* The ticker, and nothing else, advances the ceiling. */
  const drive = script.slice(script.indexOf('function waitDrive'), script.indexOf('function waitProgress'));
  if (!/waitT0 && !waitDone/.test(drive))
    fails.push('the ticker no longer reads the clock, so the bar is event driven again');
  if (!/target > waitCeil/.test(drive))
    fails.push('the bar can go backwards: the clock is allowed to lower the ceiling');
  if (!/Math\.min\(1, t\)/.test(drive) || !/1 \+ 98 \*/.test(drive))
    fails.push('the bar no longer walks one to ninety nine');
  /* And an event may not touch it. That is the whole change. */
  const prog = script.slice(script.indexOf('function waitProgress'), script.indexOf('function waitCreep'));
  if (/waitCeil\s*=/.test(prog))
    fails.push('an event sets the bar again, which is how the lump kept moving from one phase to another');
}
if (!/if\(pct<barShown\) return;/.test(script))
  fails.push('the bar at the top of the window can go backwards when a late event carries a smaller number');
if (!/function waitDrive/.test(script))
  fails.push('the waiting bar steps between phases again instead of walking continuously');
if (!/waitShown=1; waitCeil=1; waitT0=Date\.now\(\)/.test(script))
  fails.push('the waiting bar does not start at one with the clock running');
{
  /* The heartbeat re-anchors the clock and never moves the bar. */
  const tickAt = script.indexOf('else if(ev.t==="tick")');
  const tick = tickAt < 0 ? '' : script.slice(tickAt, script.indexOf('else if(ev.t==="partial")', tickAt));
  if (!/waitCreep\(/.test(tick))
    fails.push('the heartbeat no longer sets the clock, so a slow page load costs the bar its accuracy');
  const creep = script.slice(script.indexOf('function waitCreep'), script.indexOf('function waitCreep') + 400);
  if (/waitCeil/.test(creep))
    fails.push('the heartbeat moves the bar again rather than only setting the clock it runs on');
}

/* -------------------------------------- what to do, closed
   Open, the four sections ran to eight screens and somebody who came for their
   bank's phone number scrolled past a table of fields to reach it. All four
   closed means all four titles are on one screen. */
{
  const act = sheets_.rpAct || '';
  const opens = (act.match(/<details[^>]*>/g) || []);
  if (opens.length !== 4)
    fails.push('what to do has ' + opens.length + ' collapsible sections, it should have four');
  if (opens.some(t => /\bopen\b/.test(t)))
    fails.push('a section on what to do starts open, so the four titles are not all visible at once');
  if (!/#rpt \.rp-acch::-webkit-details-marker\{display:none\}/.test(styleBlock))
    fails.push('the browser disclosure triangle is still drawn beside our own chevron');
}

/* THE FRAME AND THE TEXT INSIDE IT END TOGETHER.
   This is the rule the whole measure pass turns on, and it was got wrong twice
   in the same afternoon in opposite directions. A block that draws its own
   border, background or rule must carry its own cap: cap the TEXT inside one
   and the border keeps going, so the reader gets a hairline running three
   hundred pixels past the last word, or a rule that crosses half a panel and
   stops in mid-air. Cap the BLOCK and everything inside it ends where it does. */
{
  /* .rp-claims is not here on purpose. It sits inside an accordion beside
     .rp-bundle and .rp-pak, which are 1179 wide, and capping it made it the one
     odd block on that screen. It earns its width instead: the row is now two
     columns, their words against the record's, so both sides carry text and
     nothing is stranded. The two-column rule is what is guarded below. */
  const framed = { '#rpt .rp-why': 760 };
  for (const [sel, want] of Object.entries(framed)) {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}');
    const rule = (styleBlock.match(re) || [''])[0];
    if (!rule) { fails.push('the rule for ' + sel + ' is gone'); continue; }
    if (/max-width:\s*\d+ch/.test(rule))
      fails.push(sel + ' is capped in characters. A block that draws a border is capped in pixels, or the border and the text disagree');
    const px = (rule.match(/max-width:(\d+)px/) || [])[1];
    if (!px) fails.push(sel + ' draws a border with no cap on the block, so the border runs past the text inside it');
    else if (Number(px) !== want)
      fails.push(sel + ' is capped at ' + px + 'px and the column it sits in is ' + want + 'px');
  }
  /* And nothing inside a framed block carries a cap of its own, because that is
     the thing that puts the border and the last word in different places. */
  const inside = ['#rpt .rp-claim .rp-q', '#rpt .rp-claim .rp-r', '#rpt .rp-row .rp-rv',
                  '#rpt .rp-why .rp-x'];
  /* .rp-twoways is the third answer to the same question and the right one.
     Capping the text left a hairline crossing half a filled panel and stopping;
     capping the panel made it the only block on the screen that did not reach
     the edges its neighbours reach. The separator is drawn by a pseudo element
     that spans the panel, and the sentence under it keeps a measure. A
     border-top back on .rp-last is the first mistake returning. */
  if (/#rpt \.rp-twoways \.rp-last\{[^}]*border-top:/.test(styleBlock))
    fails.push('the pattern note draws its rule with a border again, so the rule is only as wide as the paragraph');
  if (!/#rpt \.rp-twoways \.rp-last::before\{/.test(styleBlock))
    fails.push('the pattern note has no separator spanning its panel');
  if (!/#rpt \.rp-twoways\{[^}]*max-width:none/.test(styleBlock))
    fails.push('the pattern note is capped narrower than the blocks above and below it');
  /* And the claim row stays a comparison. Stacked, it filled a third of a row
     that draws a border across all of it. */
  if (!/#rpt \.rp-claim\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.15fr\)/.test(styleBlock))
    fails.push('the claim rows are stacked again, so the border runs past the text in them');
  if (!/class="rp-rside"/.test(html))
    fails.push('the claim rows have no right side, so what the record says has no column of its own');
  for (const sel of inside) {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}');
    const rule = (styleBlock.match(re) || [''])[0];
    if (rule && /max-width:\s*\d+ch/.test(rule))
      fails.push(sel + ' is capped inside a block that already carries a border. Cap the block, not the text in it');
  }
}

/* THE PILL PAIR IS GREEN AND GOLD, AND THE WAITING SCREEN CARRIES IT TOO. */
if (!/<button class="navbtn green" type="button" id="navSources">/.test(html))
  fails.push('sources and method is not the green pill on the landing');
if (!/<button class="navbtn green" type="button" id="waitSources">/.test(html))
  fails.push('the waiting screen has no sources and method pill');
{
  const a = html.indexOf('<span class="waitpills">');
  const wb = a < 0 ? '' : html.slice(a, html.indexOf('</span>\n  </div>', a));
  if (!/Find support/.test(wb)) fails.push('the waiting screen has no find support pill');
}
if (/rp-pill-blue/.test(html))
  fails.push('a report screen still carries the old blue sources pill');
/* The result screen is where somebody finishes reading, so it is where the
   next check has to start from. Without this the only way back to the search
   bar was the data room, which most readers never open. */
if (!/id="rpNewCheck"/.test(html))
  fails.push('the result screen has no way to start the next check');
if (!/id="lastRow"/.test(html) || !/function rpResume\(/.test(html))
  fails.push('the landing page offers no way back into the last report');

/* ------------------------------------------------- NO NAME LEAVES UNGATED
   Every field carrying a person's name runs through SR-001. Two paths did
   not: the plain words summary, because it is prose rather than a field, and
   the printed one page sheet, which is the most published thing this product
   makes. Both are guarded here by name. */
if (!/function rpScrubPeople\(/.test(html))
  fails.push('the plain words summary is no longer scrubbed of individuals');
if (!/rpSay"\)\.textContent=rpScrubPeople\(/.test(html))
  fails.push('the report prints the summary without scrubbing it');
if (!/sh-say[\s\S]{0,80}rpScrubPeople\(/.test(html))
  fails.push('the printed sheet prints the summary without scrubbing it');
if (!/return Object\.keys\(out\)\.filter\(function\(k\)\{\s*return rpPersonOutputAllowed/.test(html))
  fails.push('the printed sheet names individuals without passing the SR-001 gate');

/* --------------------------------------------------- THE POLICE DIRECTORY
   Everybody is told to call their local police and nobody is told who that
   is. Thirteen provinces and territories, and the national directory. */
{
  const provs = (html.match(/var RP_PROV_ORDER = \[([^\]]*)\]/) || [null,''])[1]
    .split(',').filter(Boolean).length;
  if (provs !== 13)
    fails.push('the police picker covers ' + provs + ' provinces and territories, not 13');
  if (!/rcmp\.ca\/en\/corporate-information\/rcmp-locations/.test(html))
    fails.push('the national police directory link is gone');
  if (!/p\.id==="police"\) out\+=rpPoliceHtml\(\)/.test(html))
    fails.push('the police pack no longer carries the province picker');
}

/* ------------------------------------------------ THE ONE PAGE, TWO COPIES */
if (!/id="sumDownloadPlain"/.test(html))
  fails.push('the one page summary offers only one copy');
if (!/sh-h">Report card<\/div>/.test(html))
  fails.push('the printed sheet has lost the report card');
if (!/function buildSummary\(d, mode\)/.test(html))
  fails.push('the printed sheet no longer knows which copy it is building');

/* --------------------------------------------- ONE LAMP, OVER ONE DOORWAY */
if (!/body\[data-stage="console"\] #room\{display:none\}/.test(html))
  fails.push('the lamp is back over the data room');

/* ------------------------------------ FIND SUPPORT ASKS BEFORE IT INSTRUCTS
   The five answers come first: a wall of instructions in front of somebody who
   has not yet said what happened to them is a wall. And the emergency band
   carries the police, because the Anti-Fraud Centre says investigating is the
   local force's job and every other body on the page asks for the file number
   only the police can give. */
{
  const b = html.indexOf('function buildDirectory()');
  const dir = b < 0 ? '' : html.slice(b, b + 9000);
  const tri = dir.indexOf('class="triage"');
  const act = dir.indexOf('class="actnow"');
  if (tri < 0 || act < 0) fails.push('find support has lost the triage block or the emergency band');
  else if (tri > act)
    fails.push('find support puts the emergency band before the five answers again, '
      + 'so the page instructs before it asks');
  if (!/Tell your local police/.test(dir))
    fails.push('the find support emergency band no longer names the police');
  if (!/rcmp\.ca\/en\/corporate-information\/rcmp-locations/.test(dir))
    fails.push('the find support band names the police with no way to reach them');
}

/* ------------------------------------------------ THE DATA ROOM OPENS AT ITS TOP */
{
  const i = html.indexOf('function rpConsole()');
  const fn = i < 0 ? '' : html.slice(i, html.indexOf('\n}', i));
  if (!/scrollBehavior="auto"/.test(fn))
    fails.push('the data room resets the scroll while the root is set to scroll smoothly, '
      + 'so it shows the middle of the page and then glides to the top');
  if (!/top\(\);\s*\n\s*document\.body\.setAttribute\("data-stage","console"\);/.test(fn))
    fails.push('the data room sets the scroll after the stage swap, so there is a '
      + 'position to travel from and the reader sees the trip');
}

/* ------------------------------------------ THE WAIT SAYS WHO IS WORKING ON IT */
if (!/id="waitForming"/.test(html))
  fails.push('the waiting screen no longer says what is happening under the bar');
{
  const i = html.indexOf('id="waitForming"');
  const wf = html.slice(i, i + 20000);
  /* The 4 must be the file. A typeface standing in for it is the one thing
     that must never happen, so the guard checks for the image, not the word. */
  if (!/<img class="fourm4" src="data:image\/png;base64,/.test(wf.slice(0, 400)))
    fails.push('the waiting line no longer uses the mark file, and something is standing in for it');
  if (!/We are <span class="fourming">/.test(wf.slice(0, 400)))
    fails.push('the waiting line no longer says who is doing the work');
  /* The mark is inlined, so the estimate is thousands of characters past the
     opening tag. The window has to clear the data URI. */
  if (!/id="waitEta"/.test(wf.slice(0, 12000)))
    fails.push('the waiting line has lost the estimate');
  if (!/function waitEtaText\(/.test(html))
    fails.push('the estimate is typed rather than read off the same clock the bar is paced to');
}
/* ------------------------------------------ THE READER CAN OVERRIDE THE GATE
   Two or three capitalised words is how a great many real companies are named,
   so refusing them outright was the console being wrong about the most
   ordinary identifier there is. The door exists, it is only on the person
   block, the assertion lapses when the identifier changes, and it reaches the
   operations chain under its own hashed field. */
{
  if (!/id="kbOverride"/.test(html) || !/id="kbUndo"/.test(html))
    fails.push('the person block has no door in it, so a company named like a person cannot be checked');
  if (!/function assertActive\(/.test(html) || !/function assertClear\(/.test(html))
    fails.push('nothing scopes the reader assertion to the identifier it was made about');
  if (!/if\(USER_ASSERT\) o\.assert=USER_ASSERT;/.test(html))
    fails.push('the reader assertion never leaves the browser, so it cannot be in the chain');
  /* Only the person block gets a door. A phone number has no company reading. */
  if (!/t==="Person"\s*\n?\s*\?/.test(html))
    fails.push('the override is offered on blocks other than a person name');
}
{
  const ops = fs.readFileSync(path.join(root, 'api/_ops.js'), 'utf8');
  if (!/export const HASH_SCHEMA = 'v3';/.test(ops))
    fails.push('the operations chain is not writing the version that carries the reader assertion');
  ['v1', 'v2', 'v3'].forEach(v => {
    if (!new RegExp('\\n  ' + v + ': r => \\[').test(ops))
      fails.push('canonical hash version ' + v + ' is gone, so rows written under it can never be verified again');
  });
  if (!/r\.sector \|\| '', r\.user_assert \|\| '',/.test(ops))
    fails.push('v3 does not append the reader assertion, so the field is recorded but not committed to');
  /* Bounded to each version's own body, or a lazy match runs straight past
     the end of v2 and finds the field in v3. */
  ['v1', 'v2'].forEach(v => {
    const i = ops.indexOf('\n  ' + v + ': r => [');
    if (i < 0) return;
    const body = ops.slice(i, ops.indexOf("].join('|')", i));
    if (/user_assert/.test(body))
      fails.push('frozen hash version ' + v + ' was edited, which re-hashes every row already written under it');
  });
  const chk = fs.readFileSync(path.join(root, 'api/check.js'), 'utf8');
  if (!/assert:\s*ONE_OF\(body\?\.assert,\s*\['NOT_A_PERSON'\]\)/.test(chk))
    fails.push('the reader assertion reaches a hashed column without passing an allow list');
  if (!/user_assert: ask\.assert,/.test(chk))
    fails.push('the reader assertion is validated and then never written to the chain');
}

/* ------------------------------------------------- THE ROOM SHOWS ITSELF
   Seven instruments, seven sentences, and every one has to point at something
   that is actually on the screen. A tour aimed at a selector nobody kept is a
   tour that skips a step in silence. */
{
  const steps = (html.match(/var WK_STEPS = \[([\s\S]*?)\n\];/) || [null,''])[1];
  const sels = [...steps.matchAll(/sel:"([^"]+)"/g)].map(m => m[1]);
  if (sels.length !== 8)
    fails.push('the walkthrough has ' + sels.length + ' steps and the room has eight things to point at');
  /* Three of the steps point at a row rather than a thing, and each of those
     has to name every item in the row. A balloon that says "the ten checks"
     and then lists six is worse than one that lists none. */
  const need = { '#statstrip': 5, '#sbRight': 7, '#tiles': 10 };
  Object.keys(need).forEach(sel => {
    const i = steps.indexOf('sel:"' + sel + '"');
    if (i < 0) { fails.push('the walkthrough no longer covers ' + sel); return; }
    const end = steps.indexOf('{ sel:', i + 6);
    const body = steps.slice(i, end < 0 ? steps.length : end);
    const n = (body.match(/\n      \["/g) || []).length;
    if (n !== need[sel])
      fails.push('the walkthrough step for ' + sel + ' names ' + n + ' items and there are ' + need[sel]);
  });
  if (!/id="wkList"/.test(html))
    fails.push('the walkthrough cannot render the item lists it carries');
  sels.forEach(sel => {
    const ok = sel.startsWith('#')
      ? new RegExp('id="' + sel.slice(1) + '"').test(html)
      : new RegExp('class="[^"]*\\b' + sel.replace(/^\./, '').replace('.', '[^"]*\\b') + '\\b')
          .test(html);
    if (!ok) fails.push('the walkthrough points at ' + sel + ', which is not on the page any more');
  });
  [...steps.matchAll(/x:"([^"]*)"/g)].forEach(m => {
    if (m[1].length < 40) fails.push('a walkthrough step says almost nothing: ' + m[1]);
  });
  if (!/id="wkCancel"/.test(html) || !/id="wkNext"/.test(html))
    fails.push('the walkthrough cannot be advanced or cancelled');
  if (!/id="navWalk"/.test(html))
    fails.push('there is no way to start the walkthrough again');
  if (!/if\(!WK_SEEN\) setTimeout/.test(html))
    fails.push('the walkthrough no longer runs itself once, or runs itself every time');
  /* The layer is fixed, so its children are placed against the viewport. Add
     the scroll offset and the balloon walks off the bottom of the page. */
  {
    const i = html.indexOf('function wkPlace()');
    const fn = html.slice(i, html.indexOf('\nfunction wkShow', i));
    if (/window\.scroll[XY]/.test(fn))
      fails.push('the walkthrough positions against the page inside a fixed layer, '
        + 'so the balloon leaves the screen as soon as anything is scrolled');
  }
}

/* ------------------------------------- THE REGULATORS, IN THEIR OWN WORDS
   Three quotes, verbatim, each attributed and each linked to the page it was
   read off. This is the one block on the site that carries somebody else's
   words about a real body, so the guard is on the parts that make it
   checkable: a quote with no name against it, or no link, is an assertion. */
{
  const i = html.indexOf('class="rp-quotes"');
  if (i < 0) fails.push('sources and method has lost the regulator quotes');
  else {
    const blk = html.slice(i, html.indexOf('<div class="rp-sec" id="srcLogic">', i));
    const q = (blk.match(/<blockquote>/g) || []).length;
    if (q < 2 || q > 3)
      fails.push('sources and method carries ' + q + ' regulator quotes, and it was asked for two or three');
    const who = (blk.match(/class="rp-qwho"/g) || []).length;
    const lk  = (blk.match(/class="rp-qlk" href="https:\/\//g) || []).length;
    if (who !== q) fails.push('a regulator quote has no body named against it');
    if (lk !== q)  fails.push('a regulator quote cannot be opened at the source it was read from');
    /* Every one of these must be a body, not a blog, a broker or us. */
    ['bcsc.bc.ca', 'fca.org.uk', 'canada.ca'].forEach(d => {
      if (!blk.includes(d))
        fails.push('the quote sourced to ' + d + ' is gone, so the block is short a regulator');
    });
    if (/4orm|we think|we believe/i.test(blk.replace(/rp-q\w+/g, '')))
      fails.push('the regulator quote block has our own voice inside it');
  }
}

/* ------------------------------- SOURCES AND METHOD KNOWS WHERE IT CAME FROM
   It is reachable from six places and every one of them is a different place
   to be returned to. Opening it from the data room used to drop the reader on
   the report with no way back to the board they had been reading. */
{
  if (!/RP_BACKNAME = \{[^}]*console:"Back to the data room"/.test(html))
    fails.push('sources and method cannot name the data room as a destination, '
      + 'so somebody who opens it from there is told the wrong way out');
  if (!/if\(RP_FROM==="console"\)\{/.test(html))
    fails.push('sources and method has no route back to the data room');
  if (!/RP_CONSOLE_Y/.test(html))
    fails.push('going back to the data room does not restore where the reader was in it');
}

/* ------------------------------------------------- THE MARK IN THE RING
   The hub of the loading circle carries the 4 and nothing else: the file it
   comes from is the mark on a transparent square, so there is no plate behind
   it and no clip needed to hide one. A clip reappearing here means the image
   has gone back to a version with a ground baked into it. */
{
  if (/netMarkClip/.test(html))
    fails.push('the hub mark is being clipped again, which means the file behind it '
      + 'has a plate baked in and the ring has a tile in the middle of it');
  if (!/var NET_MARK = "data:image\/png;base64,/.test(html))
    fails.push('the hub mark is no longer inlined, so the loading circle has a hole in it offline');
}

/* THE TAB MARK. Three sizes, all inlined, all built from the mark file. */
{
  const head = html.slice(0, 40000);
  ['16x16', '32x32'].forEach(sz => {
    if (!new RegExp('rel="icon" type="image/png" sizes="' + sz + '" href="data:image/png;base64,').test(head))
      fails.push('the ' + sz + ' tab icon is gone, so the tab falls back to a blank page mark');
  });
  if (!/rel="apple-touch-icon" sizes="180x180" href="data:image\/png;base64,/.test(head))
    fails.push('the home screen icon is gone');
}
if (!/class="cbtwo"/.test(html))
  fails.push('the landing no longer says how few questions it takes to start');

/* ------------------------------------------------- THE THREAD OWNS THE PAGE */
if (!/data-stage="landing"\]\[data-chat="on"\] \.cbtitle/.test(html))
  fails.push('the landing page keeps its headline once the thread opens');
if (!/setAttribute\("data-chat","on"\)/.test(html) || !/removeAttribute\("data-chat"\)/.test(html))
  fails.push('nothing sets or clears the attribute the thread screen depends on');
/* An invisible overlay must not be clickable. .navbtn carries
   pointer-events:auto so it can be clicked through a nav that has none, and
   inherited into the closed waiting overlay it swallowed every click on the
   landing underneath. */
if (!/\.waitbox:not\(\.on\) \.waitpills \.navbtn\{pointer-events:none\}/.test(styleBlock))
  fails.push('the closed waiting overlay keeps live controls over the landing');

/* WHAT WE PUT IN FRONT OF SOMEBODY WHILE THEY WAIT.
   Every card carries a source, including the ones that are our own testimony,
   because a product built on "check it yourself" cannot put an unattributed
   claim on the one screen a frightened reader stares at longest. */
{
  const eduAt = script.indexOf('var EDU = [');
  const edu = script.slice(eduAt, script.indexOf('\n];', eduAt));
  const cards = (edu.match(/\{tone:/g) || []).length;
  if (cards < 16) fails.push('the waiting deck is down to ' + cards + ' cards');
  const srcs = (edu.match(/\n\s*src:"/g) || []).length;
  if (srcs !== cards) fails.push(cards + ' cards on the waiting deck and only ' + srcs + ' carry a source');
  for (const need of ['Why we built this', 'What it actually costs', 'What comes after',
                      'What keeps people quiet', 'Why we keep doing it'])
    if (!edu.includes(need)) fails.push('the waiting deck has lost the card "' + need + '"');
}

/* -------------------------------------- nothing may navigate on its own
   A <button> inside a <form> with no type attribute is a submit button, and a
   submit is a page load: the check dies, the wait screen goes, and the reader
   is back at the top with a query string they did not ask for. */
{
  const f = html.indexOf('<form class="searchbox" id="kbForm"');
  const form = f < 0 ? '' : html.slice(f, html.indexOf('</form>', f));
  if (!form) fails.push('the search form is gone');
  for (const b of (form.match(/<button[^>]*>/g) || []))
    if (!/type="(button|submit|reset)"/.test(b))
      fails.push('a button in the search form has no type, so it submits and reloads the page: ' + b.slice(0, 60));
  if (!/e\.preventDefault\(\)/.test(script.slice(script.indexOf('id("kbForm").addEventListener("submit"'), script.indexOf('id("kbForm").addEventListener("submit"') + 200)))
    fails.push('submitting the search form is not prevented, so it navigates');
}
/* And a parameter this build no longer honours does not sit in the address bar
   getting copied, bookmarked and shared as though it still did something. */
if (!/searchParams\.delete\("live"\)/.test(script))
  fails.push('the dead live=1 parameter is left in the address bar');
if (!/history\.replaceState/.test(script))
  fails.push('the address bar is cleaned with a navigation rather than replaceState');

/* The waiting screen opens with no transition, because the console is being
   laid out underneath it and a fading scrim shows the reader an empty board. */
if (!/\.waitscrim\.snap,\.waitbox\.snap\{transition:none!important\}/.test(styleBlock))
  fails.push('the waiting screen fades in over the console being built underneath it');
if (!/waitScrim\.classList\.add\("snap"\)/.test(script))
  fails.push('nothing turns off the transition when the waiting screen opens');

/* THE REPORT CARD. Reference first, then what makes the run findable again. */
{
  const plate = html.slice(html.indexOf('<div class="rp-idtray">'), html.indexOf('</div></div>', html.indexOf('<div class="rp-idtray">')));
  if (plate.indexOf('id="rpCardRef"') > plate.indexOf('id="rpIdent"'))
    fails.push('the report reference is below the record rows, it belongs at the top of the card');
  for (const x of ['rpCardRef', 'rpCardMeta', 'rpCardFoot'])
    if (!plate.includes('id="' + x + '"')) fails.push('the report card has lost ' + x);
}
if (!/Record hash/.test(script)) fails.push('the report card no longer carries the record hash');
if (!/Log entry/.test(script)) fails.push('the report card no longer carries the log entry');

/* FIND SUPPORT IS A LIGHT DOCUMENT. It was a dark panel, which is the wrong
   register for the page somebody reads after the money has gone. */
{
  const dir = (styleBlock.match(/\.dirbox\{\n?\s*--bg:[^}]*\}/) || [''])[0];
  if (!dir) fails.push('the find support palette block is gone');
  else {
    const bg = (dir.match(/--bg:\s*(#[0-9A-Fa-f]{6})/) || [])[1] || '';
    const lum = bg ? (parseInt(bg.slice(1,3),16)+parseInt(bg.slice(3,5),16)+parseInt(bg.slice(5,7),16))/3 : 0;
    if (lum < 200) fails.push('find support is on a dark ground again (' + bg + ')');
  }
}

/* -------------------------------------- the whitespace scale
   The report ran nine band values between fifty-four and ninety-two pixels, and
   the eye reads nine near-identical gaps as no system at all. There are two now,
   ninety-six between subjects and forty-eight inside one, and this is what stops
   a third appearing the next time somebody nudges a section apart. */
{
  const bands = {
    'rp-sec':          /#rpt \.rp-sec\{[^}]*padding:(\d+)px 0 0\}/,
    'rp-sec.rp-tight': /#rpt \.rp-sec\.rp-tight\{padding-top:(\d+)px\}/,
    'rp-behind':       /#rpt \.rp-behind\{[^}]*margin:(\d+)px 0 0\}/,
    'rp-already':      /#rpt \.rp-already\{[^}]*margin-top:(\d+)px\}/,
    'rp-accs':         /#rpt \.rp-accs\{[^}]*margin-top:(\d+)px;/,
    'rp-why':          /#rpt \.rp-why\{margin-top:(\d+)px;/,
    'rp-clock':        /#rpt \.rp-clock\{[^}]*margin-top:(\d+)px;/,
    'rp-figs':         /#rpt \.rp-figs\{[^}]*margin-top:(\d+)px;/,
    'rp-foot':         /#rpt \.rp-foot\{[^}]*margin-top:(\d+)px;/,
    'rp-stitle':       /#rpt \.rp-stitle\{margin-top:(\d+)px;/,
  };
  for (const [name, re] of Object.entries(bands)) {
    const m = styleBlock.match(re);
    if (!m) { fails.push('the band value for .' + name + ' cannot be read, so it cannot be held to the scale'); continue; }
    const v = Number(m[1]);
    if (v !== 96 && v !== 48)
      fails.push('.' + name + ' sits at ' + v + 'px. The report has two band values, 96 and 48, and this is a third');
  }
  /* The heading, its kicker and its standfirst step by one number. */
  const h2 = (styleBlock.match(/#rpt \.rp-h2\{margin-top:(\d+)px/) || [])[1];
  const sub = (styleBlock.match(/#rpt \.rp-sub\{margin-top:(\d+)px/) || [])[1];
  if (h2 !== '12' || sub !== '12')
    fails.push('the heading rhythm is uneven: .rp-h2 steps by ' + h2 + ' and .rp-sub by ' + sub + ', and both should be 12');
}

/* THE MEASURE. Nothing a person reads runs past about seventy characters.
   Every one of these ran between eighty-six and a hundred and thirty-three. */
{
  const caps = {
    '#rpt .rp-spec':          80,
    '#rpt .rp-pakfoot':       80,
    '#rpt .rp-dom':           80,
    '#rpt .rp-find .rp-t':    80,
  };
  for (const [sel, ceil] of Object.entries(caps)) {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}');
    const rule = (styleBlock.match(re) || [''])[0];
    if (!rule) { fails.push('the rule for ' + sel + ' is gone, so its measure is unbounded'); continue; }
    const mw = (rule.match(/max-width:(\d+)ch/) || [])[1];
    if (!mw) fails.push(sel + ' has no measure cap, so its line can run the whole column');
    else if (Number(mw) > ceil)
      fails.push(sel + ' is capped at ' + mw + 'ch, past the ' + ceil + 'ch a person reads comfortably');
  }
}

/* SOURCES AND METHOD USES THE SHEET, AND STILL HAS A MEASURE.
   The original guard demanded a 900px column, which was the right answer to the
   wrong shape: full-width rows whose sentences stopped two-thirds of the way
   across gave the page two right-hand edges. The fix was never the column, it
   was the rows. They are cards in a multi-column grid now, so each sentence
   fills the thing that holds it, and the page uses the paper it is printed on.
   What is guarded is that invariant, not the number 900: the rows must be laid
   out in more than one column, and the lead must keep a reading measure. */
{
  const rowsSel = (styleBlock.match(/#rpSources \.rp-rows\{[^}]*\}/) || [''])[0];
  if (!/grid-template-columns:repeat\(2,/.test(rowsSel))
    fails.push('the sources rows are one full-width column again, so every sentence stops '
      + 'two-thirds of the way across a block that does not');
  if (!/#rpt #rpSources \.rp-slead\{max-width:\d+ch\}/.test(styleBlock))
    fails.push('the sources lead has lost its measure and can now run the whole sheet');
  const heroSel = (styleBlock.match(/#rpSources \.rp-hero2\{[^}]*\}/) || [''])[0];
  if (!/grid-template-columns:/.test(heroSel))
    fails.push('the sources hero is stacked again, which puts the reason the product exists '
      + 'below the fold on the page that has to earn belief');
  /* Five levels of authority, in five blocks, each stating its own limit. Four
     grey boxes for five levels is the page disagreeing with the board. */
  const catSel = (styleBlock.match(/#rpt \.rp-cat\{[^}]*\}/) || [''])[0];
  if (!/grid-template-columns:repeat\(5,/.test(catSel))
    fails.push('the levels of authority are no longer five blocks');
  if (!/var RP_CATLIST = \[[\s\S]{0,40}\["A",/.test(html))
    fails.push('the levels of authority no longer carry the letter the board uses');
  if (!/function rpTierCount\(/.test(html))
    fails.push('the register count per level is typed rather than counted, so it will go stale');
  ['a','b','own','c','d'].forEach(t => {
    if (!new RegExp('#rpt \\.rp-catc\\[data-t="' + t + '"\\]').test(styleBlock))
      fails.push('level ' + t + ' has no colour, so the five blocks read as one grey list');
  });
  /* The header is NOT in that column, and that is deliberate. The two pills
     have to sit in the same corner on every screen or they stop being a fixed
     thing a reader can reach for. Body has a measure; chrome has an edge. */
  if (/#rpSources \.rp-head[,{]/.test(styleBlock))
    fails.push('the sources header has been pulled into the 900 column, so its pills no longer line up with the other screens');
  /* Every section on it states its stakes under the heading. One did not. */
  const src = sheets_['rpSources'] || '';
  const secs = src.split('<div class="rp-sec"').slice(1);
  if (secs.length < 5) fails.push('the sources page has ' + secs.length + ' sections, and it had five');
  secs.forEach((sec, i) => {
    if (!/class="rp-sub"/.test(sec))
      fails.push('section ' + (i + 1) + ' of sources and method has a heading and then a grid, with nothing saying why it is there');
  });
  /* The four nevers are one thing with four parts, framed like every other
     block of rows on the page, not four cards floating in the gutter. */
  const nevers = (styleBlock.match(/#rpt \.rp-nevers\{[^}]*\}/) || [''])[0];
  const never  = (styleBlock.match(/#rpt \.rp-never\{[^}]*\}/) || [''])[0];
  if (!/background:var\(--border\)/.test(nevers) || !/border:1px solid var\(--border\)/.test(nevers))
    fails.push('the four nevers have lost the hairline frame every other block of rows on the page has');
  if (/border:1px/.test(never) || /box-shadow:var\(/.test(never))
    fails.push('the nevers are boxed again, which makes them the only boxed section on a page of hairline rows');
}

/* THE GUTTER DOES NOT MOVE WHEN THE CHECK FINISHES.
   The waiting screen ran a 54px gutter on a full-width box and the report ran a
   1360 column with a 72px gutter, so the network sat 49px left of the report
   that replaced it and the handover read as the page sliding sideways. */
{
  const wb = (styleBlock.match(/\.waitbox\{[^}]*\}/) || [''])[0];
  const wr = (styleBlock.match(/#rpt \.rp-wrap\{[^}]*\}/) || [''])[0];
  const mw = s2 => (s2.match(/max-width:(\d+)px/) || [])[1];
  const pad = s2 => (s2.match(/padding:0 (clamp\([^)]*\))/) || [])[1];
  if (!wb || !wr) fails.push('the waiting box or the report wrap has no rule, so their gutters cannot be compared');
  else if (mw(wb) !== mw(wr) || pad(wb) !== pad(wr))
    fails.push('the waiting screen and the report no longer share a gutter (' +
      mw(wb) + '/' + pad(wb) + ' against ' + mw(wr) + '/' + pad(wr) +
      '), so the content edge jumps when the result opens');
}

/* -------------------------------------- EVERY CLASS THE PAGE EMITS HAS A RULE
   This is the check that should have existed from the first build.

   The nine document packs shipped for weeks with EIGHT of their classes having
   no CSS rule at all: .rp-pva, .rp-pvh, .rp-pvt, .rp-pvn, .rp-pvsm, .rp-pvfoot,
   .rp-ln and .rp-i. The markup was correct, the copy was correct, every one of
   the thirty-odd other checks passed, and the page rendered as a wall of
   unbroken sentences with a stray digit in front of some of them. It read like
   a text file somebody forgot to finish, because that is exactly what an
   element with no rule is.

   No test that reads behaviour can catch that. This one reads intent: if the
   page writes a class, somebody meant it to look like something. */
{
  const declared = new Set();
  for (const m of styleBlock.matchAll(/\.([A-Za-z][\w-]*)/g)) declared.add(m[1]);
  /* The page also builds two standalone documents in script, the one page
     summary and the audit sheet, and each ships its own stylesheet inside a
     string. A class styled there is styled. */
  for (const m of script.matchAll(/\.([A-Za-z][\w-]*)\s*(?:,|\{)/g)) declared.add(m[1]);

  /* Classes the page emits: the static markup, and every class= inside a
     template string in the script. */
  const emitted = new Map();          /* class -> a sample of where it came from */
  const scan = (text, where) => {
    for (const m of text.matchAll(/class=(?:"|\\")([^"\\]+)/g))
      for (const c of m[1].trim().split(/\s+/))
        /* A plain class name and nothing else. Half of these are built by
           string concatenation, so a capture can end mid-expression; those
           fragments are not classes and must not be reported as missing. */
        if (/^[a-zA-Z][\w-]*$/.test(c) && !emitted.has(c)) emitted.set(c, where);
    /* classList.add("x") and setAttribute("class","x") */
    for (const m of text.matchAll(/classList\.(?:add|toggle)\(\s*"([\w -]+)"/g))
      for (const c of m[1].trim().split(/\s+/))
        if (/^[a-zA-Z][\w-]*$/.test(c) && !emitted.has(c)) emitted.set(c, where);
  };
  scan(html.slice(html.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g, ''), 'the markup');
  scan(script, 'the script');

  /* Classes that carry meaning to JS or to a test rather than to the eye. A
     class here is deliberately styleless and says so. */
  const STYLELESS = new Set([
    'landing-only', 'console-only', 'no-print', 'sr-only', 'hidden',
  ]);

  const orphans = [...emitted.keys()]
    .filter(c => !declared.has(c) && !STYLELESS.has(c))
    /* A token ending in a hyphen is the stem of a class built by concatenation
       ("done-" + state), not a class. */
    .filter(c => !c.endsWith('-'))
    .sort();
  if (orphans.length)
    fails.push('the page writes ' + orphans.length + ' class' + (orphans.length === 1 ? '' : 'es') +
      ' that no CSS rule matches, so whatever they were meant to look like, they look like nothing: ' +
      orphans.slice(0, 12).join(', ') + (orphans.length > 12 ? ', and ' + (orphans.length - 12) + ' more' : '') +
      '  (first seen in ' + emitted.get(orphans[0]) + ')');
}

/* -------------------------------------- the markup closes what it opens
   Two orphaned </span> sat in the headline for four builds, left behind when
   the .herolock wrapper came off the landing. A browser closes them against
   the h1 and the page looks right, so nothing ever caught them. */
{
  const bodyAt = html.indexOf('<body>');
  let body = html.slice(bodyAt)
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  for (const t of ['span','div','p','h1','h2','h3','button','section','nav','details','summary','b','i','em','strong','ul','li','table','tr','td','th','form','label','header','footer','main','article','aside','figure','svg','g','text']) {
    const o = (body.match(new RegExp('<' + t + '[\\s>]', 'g')) || []).length;
    const c = (body.match(new RegExp('<\\/' + t + '>', 'g')) || []).length;
    if (o !== c) fails.push('the markup opens ' + o + ' <' + t + '> and closes ' + c);
  }
  /* And there is no closing tag before anything has opened. */
  let depth = 0;
  for (const m of body.matchAll(/<span[\s>]|<\/span>/g)) {
    depth += m[0] === '</span>' ? -1 : 1;
    if (depth < 0) { fails.push('a </span> closes something that was never opened'); break; }
  }
}

/* -------------------------------------- the back office comes back to itself
   Clerk navigates to "/" after a sign in unless it is told otherwise, and "/"
   is the consumer landing page. That is why the back office opened for a second
   and then vanished. */
if (/Clerk\.load\(\{\}\)/.test(admin))
  fails.push('the back office loads Clerk with no redirect configuration, so a sign in lands on the landing page');
for (const k of ['afterSignOutUrl', 'signInFallbackRedirectUrl', 'fallbackRedirectUrl'])
  if (!admin.includes(k)) fails.push('the back office does not pin Clerk\'s ' + k + ' to itself');
if (!/data-boot/.test(admin))
  fails.push('the back office renders its shell before it knows whether anybody is signed in');
if (/[\u2014\u2013]/.test(admin))
  fails.push('an em dash or en dash is present in the back office');

/* -------------------------------------- the register names real businesses
   In Canadian defamation the plaintiff does not have to prove falsity. Say
   something that lowers a company's reputation and the burden is on us to make
   out a defence. Everything below is what the defences actually require, kept
   in one place so a change to the page cannot quietly remove one of them. */
{
  const reg = fs.readFileSync(path.join(root, 'api', '_register.js'), 'utf8');

  /* The naming gate lives on the server, on the way out of the database, so a
     bug in the page cannot publish a name the reply window has not released. */
  if (!/const named = !!x\.named_at;/.test(reg))
    fails.push('the register read path no longer gates on named_at, so an unreplied party can be named');
  if (!/name: named \? x\.display_name : null/.test(reg))
    fails.push('the register sends a name for a party it has not named');
  if (!/domain: named \? x\.domain : null/.test(reg))
    fails.push('the register sends a domain for a party it has not named, which names them anyway');
  if (!/contacted_at is not null/.test(reg))
    fails.push('the register can name a party nobody has written to');
  if (!/export const REPLY_DAYS/.test(reg))
    fails.push('the reply window is gone');

  /* A pattern row is never created off one platform, however loud it is. */
  if (!/hosts\.size >= PATTERN_PLATFORMS/.test(reg))
    fails.push('the register no longer requires independent platforms for a pattern');

  /* A party with nothing against it never gets a row, and a party that stops
     carrying one comes off by itself. */
  if (!/cleared_at = now\(\)/.test(reg))
    fails.push('the register has no delisting path, so a withdrawn alert stays published');

  /* And this table must never learn who did the searching. */
  const sql = fs.readFileSync(path.join(root, 'db', 'register.neon.sql'), 'utf8')
    .split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  for (const col of ['visitor', 'ip', 'user_agent', 'session', 'email'])
    if (new RegExp('\\b' + col + '\\w*\\s+(text|inet|uuid|varchar)', 'i').test(sql))
      fails.push('the register schema has a "' + col + '" column, which rebuilds the person level file');
}

/* The page itself. What a court would look at. */
{
  const fn = script.indexOf('function regItem(');
  const item = fn < 0 ? '' : script.slice(fn, script.indexOf('\nfunction regRender', fn));
  if (!item) fails.push('the register no longer renders its entries');
  if (!/No regulator has acted/.test(item))
    fails.push('a pattern entry no longer says on its own line that no regulator has acted');
  if (!/x\.authorityUrl/.test(item))
    fails.push('an official entry no longer links to the authority, which is the whole defence');
  if (!/x\.reply/.test(item))
    fails.push('a reply we were sent is no longer printed beside the entry');
  const rend = script.slice(script.indexOf('function regRender'), script.indexOf('var regReturn'));
  /* The gate is enforced twice on purpose. The server nulls the name, and the
     page refuses on the flag as well, because one place is one bug away from
     publishing a name we have no defence for. */
  if (!/x\.named !== false && !!x\.name/.test(rend))
    fails.push('the register page no longer checks the naming flag when it filters entries');
  if (!/if\(!x \|\| x\.named === false \|\| !x\.name\) return "";/.test(item))
    fails.push('the register entry renderer will draw an entry the server did not name');
  if (!/register@4ormfinance\.com/.test(rend))
    fails.push('the register has no right of reply address');
  /* No verdict word may appear anywhere in the register's own copy. */
  for (const w of ['scam', 'fraudster', 'fraudulent', 'criminal', 'dishonest', 'ripoff', 'crook'])
    if (new RegExp('\\b' + w + '\\b', 'i').test(rend + item))
      fails.push('the register copy uses the word "' + w + '" on a page that names real companies');
}

/* ================= COMPLIANCE, PRIVACY, AND THE STATUTES ==================
   Three things ship together here and each one is load bearing: a disclaimer
   that cannot be quietly swapped out, a statute list where every entry links
   to the official text, and two standing documents reachable from anywhere. */
{
  /* 1. THE ADVICE LINE ON THE LANDING PAGE.
     It is its own paragraph on purpose. The note above it is rewritten
     wholesale when live checking is on, and a disclaimer that vanishes the
     moment the product starts doing the thing it disclaims is not one. */
  const adv = (html.match(/<p class="upnote upadv[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  if (!adv) fails.push('the landing page has no separate advice disclaimer under the search bar');
  else {
    for (const phrase of ['not financial advice', 'do not advise', 'third party evidence'])
      if (!new RegExp(phrase, 'i').test(adv))
        fails.push('the landing advice disclaimer no longer says "' + phrase + '"');
  }
  /* And the live override must still target only the first note. If it ever
     learns to rewrite both, the line above disappears on the live build and
     nobody would see it in a local one. */
  const live = (script.match(/document\.querySelector\("\.upnote"\)\.innerHTML=[\s\S]{0,400}?;/) || [''])[0];
  if (/upadv/.test(live))
    fails.push('the live-checking override now rewrites the advice disclaimer as well');
  if (!/function upNotes\(/.test(script))
    fails.push('the two landing notes are no longer hidden together when the thread opens');

  /* 2. THE STATUTES. Every entry: a name, a citation, an https link to the
     official text, and the host printed so a reader sees where it goes. */
  const lawsBlock = (script.match(/var RP_LAWS = \[[\s\S]*?\n\];/) || [''])[0];
  if (!lawsBlock) fails.push('the statute list RP_LAWS is gone');
  else {
    const entries = [...lawsBlock.matchAll(/\n    \["([^"]+)",\n     "([^"]+)",\n     "([^"]*)",\n     "(https?:[^"]+)", "([^"]+)"\]/g)];
    if (entries.length < 10)
      fails.push('the statute list carries only ' + entries.length + ' entries, and the compliance page needs the full set');
    /* The four groups it has to cover. Dropping one is how a compliance page
       ends up listing only the flattering half. */
    for (const g of ['Privacy', 'publish about a party', 'What we are not', 'contact you'])
      if (!lawsBlock.includes(g))
        fails.push('the statute list no longer carries the group "' + g + '"');
    entries.forEach(e => {
      const [, name, cite, what, url, host] = e;
      if (!/^https:/.test(url))
        fails.push('the link for "' + name + '" is not https');
      if (!url.includes(host.replace(/^www\./, '')))
        fails.push('the host printed beside "' + name + '" does not match its link');
      if (!/\b(S\.?C\.?|R\.?S\.?C\.?|S\.?A\.?|S\.?B\.?C\.?|R\.?S\.?A\.?|R\.?S\.?O\.?|CQLR|U\.S\.C|SCC)\b/.test(cite))
        fails.push('"' + name + '" has no statutory citation beside it');
      if (what.length < 80)
        fails.push('"' + name + '" does not say what it does to us');
    });
    /* Every one of these must be the body's own site or the official reporter.
       A statute cited to a law firm's summary is the same failure as a
       register result cited to a blog. */
    const ok = ['laws-lois.justice.gc.ca', 'legisquebec.gouv.qc.ca', 'kings-printer.alberta.ca',
                'bclaws.gov.bc.ca', 'decisions.scc-csc.ca', 'ontario.ca', 'law.cornell.edu'];
    entries.forEach(e => {
      if (!ok.some(d => e[4].includes(d)))
        fails.push('the link for "' + e[1] + '" is not an official source');
    });
    if (!/id\("rpLaws"\)/.test(script) || !/id\("rpLaws2"\)/.test(script))
      fails.push('the statute list is no longer printed on both the method page and the compliance document');
  }

  /* 3. THE DISCLAIMER PANEL on the method page. Each of these sentences is one
     somebody has asked us to soften at some point. */
  const dis = (html.match(/<div class="rp-dis">[\s\S]*?<\/div>\s*\n\s*<div id="rpLaws">/) || [''])[0];
  if (!dis) fails.push('the compliance disclaimer is gone from the sources and method page');
  else for (const phrase of ['not financial, investment, tax or legal advice',
                             'not a finding that any law has been broken',
                             'Green is not clearance',
                             'no fee from any party we report on']) {
    if (!dis.includes(phrase))
      fails.push('the disclaimer no longer says "' + phrase + '"');
  }

  /* 4. THE TWO STANDING DOCUMENTS, and the routing that reaches them. */
  for (const [id, back] of [['rpCompliance', 'rpCompBack'], ['rpPrivacy', 'rpPrivBack']]) {
    if (!new RegExp('<div class="rp-sheet" id="' + id + '"').test(html))
      fails.push('the ' + id + ' document is gone');
    if (!new RegExp('id="' + back + '"').test(html) || !new RegExp('id="' + back + 'T"').test(html))
      fails.push(id + ' has no named back button');
    if (!new RegExp('id\\("' + back + '"\\)\\.addEventListener').test(script))
      fails.push(back + ' is not wired to anything');
  }
  if (!/RP_DOCS = \{ sources:1, compliance:1, privacy:1 \}/.test(script))
    fails.push('the three reachable-from-anywhere documents are no longer declared together');
  if (!/compliance:"rpCompliance", privacy:"rpPrivacy"/.test(script))
    fails.push('the two documents are not registered as screens, so rpShow cannot switch to them');
  if (!/function rpDocsHide\(/.test(script))
    fails.push('leaving a document no longer hides all three, so a stale sheet can sit over the landing');
  /* Back has to name where it goes, from every one of the five origins. */
  const bn = (script.match(/var RP_BACKNAME = \{[\s\S]*?\};/) || [''])[0];
  for (const k of ['result', 'found', 'act', 'console', 'landing', 'wait'])
    if (!new RegExp('\\b' + k + ':"Back').test(bn))
      fails.push('the back button has no name for a reader who arrived from "' + k + '"');
  /* Reachable from the landing, from the data room and from every report foot. */
  const routes = (html.match(/data-doc="(compliance|privacy|sources)"/g) || []).length;
  if (routes < 10)
    fails.push('there are only ' + routes + ' routes into the documents, so they are not reachable from every screen');
  if (!/document\.addEventListener\("click", function\(e\)\{[\s\S]{0,600}?data-doc/.test(script))
    fails.push('nothing listens for the document links, so they are decoration');

  /* 5. THE PRIVACY NOTICE MUST MATCH THE CODE, not the other way round.
     This guard used to check for four sentences and pass. The sentences were
     true of the operations chain and false of the corpus, which wrote the
     reader's search string on an index and the whole rendered payload beside
     it. The notice now describes both stores, and the checks below reach into
     the code that each claim is about rather than only into the prose. */
  const priv = (html.match(/<div class="rp-sheet" id="rpPrivacy"[\s\S]*?\n<\/div>\n\n/) || [''])[0];
  for (const phrase of ['no accounts', 'do not keep what you typed',
                        'rolled at midnight', 'run fresh against the registers',
                        'No natural person is kept', 'one way hash',
                        'Twelve\\s+months', 'Twenty\\s+four months'])
    if (!new RegExp(phrase, 'i').test(priv))
      fails.push('the privacy notice no longer says "' + phrase.replace(/\\s\+/g, ' ') + '"');
  /* The corpus is disclosed. A store nobody is told about is the defect this
     section was written to close, so its own section has to stay on the page. */
  if (!/What we keep about the party you checked/.test(priv))
    fails.push('the privacy notice no longer discloses the corpus');
  const ops = fs.readFileSync(path.join(root, 'api', '_ops.js'), 'utf8');
  if (!/never will be: the identifier itself/.test(ops))
    fails.push('the operations log no longer promises what the privacy notice tells readers it promises');
  /* THE VERIFIER MUST SELECT EVERY FIELD THE HASH COMMITS TO.
     A column missing from that SELECT is rebuilt as its empty default, the
     recomputed hash differs, and the chain is reported broken at a row nobody
     touched. A false alarm here is indistinguishable from a real one. */
  {
    const sel = (ops.match(/select seq, at, prev_hash[\s\S]*?from ops_runs/) || [''])[0];
    const canon = (ops.match(/v3: r => \[[\s\S]*?\]\.join\('\|'\)/) || [''])[0];
    const fields = [...canon.matchAll(/r\.([a-z_]+)/g)].map(m => m[1]);
    const missing = [...new Set(fields)].filter(f => f !== 'at' && !new RegExp('\\b' + f + '\\b').test(sel));
    if (missing.length)
      fails.push('the chain verifier does not read ' + missing.join(', ') +
                 ', so a row carrying one would be reported as tampered with');
  }
  /* THE CORPUS, CHECKED AGAINST WHAT THE NOTICE SAYS ABOUT IT.
     Each of these is a sentence on the page that would be false without the
     line of code beside it. */
  const store = fs.readFileSync(path.join(root, 'api', '_store.js'), 'utf8');
  if (!/PERSON_NODE_TYPES = new Set\(/.test(store) || (store.match(/isPersonNode\(/g) || []).length < 4)
    fails.push('the corpus write path no longer refuses person records at every point it writes the graph');
  if (!/function identifierHash/.test(store) || !/process\.env\.CORPUS_SALT/.test(store))
    fails.push('the search string reaches the corpus without being hashed under a required salt');
  if (/JSON\.stringify\(payload\)/.test(store))
    fails.push('the corpus writes the whole rendered result again, which the notice says it does not');
  const cSql = fs.readFileSync(path.join(root, 'db', 'schema.sql'), 'utf8');
  if (!/check \(node_type not in \('PERSON'/.test(cSql))
    fails.push('the database no longer carries the constraint that rejects a person record');
  /* Retention is a mechanism or it is a sentence. The notice states periods, so
     something has to enforce them. */
  if (!fs.existsSync(path.join(root, 'db', 'retention.neon.sql')))
    fails.push('the retention periods the notice publishes have nothing that enforces them');
  else {
    const ret = fs.readFileSync(path.join(root, 'db', 'retention.neon.sql'), 'utf8');
    if (!/create or replace function purge_expired/.test(ret))
      fails.push('the purge function is gone, so retention is documentation again');
    if (!/interval '12 months'/.test(ret) || !/interval '24 months'/.test(ret))
      fails.push('the retention periods in the code no longer match the ones the notice publishes');
    if (!/ops_retention/.test(ret))
      fails.push('nothing records that retention ran, so the notice cannot claim it did');
  }
  if (!fs.existsSync(path.join(root, 'api', 'retain.js')))
    fails.push('there is no route that runs retention');
  else if (!/requireAdmin/.test(fs.readFileSync(path.join(root, 'api', 'retain.js'), 'utf8')))
    fails.push('the retention route is not behind the admin gate');
  if (!/\.slice\(0, 12\)/.test(ops) || !/toISOString\(\)\.slice\(0, 10\)/.test(ops))
    fails.push('the visitor-day is no longer truncated and rolled daily, which the privacy notice states as fact');
  if (!/priv\.gc\.ca/.test(priv))
    fails.push('the privacy notice gives the reader no route to the Privacy Commissioner');
}

/* ================= THE PAGE OPENS ON THE SCREEN IT MEANS TO ==============
   Every rule that hides the data room, the network, the categories, the board
   and the site footer is scoped to body[data-stage="landing"]. That attribute
   was set by the last statement of an eight and a half thousand line inline
   script, so between first paint and that statement the browser had nothing
   telling it which screen it was on and painted the console instead: a
   different headline, a top bar reading SOURCES 0, and an empty source board
   reading 0 of 0 reached. It was reported by somebody who caught it on a cold
   load. The attribute belongs in the markup, where it applies to the first
   layout. */
{
  if (!/<body data-stage="landing">/.test(html))
    fails.push('the body no longer opens on the landing stage, so the console paints before the script runs');
  /* And the script must still assert it, because a stage change on the way back
     from a report has to be able to return the page to a known state. */
  if (!/document\.body\.setAttribute\("data-stage","landing"\)/.test(script))
    fails.push('nothing sets the landing stage from script, so returning from a report cannot restore it');
  /* The attribute has to come before the first element that depends on it, and
     the only way to guarantee that is for it to be on the body tag itself. */
  const bodyAt = html.indexOf('<body');
  const firstDep = html.indexOf('id="network"');
  if (bodyAt < 0 || (firstDep > 0 && html.slice(bodyAt, bodyAt + 40).indexOf('data-stage') < 0))
    fails.push('the stage is not on the body tag, so the elements below it lay out unstaged');
}

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
