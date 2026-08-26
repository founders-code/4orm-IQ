# 4orm - Know Before You Send

The verification control centre. One identifier goes in; nine categories of
public record come back, with every source named, every gap published, and the
contradictions laid side by side.

Deploys to Vercel as a static page plus one serverless function. No build step,
no framework, no bundler.

---

## What is in here

```
index.html            the console. one self-contained file, no dependencies
api/check.js          POST /api/check - runs a live sweep, returns the payload
api/_cue.js           the Search Cue v1.0 as the system prompt
api/_schema.js        the output contract, enforced at the tool-call layer
assets/               drop the real logo.png here. read the note inside first
docs/SEARCH_CUE.md    the cue as a human document. keep in step with _cue.js
docs/DEPLOY.md        deployment and wiring notes
docs/LIVE_RUN_investhelm.md   a real assessment, run 25 Aug 2026
docs/PAYLOAD_EXAMPLE.json     the shape the console renders
vercel.json           function duration and cache headers
.env.example          the three variables. copy, never commit the real one
```

---

## Deploy it

1. Push this folder to GitHub.
2. Vercel - **Add New - Project** - import the repo. No framework preset, no
   build command, no output directory. Zero config is correct here.
3. Deploy.

It serves at the `.vercel.app` URL immediately. The console works out of the box
on its seeded corpus with no API key, no environment variables and no backend.

### Custom domain

Project - **Settings** - **Domains** - add the domain, then add the records
Vercel prints at your registrar. If the domain carries email, **do not move the
nameservers to Vercel** - Vercel's zone starts empty and mail stops silently.
Add an A record and a CNAME at the existing DNS host instead.

---

## Turn on live checking

Off by default. The console reads a small seeded corpus of entities retrieved
from real public records on 25 August 2026, and returns **grey** for anything
else. That is a safe state, not a broken one.

**Step 1.** Vercel - Settings - Environment Variables:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key |
| `KBYS_MODEL` | a model that supports the web search tool |
| `KBYS_MAX_SEARCHES` | `25` to start |

**Step 2.** Redeploy so the function picks the variables up.

**Step 3.** Visit `yourdomain.com/?live=1`.

The console shows a **Live checking** badge, and every identifier typed runs a
real sweep instead of reading the corpus. Drop the `?live=1` and it is back on
the corpus. Keep it that way on the public URL until you have watched twenty
real runs.

With no key set, `/api/check` answers `503` and the console says live checking
is not switched on. It does not fall back to something that looks real.

### How the endpoint works

`api/check.js` does three things: guards the request, runs one call, and
translates the result.

- **The cue is the system prompt**, unaltered. Everything the engine may and may
  not do lives in `docs/SEARCH_CUE.md` and is mirrored into `api/_cue.js`.
- **`web_search`** is Anthropic's server-side tool. The model decides what to
  search; `max_uses` is the ceiling.
- **`emit_assessment`** is a forced tool call whose `input_schema` is the output
  contract. Forcing the shape at the tool layer means the model retries on a
  mismatch instead of returning prose to parse. Never ask for JSON in a prompt
  and hope.
- **`toRenderShape()`** turns the semantic assessment into the positional shape
  the console draws. The model never sees the render shape, because models get
  positional arrays wrong and get named fields right.

### What it costs

Web search is billed per search on top of tokens, and tokens will be the larger
number - the cue is a long system prompt and search results are heavy input.

Do not model this from a guess. Run twenty checks, read the actual usage
reported back in `payload.usage`, then build the unit economics.

---

## Before it faces the public

1. **Move the rate limiter.** `api/check.js` counts in memory, which resets on
   every cold start and is per-instance. It stops a hammering tab, not a
   determined one. Use Vercel KV or Upstash for a real counter.
2. **Cache by identifier.** The same domain checked twice in a week should serve
   the stored assessment. That halves the bill and starts the evidence corpus.
3. **Store every assessment.** Category 09, the proprietary signals, cannot work
   until that corpus exists. Search velocity, identifier reuse, beneficiary
   reuse and infrastructure clusters are all patterns across prior checks. Today
   they return grey because there is nothing to compare against.
4. **Watch the coverage floor hold.** Thin evidence must render grey, never a
   confident colour. Verify that in live output before anyone outside sees it.
5. **Log the failures.** Any run that produces no assessment, or one that fails
   schema validation, gets recorded. Those are the cases that show where the cue
   is thin.

---

## The rules the product is built on

These are not style preferences. They are the reason it can be trusted.

- **No trust score.** Two numbers only: identity confidence and evidence
  coverage. A single number out of a hundred gets read as permission.
- **Verdict order is red, then grey, then yellow, then green.** Green is the last
  thing the engine may conclude and never the default.
- **A category that could not be reached is grey.** Never green.
- **Coverage gaps are published.** A report showing only what it found lies by
  omission. The gap list is also the connector backlog, generated free by every
  run.
- **Tier C and D never carry red alone.** A forum post does not outweigh a
  regulator. They are promoted only when Tier A or B corroborates.
- **Read the one-star reviews first.** Positive reviews are cheap to
  manufacture; negative ones are not, because nobody is paid to write one. The
  signal is the same mechanic in different people's words across platforms that
  do not share a user base - never volume on any one platform.
- **Nothing is ever invented.** No licence number, registry reference, case
  number or filing date that was not read from a record. A fabricated regulator
  hit is the single failure this product cannot survive.

---

## The demo entities

| Identifier | What it shows |
|---|---|
| `investhelm.com` | Real. On the BCSC Investment Caution List since 14 Jul 2026. Every record retrieved 25 Aug 2026 |
| `nexlares.com` | Real. Shares all three nameservers and its registrar with the above |
| `atlanticglobalwealth.com` | **Specimen. Does not exist.** Every figure invented, labelled as such on screen, present only to show a fully populated assessment |
| anything else | Grey. The corpus does not contain it, and inventing a result is the one thing this must never do |

---

## What the console shows

**Standing by.** The instruments read the network: how many registers the engine
reaches for, how many are authoritative, how many answer machines directly. The
source board sits dark, every light ready.

**During a check.** The board lights source by source in three waves, and the
counter climbs. A dark light is a source that was not reached. It is never a
source that came back clean, and the legend says so.

**When it finishes.** A green light appears: **Open audit report.** That is the
whole record in one scrollable document - the finding, both measures, every
source and what each returned, all nine checks with the verbatim records
underneath, the cross-examination table, the negative review report card, the
ranked issues, what to do before sending, and every gap.

## Find support

Top right of the navigation, and again under the result. It opens a directory
that leads with triage rather than taxonomy: **what has already happened?** Five
routes, each landing in the right folder with a line of context. A persistent
rail on the left switches category in one click, and the filter at the top
searches every contact, number and step at once.

**One rule in there does not bend.** No individual lawyer, firm or recovery
service is ever named, and every telephone number was read off that
organisation's own published contact page. Where the responsible answer is a
referral service rather than a name, that is what it gives.

## Editing the console

`index.html` is one file. The parts you will touch:

- `:root` - the design tokens. Every colour, radius and easing.
- `NET` - the idle-state instrument readings.
- `CATS` - the nine categories and the registers behind each one.
- `CORPUS` - the seeded entities.
- `DIR` - the Find support directory.
- `SOURCES` - the source board, grouped by the check each register serves.
- `TRIAGE` - the five situation routes at the top of the directory.

**The support directory has one rule that does not bend:** no individual lawyer,
firm or recovery service is ever named, and every telephone number in it was
read off that organisation's own published contact page. Where the responsible
answer is a referral service rather than a name, that is what it gives.

---

*4orm Finance*
