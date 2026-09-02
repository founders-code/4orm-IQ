# Upload this to GitHub

24 files. Every one of them runs. Nothing here is documentation, a test or a
leftover, so if a file is in this folder it is because the site stops working
without it.

1. Unzip.
2. Open your GitHub repo, the one Vercel pulls from.
3. Add file, then Upload files.
4. Drag in everything from inside the unzipped folder:

   index.html
   admin.html
   vercel.json
   package.json
   api/     (19 files)
   db/      (register.neon.sql)

5. Commit to `main`. Vercel sees the push and deploys on its own.

GitHub replaces files with the same name. It does not remove files you do not
upload, so the `docs/` and `tools/` folders already in the repo stay exactly
where they are and are untouched by this.

## Two files to DELETE from the repo by hand

Uploading cannot remove anything, so these two have to go manually. Neither is
harmful today. Both are dead and both look alive, which is how somebody ends up
debugging the wrong file at eleven at night.

    api/stats.js         the counter endpoint before it was renamed. The page
                         has called /api/counter for three builds.

    api/_reference.js    imported by nothing.

On GitHub: open the file, the three dots at the top right, Delete file, commit.

## The one thing to run by hand, once

`db/register.neon.sql` in the Neon SQL editor. It creates `ops_register`, the
table behind the public register. Nothing else needs a migration.

## Environment variables

    KBYS_MAX_SEARCHES = 10      ten searches in the plan. At 8 the two open
                                sweeps at the end get dropped.

    POSTGRES_URL                switches on the write side, the operations chain
                                and the register. Until it is set, storage is
                                skipped and the register is empty. Checks are
                                unaffected.

## The five endpoints this creates

    /api/check           the check itself
    /api/counter         how many checks have been run
    /api/register        the public register, read only, no auth by design
    /api/evidence        one stored run, for the back office
    /api/admin-metrics   the back office figures

All five are used. There are no others.

# What changed in this build

## The nine packs were never finished

Eight of the classes that view writes had **no CSS rule at all**: the write-on
lines, the numbered chips, the pre-filled rows, the notes, the small print. The
markup was right, the words were right, and it rendered as a wall of unbroken
sentences with a stray digit in front of some of them. It read like a text file
somebody forgot to finish, which is what it was.

They are four numbered steps now, in the order they happen, one job in each:
what we already filled in (shaded, so it is obvious there is nothing to do
there), what they will ask you (with a line to write on), what to have with you,
and what is worth knowing before you call. Every phone number, email and web
address is a link. Every one of the nine has been rewritten in plain words: no
adjudicates, no drawn down, no chargeback against the merchant's acquirer.

## The check that would have caught it

No test that reads behaviour can see that a page looks unfinished. This one
reads intent: **if the page writes a class, somebody meant it to look like
something.** It compares every class the markup and the script emit against
every class the stylesheet declares.

It found ten more on its first run, all real: the table in the audit sheet with
no table styling, the category dot and its state word, the paragraph inside
every explanatory modal, a 720px table with nothing to scroll it, the mark in
the top left of the landing, a phone number with no link to dial sitting bare in
a row of pills, and the paragraph that tells a reader we found something and
did not print it, which is the most important line in the report.

## And the check for the other half of it

A second one for a fault that has now appeared three times: a container painted
the border colour with children painted the surface, so the gaps read as
hairlines. If the children do not cover the container the border colour shows
through as a slab of grey where content should be. It caught the figures row on
the result screen, which had three fixed columns and, for a company with a thin
record, one figure to put in them. Nine hundred pixels of exposed grey beside a
single number.

Both checks run against a SPARSE result as well as a full one, because that is
the only state in which most of these can fail.

## What we found was blank for a thin record

Both its sections hide when they have nothing in them, so a company with no
adverse record AND nothing in its favour got a headline, a standfirst and a
button on an empty page. It read as a page that had failed to load.

It now says so: we did not find anything either way, this is not the same as a
clean result, here is how much of the register we actually reached, and here is
what to ask them in writing before you send anything.

## The bar is a clock now

Three builds of this were a ceiling per phase, and each had the same fault in a
different place, because the phases do not take the time their ceilings imply.
It reached seventy in fifteen seconds and then spent a minute on the next
thirty. Re-cutting the ceilings moved the lump; it could never remove it,
because a ceiling is a guess about duration wearing the clothes of a
measurement.

So it stops guessing. It walks from one to ninety nine at a constant rate over
the two minutes a check takes. Events change the words underneath it, which is
what they are for. Measured over a forty second run: **19.7 points in the first
half, 19.3 in the second. 0.824 points a second.** A run that finishes early
jumps to a hundred. A run that goes long eases toward ninety nine and never
arrives, because only a finished assessment writes a hundred.

## The dark flash between the wait and the result

The overlay faded out first and the report was rendered 240ms later, so for a
quarter of a second the reader watched the dark console through a fading sheet
and then a white document appeared on top of it. The order was wrong. The report
is rendered first, underneath an overlay still at full opacity, and only then
does the overlay lift. Sampled every animation frame across the handover: **zero
dark frames.**

## Sources and method, in plain words

Same facts, same attributions, half the syllables. Retrieval decides what was
reached became finding a record and reading it are two different jobs. Dark is
three things became an empty register means three different things. Inclusion of
a party in a 4orm result became what being in this report does not mean.

## The landing

The headline and the 4ormIQ mark are back where they were vertically, and
everything from "A company name is enough to start" sits an inch lower. The
margin is on that line and the search bar, the sentence under it and the five
figures are all its siblings, so they move together.

When the thread opens, the line explaining what the search bar takes comes off,
because the bar is gone and it is answering a question nobody is being asked.

## Smaller

- The reference stamp is gone from the top right of every screen. It is the
  first line of the report card, which is where somebody quotes it from.
- The mono on the report card is up a step, on the card people read down a
  phone to a fraud desk.
- The yellow wash behind the first two things to do in Find support was a gold
  seam colour showing through a two pixel grid gap. Ordinary border colour now.
- Open the whole record is See the technical data room.
- Six of the classes fixed above were in the console and the audit sheet, which
  nobody had looked at in months.

## The checks

40 now, all green:

    node tools/verify.mjs          the source, about 155 guards
    node tools/frames.mjs          no frame shows its own ground
    node tools/handover.mjs        no dark frame between wait and report
    node tools/spacecheck.mjs      the gutter and the measure, in a real engine
    node tools/waitstable.mjs      nothing moves during a run, 7 viewports
    node tools/smallscreen.mjs     phones, and short windows, which differ
    node tools/contactsheet.mjs    every screen and every state, as pictures
    node tools/smoke.mjs           and smoke2 through smoke32

`contactsheet.mjs` is the new one and it is not a test. It produces a picture of
every screen and every state, including all nine packs, and a person looks at
them before anything ships. That is what was missing: thirty seven checks passed
on a page whose nine document packs rendered as plain text.
