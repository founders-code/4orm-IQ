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
api/check.js          POST /api/check - orchestrates the four tiers
api/_connectors.js    Tier 0. RDAP, DNS, sibling check. No key, no cost
api/_retrieval.js     Tier 1 and 2. Exa and Parallel, plus the register domains
api/_cue.js           the Search Cue v1.0 as the system prompt
api/_schema.js        the output contract, enforced at the tool-call layer
assets/               drop the real logo.png here. read the note inside first
docs/SEARCH_CUE.md    the cue as a human document. keep in step with _cue.js
docs/PIPELINE.md      how the four tiers fit together
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

Off by default. The console reads a seeded corpus of entities retrieved from
real public records, and returns **grey** for anything else. That is a safe
state, not a broken one.

### The three keys

| Variable | Where | Cost | Missing key |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | platform.claude.com | tokens | 503, live checking off |
| `EXA_API_KEY` | exa.ai | ~$1.50 / 1k, 1,000 free monthly | Tier 1 skipped, declared as a gap |
| `PARALLEL_API_KEY` | parallel.ai | ~$0.005 / 10 results | Tier 2 skipped, declared as a gap |

Set them in Vercel under Settings, Environment Variables. Add `KBYS_MODEL` too.
Redeploy, then open `yourdomain.com/?live=1`.

Only the Anthropic key is required. Without the other two the check still runs
on whatever answered, and says in `coverage_gaps` exactly what it could not
reach. Nothing degrades into a confident answer.

### What runs, in order

**Tier 0, connectors.** No key, no cost, milliseconds. ICANN RDAP for the domain
record, DNS for mail configuration, then a sibling check that re-runs RDAP
against the domains Exa surfaced. Shared nameservers mean one operator behind
two brands. This tier is the only place coverage is counted rather than
estimated.

**Tier 1, Exa.** Eight searches in parallel, six of them pinned with
`includeDomains` to 63 register domains, so a search returns the regulator's own
page rather than an article about it. The negative review search is pinned to
the fifteen review platforms and nothing else.

**Tier 2, Parallel.** Three objectives that no single page answers: the negative
review narratives, regulatory standing, and the operator pattern behind the
brand.

**Tier 3, Claude.** One call, **no search tool.** Everything found is assembled
into an evidence brief and handed over with the cue as the system prompt and a
forced schema. The model reads, cross-examines and emits. It cannot search, so
it cannot quietly fill a gap with something it went and found.

Retrieval is cheap and parallel. Judgment is expensive and happens once.

Full detail in `docs/PIPELINE.md`.

### Adding a register

`DOMAINS` in `api/_retrieval.js`. One line per domain, grouped by the check it
serves. Adding a regulator raises coverage for every check from that point on.

### What it costs

Read the `pipeline` block on every response. It carries Exa's actual
`cost_usd`, Parallel's call count, Claude's token counts and the wall clock for
each tier.

Do not model this from a guess. Run twenty checks, read the real numbers, then
build the economics. Expect tokens to dominate: retrieval is fractions of a
cent, and the Claude call reads everything the first three tiers found.

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
