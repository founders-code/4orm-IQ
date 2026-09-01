# 4orm IQ, release notes

Know Before You Send. Consumer verification console for 4orm Finance.

## What is in this build

A finished check now lands on a **report**, not on the board. The board is still
there, one click behind it.

- **The report** is the answer: the verdict, what the record holds, the three
  figures, what was found, what they claim against what the register says, what
  to do before you send, and a document pack for each body you may have to
  contact. It is written entirely from the run's own payload. Nothing about a
  party is baked into the page.
- **Sources and method** explains the logic, the four things we will not do, the
  lawful considerations, and the four tiers of source.
- **What is behind this report** opens the full console: the two dials, the
  source board, the ten checks, the cross examination, the operator graph and the
  audit report. A control in the console nav comes back to the report.

## The recipient packs

Nine bodies, each with the document that body publishes a requirement for. Every
field, phone number and deadline was read off that organisation's own page:

your bank or credit union, your card issuer, your local police, the Canadian
Anti-Fraud Centre, Competition Bureau Canada, the British Columbia Securities
Commission, FBI IC3, the US Federal Trade Commission, and the crypto exchange.

Clicking one opens the whole document; the download sits at the foot of it. The
"what the record already shows" section of each pack is filled from the live run,
so the file a person downloads carries that party and that run's reference.

The only published numeric deadline anywhere is CIBC's thirty days from statement
date for a card dispute. No other pack carries a number, because no other body
publishes one.

## Names on the record

The record card carries a **Names mentioned** line, and every name that sits on
an official record gets its own line beneath it, labelled with the body that
holds it. None of them is summarised away: a name on a regulator's file is often
the only lead a person has when they call their bank or the police, so all of
them are carried, and all of them go into every downloadable pack.

A name is only printed when it came from a node the pipeline typed as a person,
or from an official record whose own sentence names a role: appointed, director,
officer, principal, promoter, named as. Without that cue a capitalised pair of
words is as likely to be a company, and a company printed as a director on a
page somebody hands to their bank is worse than printing nothing.

## Reading the packs

The nine recipients are one column, top to bottom. A frightened person works
down a list; they do not scan a grid in two directions. Each row carries the
number, the name, why you would open it, and what that body actually does with a
report, because "records and refers" is the thing most worth knowing before
spending an hour on a form.

## The board, once a result exists

The board is the working behind an answer the reader has already been given, so
the landing pitch, the type pills and the search bar come off it and everything
moves up. A new check starts from the control in the nav.

Every card on the board that opens something says **Read more**, underlined, in
the space at its foot. It replaced a question mark, which asked a question
rather than saying there was a page of working behind the card. Eighteen cards
carry it: the five figures across the top, the seven rail cards, and the six
composition bars.

## Opening a check

A check opened from the board explains itself in three parts.

**What we found** comes first, because that is what a reader opened it for.

**How we decide this check** lists the rules, and marks the one that actually
fired for this party. Everything else is dimmed. The badges say what an outcome
is, not what colour it is: counts against them, counts in their favour, cannot
be settled, we never do this.

**The registers behind this check** name every register we ask, and what each
one said about this party on that run: answered with a record, asked and nothing
on file, we could not open it, does not apply here. The dot beside each is the
same colour it carries on the source board, so the board and the table are the
same fact said twice.

Access and terms came off that table. Whether a register is reached over a web
form or an API, and whether its licence is open or restricted, is our plumbing.
It is in the catalogue where it belongs.

## Deploying

Vercel, Node 20 or later. `api/check.js` is given 300 seconds in `vercel.json`.

Environment variables, set in the Vercel project and nowhere else:

| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | the assessment. Without it the endpoint answers 503 |
| `EXA_API_KEY` | tier 1 retrieval. Absent, it returns empty and is published as a gap |
| `PARALLEL_API_KEY` | tier 2 retrieval. Same behaviour when absent |
| `POSTGRES_URL` | cross run memory. Absent, a run still completes and is not stored |

Never commit a key. Never move the 4ormiq.com nameservers to Vercel: live email
runs on that domain.

The console reads the seeded corpus by default. Add `?live=1` to the URL to post
to `/api/check` instead.

## Before launch

1. `POSTGRES_URL` is unset. Until it is set, nothing is written to the graph and
   every run starts cold. `db/schema.sql` creates the eleven tables.
2. The service levels on the sources page, two business days to acknowledge a
   challenge, thirty days to complete a re-check, and notice to anyone who
   received the result in the previous six months, are a published promise. They
   need counsel sign off before this goes public.

## Checking a build

    node tools/verify.mjs          the build check, exits non zero on a failure
    node tools/smoke.mjs           and smoke2 through smoke17
    node tools/graph-tests.mjs     operator graph scoring and routing

