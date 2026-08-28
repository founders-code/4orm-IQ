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
