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

**The landing asks its questions in the thread, after you submit.** Typing a
name no longer makes anything appear under the cursor. You put in a company, a
website, an email address or a wallet, press the button, and the page answers
the way a person would: a pause, then "2 quick questions", then the questions
themselves with the answers as buttons. There is no skip, because the answers
decide which registers can apply, and a private seller who holds no licence must
never be read as a party hiding one.

**The identifier pills are gone.** Company, website, email and wallet were said
twice, once as four chips and once in the sentence underneath. The sentence
carries it alone now, and it sits a little lower to take that job.

**The waiting screen is the network.** The cards moved up and the deck is down
from twenty-three to eleven. Below them, all 104 registers are drawn as a web:
an inner ring of the eighteen whose answer can carry a finding on its own, an
outer ring of everything else, nine faint ellipses through both, and a spoke
from every register to the centre. A register lights, a packet travels back
along its spoke, and the node then takes the colour of what the board says came
back. Every source is visited three times in a random order, so the web reads as
a sweep across everything rather than a clock hand going round.

Nothing on that screen invents a result. Motion is motion; colour comes only
from the board.

**The mark sits at the centre, with a ring that fills as the record comes in.**
The ring is the share of the record actually retrieved, and it eases rather than
jumps, because a bar that leaps looks like one that is guessing.

**A failed check now says it failed.** A run that dies mid-flight used to print
"Do not send anything tonight", which dressed our own failure as a finding about
somebody else. It now says the check did not finish, that nothing here is a
finding in either direction, and it names the registers you can open yourself.

**A long run no longer drops.** The reasoning step can run for minutes, and a
response that sends no bytes gets closed as idle by the platform in front of us.
The stream now sends a heartbeat every eight seconds.

**Delivery follows the evidence, not the box you ticked.** Telling us you have
already sent money never promotes a verdict. It changes only what we say once
the evidence is in: a regulator that has acted leads to your bank tonight; a
handful of poor reviews gets a summary and no instruction. Three independent
platforms carrying the same complaint is a pattern. Volume on one board is one
board.

**Rules can change without breaking the chain.** Each recorded row carries the
version of the fields it was hashed under, and each run commits to a policy
version rather than to the policy text, so the rules can be edited and the
history still verifies.

