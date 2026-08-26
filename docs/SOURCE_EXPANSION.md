# Source expansion and the operator graph

What changed, what it costs, and what to set before it works.

## What did not change

The verdict model (RED, GREY, YELLOW, GREEN), the ten checks on the console, the
Tier A/B/C/D authority model, the separation of retrieval from judgment, the register
board, the audit report structure and the Exa / Parallel / connector architecture are all
as they were. This expanded what the system searches and what category 09 is.

## The numbers

| | Before | After |
|---|---|---|
| Sources in the catalogue | 64 | 104 |
| Searches on an unclassified party | 18 | 18 |
| Searches on a crypto fund | 18 | 28 |
| Research objectives, routed | 3 | up to 10 |
| Category 10 date sources | 7 | 20 |
| `KBYS_MAX_SEARCHES` default | 13 | 22, clamped 3 to 34 |

A plumber costs what it did before. A crypto hedge fund costs more, because it is now
being checked against registers that could actually hold a record for it.

## Where things live

| File | What it is |
|---|---|
| `api/_catalogue.js` | Every source, with its routing, tier, transport and capabilities. The single source of truth |
| `api/_reference.js` | What each register is, what a hit means, what an absence means, what to read first |
| `api/_classify.js` | Vertical and jurisdiction classification, before the plan is built |
| `api/_graph.js` | Nodes, edges, specificity, convergence, prior warnings, wallet language |
| `tools/sync-catalogue.mjs` | Writes the generated board, reference and metadata into `index.html` |
| `tools/graph-tests.mjs` | The eleven executable tests for the graph, routing and the new sources |

**After any catalogue change, run `node tools/sync-catalogue.mjs`, then
`node tools/verify.mjs`.** The build check fails if the console and the catalogue
disagree, which is the class of bug that has cost this project three outages.

## Environment

Nothing new is required. Four optional keys improve the operator graph, and each one
publishes a gap rather than a false clean when it is absent:

| Variable | Improves |
|---|---|
| `SECURITYTRAILS_API_KEY` | DNS and IP history, related domains |
| `CENSYS_API_KEY` | Host and certificate relationships |
| `BUILTWITH_API_KEY` | Site technology and embedded identifiers |
| `PUBLICWWW_API_KEY` | Exact identifier search across site source code |

`POSTGRES_URL` is what makes the graph worth having. Without it every run still returns a
full result and nothing is stored, so the second check on an operator knows nothing about
the first. The graph tables are in `db/schema.sql`.

## Reading a result

Three figures on the header instead of one count:

```
Sources     104     everything in the catalogue
Apply here   54     could hold a record for this party
Reached      41     answered
```

Coverage is measured against **Apply here**. Open **How this check was routed** to see
what the party was classified as, why, and which sources were excluded with the reason for
each.

The **Operator graph** card on the summary rail opens the identifiers and every connection,
including the ones found and not counted. The full graph, every edge with its source, is in
section 07B of the audit report.

**Claim dates against the record** opens from check 10 and carries the comparison: every
dated claim the party makes, every independently dated record reached, and what the
comparison shows. Section 07C of the audit report carries the same table.

---

## Reading the board

Six states, and two of them are yellow on purpose.

| Light | Meaning | Counts as coverage |
|---|---|---|
| Green | Reached, and it returned a record about this party. Nothing in it was adverse | Yes |
| Solid yellow | Worth a look. It returned something | Yes |
| Red | Something against them | Yes |
| **Hollow yellow** | **Reached, nothing on file.** We hit it and there was nothing there | Yes, it was reached |
| Dashed grey | Could never have applied. Wrong jurisdiction or wrong activity | Not counted either way |
| Dim grey | Never asked, or we could not get in | **No. This is the only gap** |

The hollow yellow is the one that changed. A register we reached that had no entry used to
read grey, which made a working sweep look like a dead one. It is a result, it is not
clearance, and it now looks different from a register nobody asked.

## Register attribution is path aware

Several hosts serve more than one register. `sec.gov` carries EDGAR, Form D and the trading
suspension list; `cftc.gov` carries the RED list and the enforcement record; `asic.gov.au`
carries the professional register, the banned persons list and the investor alerts.

`registersFor(host, url)` decides from the **path**, so a suspension notice lights the
suspension lamp rather than EDGAR. `registersServedBy(host)` is deliberately broader and
answers a different question: when a domain was pinned on a search that ran, every register
that host serves was asked, and the board says so.
