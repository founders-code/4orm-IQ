# 4ormIQ

The consumer trust layer in front of 4orm Finance. Published at
**www.4ormiq.com**, deployed from `main` by Vercel, project `4orm-iq`.

No build step, no framework, no bundler. Static pages plus serverless
functions. What is in the repository is what is served.

---

## Pages

| Served at | File | What it is |
|---|---|---|
| `/` | `index.html` | The check. One identifier in, nine categories of public record back, every source named and every gap published. |
| `/admin` | `admin.html` | Operations. Behind the Clerk gate. Carries the change register, embedded at build time. |
| `/evidence` | `evidence.html` | The evidence scaffolding, drawn as a map. |
| `/real-run-live-go` | rewrite to the check | The live-run gate. Not indexed. |

`4ormiq-business.html` and `4ormiq-story.html` are the product visuals that go
into decks. They are pages, not routes.

## The API

Eight endpoints. Vercel routes every `api/*.js` that does **not** start with an
underscore; the underscore files are helpers and are never reachable from the
web. That convention is load bearing, so do not rename a helper to drop it.

| Endpoint | Job |
|---|---|
| `/api/check` | The sweep. Orchestrates the four retrieval tiers. 300s ceiling. |
| `/api/evidence` | The evidence record behind a result. |
| `/api/register` | The public register of parties carrying a finding. |
| `/api/audit` | The audit trail. |
| `/api/retain` | Retention. |
| `/api/counter`, `/api/stats` | Counts. |
| `/api/admin-metrics` | Operations figures. Gated. |

Helpers of note: `_catalogue.js` is the source of truth for every register,
`_cue.js` is the Search Cue as the system prompt, `_schema.js` is the output
contract enforced at the tool-call layer, `_auth.js` is the Clerk gate.

**The register count is computed, never typed.** `_catalogue.js` exports
`TOTAL_SOURCES`, which today is 135: 152 entries with 17 disabled. If a page
prints a number for it, that number has to come from there.

## Configuration

Every key is read from the environment. Nothing is committed.

```
ANTHROPIC_API_KEY  EXA_API_KEY  PARALLEL_API_KEY
POSTGRES_URL  CLERK_SECRET_KEY
ADMIN_EMAILS  ADMIN_ORG_ROLE
CORPUS_SALT  OPS_SALT  KBYS_SCHEDULE_SECRET
KBYS_MODEL  KBYS_QPS  KBYS_MAX_SEARCHES  KBYS_MAX_ROUND2
KBYS_BUDGET_STORE  KBYS_PULSE_LABEL_AT  KBYS_SCHEDULE_WINDOW_S
```

## Layout

```
index.html  admin.html  evidence.html     the served pages
api/                                      8 endpoints + helpers
assets/                                   brand marks and favicons
vercel.json                               rewrites, headers, function limits

tools/                                    build and verification. not deployed
docs/                                     internal docs + change register. not deployed
db/                                       schema. applied by hand. not deployed
reports/                                  internal reports. not deployed
archive/                                  superseded pages, kept for history. not deployed
```

`.vercelignore` is what keeps the lower block off the public domain. Everything
there stays in git; it just stops being downloadable from the live site.

## Checks

```
npm test        the full suite: verify, graph tests, then every smoke file
npm run uxgate  the measured accessibility and layout ceiling
```

`tools/uxgate.mjs` measures contrast, target size, control names, focus rings,
heading count and horizontal overflow at 1440, 390 and 320, and compares
against the recorded ceiling in `tools/ux-budget.json`. **The budget travels one
way.** It is never raised to turn a build green.

## Brand marks

`assets/mark-4orm-iq.png` and `assets/logo-4orm.png` carry white lettering, so
they read on a dark ground only. `assets/mark-4.png` is the blue 4 alone and
reads on white. No brand asset is ever generated, traced, recoloured, inverted
or placeheld. If a mark will not read on a ground, change the ground.

## House rules that bite here

No icons anywhere, text labels instead. No thin grey divider lines. 24-hour
times. Say "consumer", not "person". Say "the challenge", not "the problem". No
em dashes. Blue is `#2E6BF2`. Pills and chips are always rounded. The public
site is white ground and is never dark-moded; the operations side is a separate
dark house and the two are never mixed.

A result never says "verified" or "no issues found". A source that was reached
and held nothing, and a source that could not be reached at all, are two
different states and both are written in words. Silence is never clearance.