`tools/verify.mjs` guards the things that have broken before: duplicate ids,
duplicate CSS layout properties, a script reference to an element that no longer
exists, the ten checks, the board against the catalogue, the plain language
layer, the report stage and its scoping, and both paths from a finished run into
the report. Every guard was proved by breaking its subject and watching it fail.

## SR-001 controls the build

The source register is no longer documentation. `tools/sr001-build.mjs` reads
`legal/SR-001-source-register.xlsx` and writes the manifest into `index.html`
between the `SR001-MANIFEST` markers. Never edit that block by hand.

    node tools/sr001-build.mjs ../../legal/SR-001-source-register.xlsx index.html

The generator refuses to write if any source the build queries is missing from
the register. A source whose Operational status is not `ENABLED` is never
planned into a search and draws on the board as `policy`: out of scope, which is
its own state and never means reached and never means clean.

`SR001_ENFORCE` is `true`. Every register on SR-001 carries a draft
classification and an operational status, so enforcement selects rather than
blanks: 68 registers are in scope and 36 are held out because they appear on the
board with no source row behind them. If it is ever turned off, a dev-only
banner appears and `node tools/verify.mjs --production` fails.

    node tools/verify.mjs --production

`tools/smoke19.mjs` runs the page both ways and measures the board, so the switch
is proved to change what a reader sees rather than only what the source says.


## Operations telemetry

`db/telemetry.sql` and `api/admin-metrics.js` serve the OPS-001 s.51 metric list.
`admin.html` renders it.

    psql "$POSTGRES_URL" -f db/telemetry.sql
    # then set ADMIN_TOKEN in Vercel and open /admin.html

Environment, all required for the back office to open:

| Variable | What it does |
|---|---|
| `POSTGRES_URL` | the operations log. Unset, nothing is recorded and the counter shows nothing |
| `OPS_SALT` | salts the visitor-day. Unset, no visitor-day is written and the people figure is null. Never ship without it: an unsalted hash of an IP address is an IP address with extra steps |
| `CLERK_SECRET_KEY` | verifies the session token server side |
| `ADMIN_EMAILS` | comma separated allowlist. Clerk proves who somebody is; this decides whether they get in |
| `ADMIN_ORG_ROLE` | optional, an org role that also grants access |

The publishable Clerk key goes on the `data-clerk` attribute of the body tag in
`admin.html`. It is public by design. The secret key never appears in a page.

With Clerk unconfigured the route returns 503 and is disabled outright rather
than left open. That direction is deliberate: a misconfigured deployment locks
the door rather than removing it.

## The evidence layer

The operations log is hash chained. Every row carries the hash of the row before
it and its own hash over that plus its own eighteen fields. Alter a row after
the fact, delete one, or reorder them, and every hash after that point stops
matching.

    GET /api/evidence          the chain head and the last five verifications
    GET /api/evidence?run=1    walk the chain now and report

Both are admin only, because walking the chain is the expensive operation here.

What it buys: the counter on the landing page stops being a number we assert and
becomes a number somebody can check. Competition Act s.74.01(1)(b) puts the onus
of substantiating a performance claim on us, and a chain head plus a dated
verification run is what discharging that looks like.

What it does not do: it says nothing about whether a check was right, and it does
not establish legal admissibility.

`tools/smoke21.mjs` proves the chain properties without a database. All eighteen
fields are covered by the hash, a rewritten row is detected at its own position,
a deleted row is detected, and an untampered chain verifies.

## The public counter

    GET /api/counter

Serves `checks`, `people` and the chain head. `checks` is completed runs.
`people` is distinct visitor-days, which is a floor and never a headcount, and
it is null when `OPS_SALT` is unset.

The landing page label was `Customers served` and both words were wrong: nobody
is a customer, the product is free and has no accounts, and one person can run
several checks. It reads **Checks run** now, with twelve characters of the chain
head beside it.

**There is no column anywhere in the operations schema for the identifier a user
searched, the party a check was about, or the result it returned.** That is
deliberate and it is guarded: `tools/smoke20.mjs` fails if `db/telemetry.sql`
grows such a column, and it fails if the metrics endpoint returns a response key
nobody vetted. An administrator can see how the machine is running; they cannot
see who anybody asked about. If somebody asks for a search-history screen, the
answer is that the column does not exist, and the reason is written at the top of
`db/telemetry.sql`.

## Test suite

    node tools/verify.mjs                 # static guards, 40+
    node tools/verify.mjs --production    # adds the deploy gate
    node tools/smoke.mjs ... smoke20.mjs  # 20 behavioural suites
    node tools/graph-tests.mjs            # 40 assertions

Every guard in `verify.mjs` was proved by breaking its subject and watching the
suite fail. That log is the evidence OPS-001 s.45 asks for.
