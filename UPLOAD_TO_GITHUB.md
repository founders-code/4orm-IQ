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

**What we found reads as one page again.** The pattern note ran at 72 characters
and sat stranded between a full width row of findings and a full width door,
which reads as a box that failed to load rather than a considered aside. It now
runs the full measure, and the two readings of the same evidence sit side by
side, which is what they are. Where we looked is a proper section with its own
heading rather than a card wearing the footer's margin.

**Do this right now shows all four titles at once.** Open, those four sections
ran to eight screens, and somebody who came for their bank's phone number had to
scroll past a table of fields to reach it. They are collapsed by default now, on
native disclosure elements, so the whole of what to do fits on one screen and the
reader opens the one they need.

**Sources and method is a green pill beside the gold Find support pill.** On the
landing, on every screen of the report, and on the dark waiting screen, which is
the one screen a reader spends the longest looking at and the one where they are
most likely to want to know how this is decided or who to ring.

**Five new cards on the waiting screen.** Who is doing this check and why they
care: that we have sat with hundreds of people on the worst day of their year,
that for most of them it was never spare money, that what follows is months of
sending the same documents to anybody who will take them, that shame is what
closes the last door, and that what would have stopped it was on the public
record the whole time. Every one carries its source, our own testimony included.


**The report is four screens instead of one long page.** The result screen ends
with what we could not answer, then the door for anybody who has already sent
money, then a green pill to what we found. That screen carries the findings,
where we looked, and the two things a pattern of complaints can mean, then a
green pill to what to do. That screen carries the three things to do now, what
to have ready before you ring, who to tell, and their words set against the
records. Every screen goes back one step, and the whole report now sits inside a
bordered panel that is wider than the old column.

**Sources and method sits next to Find support, everywhere.** On the landing,
and in the same place on every screen of the report. Sources and method opens
from the landing too, before any check has been run, and the way out of it knows
whether there is a report to go back to.

**The progress bar no longer parks at ninety.** The reasoning step is one call
that can run for two or three minutes, and the bar used to arrive at ninety on
its first byte and sit there for the rest of it. It is now driven by the
heartbeat: ninety is the floor, ninety-nine is a ceiling it approaches and never
reaches, and only a finished result writes a hundred. Neither bar can go
backwards, which it could when the partial result claiming eighty landed after
the reasoning phase claiming ninety.

**The network moved down and away from the cards above it.** The top row of
register names was sitting against the education card and read as part of it.

**The landing asks its questions in the thread, after you submit.** Typing a name
no longer makes anything appear under the cursor. You put in a company, a
website, an email address or a wallet, press the button, and the page answers the
way a person would: a pause, then "2 quick questions", then the questions
themselves with the answers as buttons. There is no skip, because the answers
decide which registers can apply, and a private seller who holds no licence must
never be read as a party hiding one.

**The waiting screen is the network.** All 104 registers drawn as a web: an inner
ring of the eighteen whose answer can carry a finding on its own, an outer ring
of everything else, nine faint ellipses through both, and a spoke from every
register to the centre. A register lights, a packet travels back along its spoke,
and the node then takes the colour of what the board says came back. The mark
sits at the centre with a ring that fills as the record comes in.

Nothing on that screen invents a result. Motion is motion; colour comes only from
the board.

**A failed check now says it failed.** A run that dies mid-flight used to print
"Do not send anything tonight", which dressed our own failure as a finding about
somebody else. It now says the check did not finish, that nothing here is a
finding in either direction, and it names the registers you can open yourself.

**A long run no longer drops.** The stream sends a heartbeat every eight seconds,
because a response that sends no bytes gets closed as idle by the platform in
front of us.

**Delivery follows the evidence, not the box you ticked.** Telling us you have
already sent money never promotes a verdict. It changes only what we say once the
evidence is in: a regulator that has acted leads to your bank tonight; a handful
of poor reviews gets a summary and no instruction. Three independent platforms
carrying the same complaint is a pattern. Volume on one board is one board.

**Rules can change without breaking the chain.** Each recorded row carries the
version of the fields it was hashed under, and each run commits to a policy
version rather than to the policy text, so the rules can be edited and the
history still verifies.
