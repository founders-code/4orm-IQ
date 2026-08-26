# Upload this to GitHub

Everything in this folder replaces what is in the repo now.

1. Unzip this file.
2. Open your GitHub repo, the one Vercel pulls from.
3. Add file, then Upload files.
4. Drag in ALL of these, from inside the unzipped folder:

   index.html
   vercel.json
   package.json
   .gitignore
   .env.example
   README.md
   api/            (the whole folder: 7 files)
   db/             (schema.sql)
   docs/           (6 files)
   assets/

5. Commit to `main`.

GitHub replaces files that have the same name, so nothing duplicates.
Vercel sees the push and deploys on its own.

## One environment variable to change

`KBYS_MAX_SEARCHES` is currently `8`. Change it to `10`.

The review sweep is now three separate pinned searches instead of one, so the
plan has ten searches in it. At 8 the two open sweeps at the end get dropped.

## One environment variable to add, when you are ready

`POSTGRES_URL` switches on the write side. See `docs/STORAGE.md`. Until it is
set, storage is skipped and the audit report says so. Checks are unaffected.

## What changed in this build

**The board now lights up.** Every URL retrieval brings back is attributed to
the register it came from, so a light means that register was actually reached
on this run. Before this, live checks always read "0 of 48 reached" because the
scan animation ran before the result existed and nothing repainted it after.

**Platform sweep ledger.** Fifteen review platforms, each showing whether it was
searched and how many pages came back. Counted from retrieval, not estimated,
and it appears both in the console and in the audit report. A platform with
nothing returned is reported as searched with nothing found, never as clean.

**Section 09, every page the check actually read.** Grouped by host, with the
title, the date, the excerpt and a link. Nothing in a report should rest on a
source the reader cannot open.

**How this check was run.** Search counts, pages retrieved, connectors reached,
time taken and token counts, published in the report.

**The review sweep is wider.** One search pinned to fifteen hosts returns
whatever ranks highest and can miss a platform entirely. It is now three
narrower searches: major review sites, complaint boards, and trading and
workplace communities.

**Failures say what failed.** A gateway timeout answers with HTML, and parsing
that as a result used to surface as a syntax error. The console now reads the
body as text first and reports the real status.

**The write side.** Six tables, every check recorded, nothing served back yet.

**Debug hook.** Add `?debug=1` to the URL and the console's internals are
reachable from the browser console as `window.__KBYS__`. Inert without the flag.

## Also in this build

**The nav is two objects now.** The logo pill on the left, Find support alone
on the far right, larger. Source network, Categories, Scoring and Run a check
are gone from it. They pointed at sections of the same page you are already on.

**The scoring section at the bottom is gone.** The tier ladder and the
"there is no trust score" explainer both went. Everything they said is already
said in one line each by the three chips under the search bar, and said again
by the dials themselves. An explanation that repeats what the interface already
shows is an explanation nobody reads.

**The footer note is three sentences shorter.** What is left is the liability
line, which stays because the product publishes adverse findings about real
companies.

**Find support is rebuilt as a real directory.** It was a menu of eight folders
you had to guess your way into. It is now one continuous page: every category,
every organisation and every telephone number rendered at once. The rail on the
left is a table of contents that jumps you down the page rather than swapping
it. The triage strip is a shortcut, not a gate. Search narrows what is already
visible instead of replacing it with a result list. An "if money has already
left" band sits above everything with the two things to do in the first hour.

## This build

**B612 Mono replaces JetBrains Mono on the instrument layer.** Designed by
Intactile DESIGN for Airbus, out of research with ENAC and the Universite de
Toulouse III, to be read at a glance on a cockpit screen. Every mono weight was
normalised to 400 or 700, because those are the only two B612 Mono ships and a
synthesised bold would throw away the crispness the face is being used for.
Inter still sets every sentence.

**The ground is black again.** The token block was inverted rather than the
components rewritten, so every rule keeps working. The support directory
redefines the same tokens locally on a lighter grey, because it is read rather
than watched.

**The lights change colour while a register is being read.** Each chip cycles
blue, gold, green on a 1.45 second loop with the phase staggered four ways, and
the board rows carry a matching edge. Both respect reduced motion.

**Nine switches.** All armed on load. A dropped switch removes the retrieval for
that category: the searches never run, the registers stay dark, the category
comes back grey, and the reasoning call is told in writing to report it as
switched off before the run rather than as clean. `plan()` filters the search
list, connectors are gated on category 06 and the infrastructure graph on 09.
Clearing every switch disables the Check button.

**The page splits under the search bar.** The search bar keeps the full width.
Below it: the assessment, the evidence composition and what to do next on the
left, the nine checks and their registers on the right, sticky.

## Latest changes

