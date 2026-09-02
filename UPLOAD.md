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
                         has called /api/counter for two builds. This one still
                         answers, with a payload shaped the page no longer reads.

    api/_reference.js    imported by nothing.

On GitHub: open the file, the three dots at the top right, Delete file, commit.

## The one thing to run by hand, once

`db/register.neon.sql` in the Neon SQL editor. It creates `ops_register`, the
table behind the public register. Nothing else needs a migration.

Until you run it the register endpoint returns an empty list and the pill does
not appear. Checks are unaffected either way.

## Environment variables

    KBYS_MAX_SEARCHES = 10      The review sweep is three pinned searches rather
                                than one, so the plan has ten in it. At 8 the two
                                open sweeps at the end get dropped.

    POSTGRES_URL                Switches on the write side, the operations chain
                                and the register. Until it is set, storage is
                                skipped, the audit report says so, and the
                                register is empty. Checks are unaffected.

## The five endpoints this creates

    /api/check           the check itself
    /api/counter         how many checks have been run
    /api/register        the public register, read only, no auth by design
    /api/evidence        one stored run, for the back office
    /api/admin-metrics   the back office figures

All five are used. There are no others.

## What changed in this build

The full list is in `4orm-iq-github.zip`, in `UPLOAD_TO_GITHUB.md`. The short
version: the progress bar was fixed on the demo path and still froze for seven
and a half seconds at a time on the live path; the register web drew at zero
height on every phone; the answer on the identity card set itself twelve lines
deep at one to three characters a line on a small screen; and five of the test
files had stopped checking anything years ago and were passing green.

36 checks now, all passing. They live in `tools/` in the full archive, not here,
because nothing serves them.
