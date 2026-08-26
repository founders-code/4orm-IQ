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
   api/            (the whole folder: 5 files)
   docs/           (the whole folder: 5 files)
   assets/

5. Commit to `main`.

GitHub replaces files that have the same name, so nothing duplicates.
Vercel sees the push and deploys on its own. You do not need to redeploy by hand.

## Your environment variables are safe

They live on the Vercel project, not in these files. Uploading code does not
touch them. All five should still be there:

  ANTHROPIC_API_KEY     Secret
  EXA_API_KEY           Secret
  PARALLEL_API_KEY      Secret
  KBYS_MODEL            Config    claude-sonnet-5
  KBYS_MAX_SEARCHES     Config    8

## What changed in this build

- The whole site is white, matching the 4ormfinance house style.
- Landing shows the search window alone. Searching opens the full console.
- Model identifier corrected to `claude-sonnet-5` in api/check.js and .env.example.

## Test it

Load: 4ormiq.com/?live=1

You should get a white page with one search window.
Type investhelm.com and press Check.

Without `?live=1` the console reads the seeded corpus, which is the demo mode.
With it, every check runs a real sweep and costs money.
