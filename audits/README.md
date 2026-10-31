# 4orm IQ audits

Every audit of this repository and the engine behind it. Internal. Held in
version control and excluded from the deployment, so none of it is reachable
from 4ormiq.com.

Naming: `AUD-00N-short-name.html`. Numbers are never reused. An audit is never
edited after it is filed; a later finding gets a later number.

| Audit | Date | Subject | What is still open |
|---|---|---|---|
| [AUD-001](AUD-001-full-audit.html) | 2026 | Full audit of the engine | Superseded by AUD-002 |
| [AUD-002](AUD-002-operations-audit.html) | 30 Sep 2026 | Operations: what is running, what is broken, what is counted wrongly | RDAP domain lookups failing; chain walk not run on a schedule; public site still carries the test-build banner pending SR-001 and eight unsigned control documents |
| [AUD-003](AUD-003-repository-cleanup.html) | 28 Oct 2026 | Repository: a second copy of the application, and everything internal, served publicly | Credential rotation as a precaution; full git-history secret walk; a build gate to stop the fault recurring |
| [AUD-004](AUD-004-build-checks.html) | 31 Oct 2026 | The build checks that were not running, and the two findings that came out of running them | The coverage figure (CR-0016) is undecided and the chain attests it; complycheck is red on two content blockers; protocheck and protoclip need a target or retirement |

AUD-002 also has a PDF beside it.

## AUD-004 in one paragraph

The suite had never been recorded. Running it took repairing it: nine tools were opening
a page that had moved or a build tree that is gone, `npm test` could not pass on a clean
clone because a check inside it pointed at a prototype in no commit, two rules failed
correct behaviour by grepping copy that had been reworded, and twenty-three of
ninety-one tools were invoked by nothing, among them the check that asks whether the
product accuses a real institution. First recorded run: 62 passed, 2 failed, 0 timed out.
Two findings outrank all of that. `admin.html` was deployed, so Vercel served the whole
change register, the ten control standards with their NO-GO states and the release
posture to anybody who asked, with only a browser-side session check in front of it. And
the product prints 175 registers in scope while the catalogue holds 135, because the
figure is the length of a typed alias list; the same list drives the out-of-scope count,
which is a hashed field, so the chain attests a coverage number that is wrong for two
registers in five. The first is closed and gated. The second is left open on purpose,
because three numbers could be right and the manifest is a signed document.

## AUD-003 in one paragraph

The application code came out sound: no hardcoded secrets, every key read from
the environment, helpers correctly underscore-prefixed so Vercel never routes
them, 30 modules all parsing. The repository around it did not. A folder named
`4orm-iq-site 3` held a stale copy of the whole application, including the
Search Cue and the authentication module, readable as plain text from the live
domain, and the same mechanism was publishing both investor decks, 92 build
scripts, 12 internal reports and the change register. A `.vercelignore` now
holds all of it off the deployment and the footprint falls from 26M to 11M. One
stale figure was corrected: a comment said 134 registers where the catalogue
computes 135. The finding worth keeping is a near miss: two pairs of files
matched on byte count and differed in content, and one of them was the *newer*
of two control-room builds. File size is not identity.

## The change register

`docs/change-register.json` is the running record of what changed and why, and
it is embedded into `admin.html` at build time rather than fetched. An audit
that produces changes gets an entry there as well as a report here.
