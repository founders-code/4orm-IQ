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

## Test it

Load: 4ormiq.com/?live=1

Type investhelm.com and press Check, then open the audit report.
