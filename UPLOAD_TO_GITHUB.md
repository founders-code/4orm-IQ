# Upload this to GitHub

Everything in this folder replaces what is in the repo now.

1. Unzip this file.
2. Open your GitHub repo, the one Vercel pulls from.
3. Add file, then Upload files.
4. Drag in ALL of these, from inside the unzipped folder:

   index.html
   admin.html
   vercel.json
   package.json
   README.md
   api/            (the whole folder: 21 files)
   db/             (6 files, including register.neon.sql)
   docs/           (7 files)
   assets/
   tools/          (optional. The checks. Nothing serves from here.)

5. Commit to `main`.

GitHub replaces files that have the same name, so nothing duplicates.
Vercel sees the push and deploys on its own.

## Environment variables

`KBYS_MAX_SEARCHES` should be `10`. The review sweep is three pinned searches
rather than one, so the plan has ten in it. At 8 the two open sweeps at the end
get dropped.

`POSTGRES_URL` switches on the write side, the operations chain and the public
register. See `docs/STORAGE.md`. Until it is set, storage is skipped, the audit
report says so, and the register returns an empty list. Checks are unaffected.

## The one thing to run by hand, once

`db/register.neon.sql` creates the register table. Run it in the Neon SQL
editor. Nothing else needs a migration.

---

# What changed in this build

## The reference is printed once

It is the first line of the report card, at eighteen points, which is where
somebody reads it down a phone to a fraud desk. A second copy in ten point mono
in the top right corner of every screen said the same thing smaller, and it was
sitting in the corner the two pills belong in. It is gone from all four screens.

## The header is three parts, and each owns its edge

The mark on the left, the way back centred on the page, the two pills hard
right. They used to share one flex row, so on "Do this right now" the back
button and the pills fought for the right edge and on "Sources and method" they
wrapped onto a second line. An empty column collapses, so the result screen,
which has no way back, still puts its pills in exactly the same place.

The back button also names the screen it returns to now, rather than always
saying "back to the report".

## What we found offers one thing

A reader reaches that screen by choosing to go deeper. The only thing at the top
is the way back; the way on is the door at the foot of the page. Three ways off
a screen whose whole job is to be read to the bottom is two too many, so the
sources and support pills come off it.

## The three doors are two thirds the size

They went 110, which read as a note, then 220, which read as a billboard. They
are 147 now.

More to the point, the geometry was written out TWICE, identically, three
hundred lines apart, under a comment in each place claiming it lived in one
place so the doors could not drift. They drifted twice. There is now one rule
for the shape and one line each for the colour, and a check that fails if any
single door sets a dimension of its own.

## "Nobody is named anywhere we looked" was not true

Two paragraphs above that line the report prints the regulator's own words:
"Goliath Ventures and its CEO Christopher Delgado have been charged by the SEC
and the CFTC". A person IS named, in a record we read, and the card said we
looked and found nobody.

The card was not wrong about the policy. No source in SR-001 is cleared for
person level output until counsel signs it off, so the name scan returns nothing
and the card fell through to its "we found nothing" branch. But **we do not
publish this** and **this does not exist** are different sentences, and printing
the second when the first is true is exactly the class of small lie this product
exists not to tell.

The scan runs twice now: once gated, which is what may be printed, and once
ungated, which is only ever counted. Where a name exists and is withheld the
card says so: "One person is named in the records below. We do not publish
individuals."

## The whole record no longer has the chat in it

`.chat` carried a bare `display:flex` that applied at every stage. `.landing-only`
sets `display:none` at one class of specificity and `.chat` matches it exactly,
so the later rule won and the entire conversation sat behind the record.

That is the sixth time this cascade has cost this file a bug, and the warning
was the comment directly above the rule. The console opens on the five figures
and nothing else.

## The one page summary comes before the whole record

The summary is the thing most readers actually need: one printable page with the
reference and the date on it, to hand to a bank. The whole record is for
somebody who wants the working. Ordering them the other way asked everybody to
walk past the hard thing to reach the useful one.

## The landing leads with the headline

"Know before you send with 4ormIQ" is capped at 74px rather than 58. The lockup
is sized in em against that line, so the mark grows by exactly the same
proportion and the two cannot fall out of step.

Everything from "A company name is enough to start" sits an inch lower. The
margin is on that line and the search bar, the sentence under it and the five
figures are all its siblings, so they move together.

## The bar does not spend the run in the nineties

Last build fixed a seven and a half second freeze. This one fixes what was left,
which was a different problem with the same symptom: the reasoning call, where
most of a two minute check is actually spent, had a ceiling of ninety. So all of
that wait was walked out inside a nine point band, while the phases that take
seconds had the other ninety points between them. The bar was not lying. It was
telling the truth in the wrong units: it looked finished, and then nothing
happened for a long time.

The phases are re-cut against how long they take. Retrieval, which reads a
hundred and four registers, gets the first two thirds. The reasoning call opens
at seventy two, so it has twenty seven points to walk rather than nine. The walk
toward each ceiling is also half the old rate: eleven per cent of the remaining
distance every ninety milliseconds closed most of any gap inside a second, which
is why the bar kept arriving and then standing there.

Measured over a forty second reasoning call: **326 distinct widths, longest
stall 292ms**, against 170 and 900ms before, and it never enters the nineties
while the work is still running.

## The checks

37 now, all green. Ten new guards this round, every one proved by breaking its
subject and watching the check fail:

    node tools/verify.mjs          the source, about 145 guards
    node tools/spacecheck.mjs      the gutter and the measure, in a real engine
    node tools/waitstable.mjs      nothing moves during a run, 7 viewports
    node tools/smallscreen.mjs     phones, and short windows, which differ
    node tools/smoke.mjs           and smoke2 through smoke32
