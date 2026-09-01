# 4orm - Know Before You Send
## The retrieval pipeline

One identifier goes in. Four tiers run, in this order. Each does one job.

---

## Tier 0 - Direct connectors

`api/_connectors.js`. No key, no cost, milliseconds.

| Connector | What it establishes |
|---|---|
| **ICANN RDAP** via `rdap.org` | Creation date, registrar, nameservers, status codes. The domain age check that breaks most operating-history claims |
| **DNS over HTTPS** | MX and SPF. Whether anyone is running a business behind the name |
| **Sibling check** | Re-runs RDAP against domains Exa surfaced. Shared nameservers or a shared registrar is one operator behind two brands |

**Why this tier exists.** When a connector returns, you know you reached it. Everything downstream is a search that may or may not have found the thing. This is the only tier where coverage is counted rather than estimated, and every connector added here raises the floor permanently.

The sibling check is what linked `investhelm.com` to `nexlares.com`: all three nameservers and the registrar matched. It costs nothing and it is the strongest signal the engine produces.

---

## Tier 1 - Exa

`POST https://api.exa.ai/search`, header `x-api-key`.

Eight searches, run in parallel. Six are **pinned with `includeDomains`** to the registers that matter, so a search returns the regulator's own page rather than an article about it.

| Search | Pinned to |
|---|---|
| Corporate existence | Canadian and UK registries, SEC EDGAR |
| Registration and licensing | CSA, CIRO, FINTRAC, Bank of Canada, SEC, FINRA, CFTC, NFA, FCA, ASIC, MAS |
| Caution and warning lists | Every provincial securities commission, plus FCA, ASIC, MAS, IOSCO |
| Sanctions | OFAC, UN, Global Affairs Canada, UK |
| Courts and insolvency | CanLII, SEC, gov.uk |
| **Negative reviews** | The fifteen review platforms, and only those |
| Subject's own claims | Open, review platforms excluded |
| Everything else | Open |

63 register domains in total, in `DOMAINS` in `api/_retrieval.js`. Adding a regulator is one line.

Each result comes back with full page text and model-selected highlights, and the response carries `costDollars` so the real cost per check is measured rather than guessed.

---

## Tier 2 - Parallel

`POST https://api.parallel.ai/v1/search`, header `x-api-key`, `mode: advanced`.

Three objectives. Each is a question no single page answers, expressed as an objective plus up to five queries, returning citation-aware excerpts.

**Negative review narratives.** Read one and two star reviews only. Ignore the positives. For each complaint capture what was actually done to the person, which platform it came from, and the date. Return the complainant's own words.

**Regulatory standing.** Registered where, authorised for what, warned by whom. Prefer the regulator's own page over commentary, and record the exact wording of any listing.

**People and operator pattern.** Who is named, do they appear in any official record, and does the same operator run other brands under reused phone numbers, addresses, wallets or templates.

---

## Tier 3 - Claude

One call. **No search tool.**

Everything the first three tiers found is assembled into an evidence brief and handed over with the cue as the system prompt and a forced `emit_assessment` tool whose `input_schema` is the payload contract. The model reads, cross-examines, and emits. It cannot search, so it cannot quietly fill a gap with something it went and found.

The instruction is explicit: **a source absent from the brief was not reached, and belongs in `coverage_gaps` - never as a clean result.**

---

## Why this order

Retrieval is cheap and parallel. Judgment is expensive and happens once.

An agentic loop where the model decides each search costs more, takes longer, and leaves you unable to say what was reached. Splitting them means the search plan is inspectable, the register list is editable by anyone, and the coverage number is arithmetic rather than an estimate.

**The trade, stated plainly.** A fixed plan does not discover its next question the way an agentic loop does. The sibling check is the answer to that for the case that matters most: it takes what Exa surfaced and goes back to the registry with it. Where a second-order question turns out to matter more often than expected, it becomes a fourth Parallel objective rather than a licence for the model to wander.

---

## Degrading

Each tier fails independently and says so.

| Missing | What happens |
|---|---|
| `EXA_API_KEY` | Tier 1 skipped. Its searches appear in `coverage_gaps` |
| `PARALLEL_API_KEY` | Tier 2 skipped. Same |
| A connector times out | That connector reports `unreachable`, the board light stays dark |
| `ANTHROPIC_API_KEY` | 503. The console says live checking is not switched on |

Nothing degrades into a confident answer. A thin run returns grey.

---

## Reading the cost

Every response carries a `pipeline` block:

```json
"pipeline": {
  "connectors": { "reached": [...], "unreached": [...], "siblings": 1 },
  "exa":      { "calls": 8, "ok": 8, "results": 47, "cost_usd": 0.012 },
  "parallel": { "calls": 3, "ok": 3, "results": 22 },
  "claude":   { "input_tokens": 61240, "output_tokens": 5180 },
  "ms":       { "exa": 3100, "retrieval": 19400, "total": 41200 }
}
```

Read it off twenty real runs before modelling anything. Expect tokens to dominate: retrieval is fractions of a cent, and the Claude call is reading everything the first three tiers found.
