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

AUD-002 also has a PDF beside it.

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
