# 4orm - KNOW BEFORE YOU SEND
## Putting it on 4ormfinance.com and wiring it to a live model
### Build note, 25 August 2026

---

## PART 1 - GETTING IT ONLINE

The page is one self-contained file. It needs nothing built and nothing installed.

### 1.1 Files

```
4orm-Finance/
  know.html                <- the console
  assets/logo.png          <- already in the repo, referenced as assets/logo.png?v=20260825
  vercel.json              <- already in the repo, add the rewrite below
```

`know.html` references exactly one external asset of ours, the logo, at
`assets/logo.png?v=20260825`. Nothing else is bundled and nothing else is fetched
except Google Fonts. If the logo file is absent the brand element hides itself rather
than showing a substitute.

### 1.2 The route

Add a rewrite so the page serves at `/know` rather than `/know.html`, matching how
`/mortgage` already works:

```json
{
  "rewrites": [
    { "source": "/know", "destination": "/know.html" }
  ]
}
```

Push to the repo. Vercel builds and it is live at `4ormfinance.com/know`.

### 1.3 The one thing to decide before it ships

The site chrome is light. This page is black, on your instruction. Two options:

- **Keep its own nav pill.** The page stands alone as a product surface, the way a
  console should. This is what is built now.
- **Inherit the site nav.** Consistent with the rest of the site, and it will fight the
  black ground.

Recommend the first, and link to `/know` from the main nav rather than wrapping it.

### 1.4 Cache

`/assets/*` is served one-year immutable. Every asset reference already carries
`?v=20260825`. When the logo or any asset changes, bump that date or the browser
serves last month's file. This has cost an afternoon before.

---

## PART 2 - WIRING IT TO A LIVE MODEL

Today the console reads a seeded corpus of two entities. Everything else returns grey.
Making it search for real is one endpoint.

### 2.1 Why this is small

The front end already speaks a defined contract. It renders whatever object it is
handed: dials, stat strip, nine tiles, evidence cards, claims table, material issues,
before-you-send, coverage gaps. **Nothing in `know.html` has to change except where it
gets the object from.**

One line changes. In `check()`:

```js
// now
var d = CORPUS[key];

// then
var d = await fetch('/api/check', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ q: q })
}).then(function(r){ return r.json(); });
```

### 2.2 The endpoint

`api/check.js` in the repo root. Vercel picks up `/api/*` automatically, no config.

```js
export const config = { maxDuration: 300 };   // Hobby and Pro both allow 300s

import Anthropic from '@anthropic-ai/sdk';
import { SEARCH_CUE } from './_cue.js';        // the v1.0 cue, verbatim
import { PAYLOAD_SCHEMA } from './_schema.js'; // the output contract

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  const q = (req.body?.q || '').trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'no identifier supplied' });

  const msg = await client.messages.create({
    model: process.env.KBYS_MODEL,
    max_tokens: 16000,
    system: SEARCH_CUE,
    tools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 25 },
      { name: 'emit_assessment',
        description: 'Return the completed 4orm assessment.',
        input_schema: PAYLOAD_SCHEMA }
    ],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: 'Run a full Know Before You Send check on: ' + q }]
  });

  const out = msg.content.find(b => b.type === 'tool_use' && b.name === 'emit_assessment');
  if (!out) return res.status(502).json({ error: 'no assessment produced' });
  res.status(200).json(out.input);
}
```

Three pieces do the work:

- **`SEARCH_CUE`** is the v1.0 cue as the system prompt, unaltered. It already carries
  the standing orders, the nine categories with their decision rules, the tier ladder,
  the contradiction loop, the scoring model, the verdict order and the prohibitions.
- **`web_search`** is Anthropic's server-side search tool. Claude decides what to
  search and how many times; `max_uses` is the ceiling. Versions available:
  `web_search_20250305`, `web_search_20260209`, `web_search_20260318`. Supported on
  Claude 4.6 and later.
