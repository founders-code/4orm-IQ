# 4orm IQ, build 20260930.2200

Everything in this archive is the working tree as it stands, plus the two
control documents under `reports/`. It is a git repository: `git log` carries
eight commits and the reason for each.

## Run the gate

```
npm install
npx playwright install --with-deps chromium
npm run check
```

`npm run check` is the whole thing, in this order:

| Step | What it does |
|---|---|
| `compliance` | 16 rules, each naming the document it comes from |
| `compliance:test` | breaks all 16 on purpose and requires each to notice |
| `scanner` | the five files we actually serve |
| `test` | verify, graph-tests, 41 smokes, 14 gates |

`.github/workflows/check.yml` runs the same command on every pull request into
main. It needs no secret, because every check reads files.

## Before this goes live

| | |
|---|---|
| `KBYS_RATE_CLAUDE_IN_M`, `KBYS_RATE_CLAUDE_OUT_M` | The two per-million figures off the Anthropic invoice. Until they are set the control room says every dollar is priced from a default. |
| `KBYS_SCHEDULE_SECRET` | `openssl rand -hex 32`. Until it is set, retention runs only when a person signs in and presses the button. |
| `db/spend.sql` | Run once. The spend ceiling and the replay ledger enforce without it, per instance. |
| `db/telemetry.sql` | The `not_asked` and `computed` columns. Until they are added the ops board counts a register nobody asked as one that refused. |
| Counsel on the terms | `reports/terms-of-use.pdf`, section 03. Five authorities could not be read at source, and four questions need an answer before the terms are relied on. |
| The remote | The repository is committed locally and has no remote. `check` should be a required status check on main. |

## What changed in this build

Nine entries, and every one of them is in the change register at
`docs/change-register.json`, with its reason and a report behind it. The control
panel reads the same register: **Change register** in the masthead, beside **The
registry**.

### The defect this build exists to close

A consumer checking a registered Canadian dealer was shown a foreign regulator's
warning about a differently named company, one unhappy review, and the sentence
that we could not confirm the business on a relevant register. The register that
would have cleared them was not in the catalogue, so it was never asked, and an
absence in our own reading reached a reader as a fact about a business.

Three faults, three fixes. `CR-0004` has the whole account.

### The favourable side of the record

The engine only ever went looking for what was wrong. It now collects what the
record says in a party's favour, and ranks every piece of it by one question:
**how hard is this to buy?**

| Rank | What goes in it | May it move the result? |
|---|---|---|
| 1 Cannot be bought | A live registration, a licence in good standing, a regulator's own record, a filed statement, a court record showing a matter resolved | No |
| 2 Expensive to fake | Continuity: the same legal name across three registers, on the register since 2018, a domain eight years old | No |
| 3 Can be bought | Star ratings, review counts, testimonials, award badges, press releases | No |

The third column is the design. Register standing and adverse findings set the
result. Favourable evidence is context beside it and there is no code path from
one to the other. Once a purchased five-star page has nowhere to move the
needle, buying one stops working, and unlike a detector that defence has no
false positives.

A party's own words go in their own block, quoted and attributed, and are never
a record. There is no tally anywhere.

### The time window

Businesses make mistakes and then fix them.

| Band | Age | What it may do |
|---|---|---|
| `current` | Inside 12 months | Drives the result |
| `older` | 12 to 36 months | Shown, labelled, drives nothing |
| `archive` | Beyond 36 months | Behind one control the reader can open |
| `undated` | No date on the record | Never a finding. Goes to the gaps |

**Standing never ages.** A register entry, a licence, a regulator action, a
sanction and a court record say what is true now until the issuing body changes
them, so they are exempt by class and can never fall into a band.

The band is computed in `api/_recency.js`, in code, from the date the record
carries. The model carries the date and never weighs it: published work on
model based reranking found that injecting dates alone moved the mean
publication year of the top ten forward by up to 4.78 years and flipped
pairwise preferences by up to 25 per cent with no change in relevance.

### New files

| File | What it is |
|---|---|
| `api/_recency.js` | The four bands, the standing exemption, and a date parser for the shapes real sources print |
| `api/_standing.js` | The three ranks, the self-description test, and the four review shape signals |
| `api/_audit.js` | The change register: validation, merge, and the fields it may never carry |
| `api/audit.js` | `GET /api/audit`, the register merged with its runtime half |
| `db/audit.sql` | `audit_changes`. No column for who was looked up, same rule as the telemetry tables |
| `docs/change-register.json` | The register itself. Source of truth, reviewed like code |
| `tools/audit-embed.mjs` | Embeds it into `admin.html` between the two markers |

### New gates

`tools/verify.mjs` now fails the build if the change register is embedded empty,
if the embed and the file on disk disagree on how many entries there are, if an
entry has no reason, if an entry has no report to open, or if any entry carries
a field naming what a check was about.