**The switches are gone.** Every check runs on every search again. `enabledChecks()`
survives as the one place that answers which categories a run may use, so the request
body, the sweep order and the API contract keep a single source of truth. The endpoint
still accepts a `checks` list and still defaults to all nine when it is absent, so
nothing about the search behaviour changed.

**The top bar is readable.** It was still carrying a pale fill left over from the white
theme, which put light text on a light ground.

**The board reads as an instrument.** A register waiting to run now has a visible light
rather than a dimmed one, whatever a check reached keeps its light and its weight, and
only a register that a finished run failed to reach goes dark.

**The legend says what the lights mean in plain words.** "Clear" was the worst of the old
set: it reads as a clean bill of health when all it ever meant was that nothing turned up
in that one source. The states now read: waiting to run, reading it now, nothing found
here, worth a look, something against them, could not reach it. One `stateWord()` map
drives every place a state is shown to a reader.

## The Goliath finding, and what changed because of it

A live check on a Florida company would have missed the arrest and the guilty plea. The
registers that carry them were not in the pinned list. This build fixes that and the two
structural gaps behind it.

**Fifty three register domains added.** `justice.gov`, `irs.gov`, `fbi.gov`, `fincen.gov`,
state corporate registries including `sunbiz.org`, federal and state court dockets,
receivership and bankruptcy claims agents, state attorneys general, the Internet Archive,
certificate transparency, trademark registers and public professional profiles. The pinned
list goes from 63 domains to 116, and the board from 48 registers to 64.

**A second retrieval round.** Round one searches what the consumer typed. Round two
searches what round one found: the people named in the records, the case numbers on the
dockets, the entities alongside the subject, the sibling domains. Seeds are extracted
deterministically and nothing is proposed that does not appear verbatim in a round one
result. Capped at six searches by `KBYS_MAX_ROUND2`.

**Names now get searched properly.** A person seed runs three searches of its own: criminal
and regulatory registers, court dockets, and public professional profiles.

## Category 10, claim dates against the record

This is a new check and it is the one that needs no regulator, no complaint and no opinion.

Step one collects every dated claim the party makes about itself, verbatim. Founding year,
track record, duration, volume over time, copyright line, awards, team tenure.

Step two establishes the independent record of when things first existed: the domain
creation date from ICANN RDAP, the incorporation date from the home registry, the first
Wayback capture, the first certificate, the trademark filing date.

Step three compares them and names the specific pair.

`CLAIM_PREDATES_DOMAIN` and `CLAIM_PREDATES_INCORPORATION` carry RED on their own, because
both sides are Tier A records and the conflict is arithmetic rather than opinion.
`CLAIM_PREDATES_FIRST_CAPTURE` and `CLAIM_PREDATES_CERTIFICATE` are YELLOW: an archive gap
is an archive gap. A brand may legitimately predate its domain, and the category says so.

The domain creation date comes from the registry record only. It is never inferred from an
archive capture, a copyright line or a first press mention.

**One environment variable to add:** `KBYS_MAX_ROUND2` = `6`. And raise
`KBYS_MAX_SEARCHES` to `16`, because round one now carries sixteen searches.

## The dashboard pass

**The blur was a bug, not a design.** The detail modal sat at z-index 130 and the
blurred scrim at 200, so every panel you opened was rendering behind the blur. Fixed.

**A progress bar at the very top of the viewport.** Outside every panel, three pixels,
running the width of the window while a check sweeps. The page now always answers
whether something is happening without anyone hunting for a spinner inside a box.

**A quick strip under the answer.** Six chips: the ten checks, reviews, the source
board, cross-examination, material issues, gaps. Each carries its figure and opens a
snapshot over the dashboard. Nothing scrolls the page, and closing puts you back exactly
where you were.

- **The ten checks** opens a summary of how many came back adverse, unresolved, nothing
  found and not reached, then all ten as a list. Click any one and it opens that check.
- **Reviews** opens with the numbers first: accounts read, platforms carrying negative
  reports, platforms swept, and what the corpus looks like. Then the trending mechanics,
  most repeated first, with the quote and which platforms carried it. Then where we
  looked, platform by platform.
- **Source board** opens all 64 registers sorted adverse first, and each one opens its
  own reference.

**The audit report is two thirds width, centred**, and it opens on a six figure grid:
verdict, identity confidence, evidence coverage, checks adverse, registers reached,
material issues. Eight passages of explanatory prose were cut.

**Not financial advice**, on arrival, dismissible, and it fades on its own after
twenty two seconds.

**Categories, registers and jurisdictions** in the top bar now carry a border and a gold
figure so they read as instruments rather than as small print.

## Run manual

`4orm KBYS Run Manual.pdf` is in the 4orm KBYS folder. Eight pages covering
everything to date.

## Test it

Load: 4ormiq.com/?live=1

Type investhelm.com and press Check, then open the audit report.
