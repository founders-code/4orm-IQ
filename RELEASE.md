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