- **`emit_assessment`** is a forced tool call whose `input_schema` is the payload
  contract. Forcing it at the tool-call layer means the model retries on a shape
  mismatch instead of returning prose you have to parse. **Do not ask for JSON in the
  prompt and hope.**

### 2.3 Environment

Two variables in Vercel project settings, never in the client:

```
ANTHROPIC_API_KEY   = sk-ant-...
KBYS_MODEL          = <the model identifier you choose>
```

### 2.4 Duration

Vercel function limits, with fluid compute on by default:

| Plan | Default | Maximum | Extended |
|---|---|---|---|
| Hobby | 300s | 300s | - |
| Pro | 300s | 800s | 1800s, beta |
| Enterprise | 300s | 800s | 1800s, beta |

Five minutes on the free tier is more than a full sweep needs. Duration is not the
constraint. But note the caveat in Vercel's own docs: over HTTP/1.1, idle connections
can be closed by intermediate layers on long requests, so stream progress rather than
holding a silent connection for minutes.

### 2.5 Making the progress bars real

The four wave bars are currently on a timer. Stream instead and they become truthful:

- Return Server-Sent Events from the endpoint.
- Emit an event each time a `web_search` tool block appears in the stream, carrying the
  query text.
- The client advances the matching wave bar and writes the query into the `.wnow` line.
- The final event carries the payload.

The console then shows what it is actually doing, source by source. That is a better
demo than the timer, and it is the honest version.

---

## PART 3 - WHAT IT COSTS

**Web search:** $10 per 1,000 searches, plus normal token cost for the content the
search returns.

At 25 searches per check that is $0.25 of search per check, before tokens. Tokens will
be the larger number: the cue is a long system prompt and search results are heavy
input.

**Do not model this from a guess.** Run twenty checks, read the actual usage, then
build the unit economics. That is a half-hour of work and it produces a real number
instead of an argued one.

Two controls worth having from day one:

- `max_uses` caps searches per check. Start at 25.
- Cache by identifier. The same domain checked twice in a week should serve the stored
  assessment, not re-run the sweep. This also starts the evidence corpus, which is the
  point.

---

## PART 4 - GUARDRAILS BEFORE IT GOES PUBLIC

The cue carries the behavioural rules. These are the operational ones.

1. **Rate limit the endpoint.** A public search box on a Vercel function with an API
   key behind it is a metered resource pointed at the open internet. Per-IP limit plus
   a daily ceiling, from the first deploy.
2. **Cap and sanitise the input.** 200 characters, stripped. The client already escapes
   on render; the server should not trust that.
3. **Store every assessment.** Identifier, payload, timestamp. This is both the cache
   and the beginning of category 09, which cannot work until the corpus exists.
4. **Keep grey honest.** If the model returns thin coverage, the console must show grey
   rather than a confident colour. The cue's coverage floor already says this. Verify it
   holds in live output before anyone outside sees it.
5. **Log the refusals.** Any run that produces no assessment, or an assessment that
   fails schema validation, gets recorded. Those are the cases that teach you where the
   cue is thin.

---

## PART 5 - THE ORDER TO DO IT IN

**Today.** Push `know.html` and the rewrite. It is live at `/know` as a working
demonstration with two real entities, and nothing about it is misleading: anything
outside the corpus says so.

**This week.** Stand up `/api/check` with the cue and web search. Rate limit it. Point
the console at it behind a query flag, `?live=1`, so the seeded version stays the safe
public one while you test.

**Next.** Add the connectors that answer machines directly, rather than through search:
ICANN RDAP, SEC EDGAR, the FCA register, ASIC's JSON alert list, the UN and Canadian
sanctions XML, VirusTotal, urlscan. Each one you add makes a category faster, cheaper
and more certain than a search result about that source.

**The long road.** The Canadian core - CSA National Registration Search, the BCSC and
ASC caution lists, CIRO, the provincial corporate registries - publishes no feed at all.
Those are licensing and partnership conversations, and they are the moat precisely
because they are hard. Start them in parallel with the engineering, not after it.

---

*4orm Finance - Know Before You Send - build note, 25 August 2026*
