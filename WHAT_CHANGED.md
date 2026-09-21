# 4orm IQ, build 20260921.0736

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

### The result page, one reading column beside the report card

| Change | Where |
|---|---|
| The reading column runs in this order: the verdict, in our own words, what we found, what we could not answer, next steps. Every block is the full column width, with one left and one right edge, beside the report card. | `.rp-readcol` |
| On a phone the report card follows what we found; what we could not answer and next steps stay last. | `@media(max-width:680px)` |
| Money sent: the dark verdict box carries a red "Do this right now" that opens the act page. It beats three times and stays lit only where an authority has named the party. | `sentNow_` |
| The door at the foot opens the Next steps page for everyone: "Next steps to protect you" before money has gone, "Next steps to protect you in the future" after. | `#rpActWay` |
| The foot of the Next steps page carries the same red "Do this right now" pill, opening the same act page. | `#rpNextToAct` |
| "There are two registers we could not open" is written in words. | `rpGap1` |
| "Keep reading" shows only when the way on at the foot of the reading column is out of sight. | `rpCueNeeded` |
| `doorcheck`, `nextcheck` and `smoke26` check the order, the shared edges and both routes. | `tools/` |

### The report, for the reader who has sent money and the one who has not

| Change | Where |
|---|---|
| The red button beats three times, then stays lit red. No more continuous flashing. | `index.html`, `.rp-beat` |
| The button beside the verdict shows only when the reader said money has gone. It beats only when a regulator, court or registry has published something about this party by name. | `index.html`, `sentNow_` |
| The money question carries a note: this is the important one. | the `stage` question |
| The bottom of the report is one row: what we could not answer on the left under the reading column, the way on beside it under the report card. The grey box and the full width green bar are gone. | `#rpClose` |
| Not sent, or just researching: the way on is blue, "Next steps to protect you". Sent: it is red, "Do this right now". The pinned phone bar and the button inside the records follow the same answer. | `rpOnward` |
| New page, Next steps to protect you: four did you knows, each with its public source; nine tips on checking a business yourself (registers, review sites, consumer protection sites, social media, what a run of negative reviews means); and a red "Do this right now if you've sent money" at the foot. | `#rpNext` |
| The records count uses one unit: "Two findings, one of them from a regulator, court or registry." It can no longer print a part larger than the whole. | door subline |
| "What they present as" keeps capitals: VC startup, NFT, DeFi. | `rpKind` |
| New gate `tools/nextcheck.mjs`; `doorcheck`, `smoke26/36/39/40`, `frames`, `packpdf`, `contactsheet` walk the new route. | `tools/` |

### Earlier in this build

### The security pass, steps 1 to 8

* **The spend ceiling.** `api/_budget.js`. A reservation is taken before the
  first vendor call and recorded as it decides, so concurrent requests cannot
  all read the same low count and pass. Runs, dollars per minute, dollars per
  day, per client, plus a house ceiling for the day. Volume throttles; repeat
  behaviour blocks, doubling to a six hour cap. One oversized request is
  refused and never blocked, because size is not behaviour.
* **The spend reader.** A third pill on the control room's operations row, and
  five bands behind it. It never goes red for spending money.
* **Response shaping.** `forClient()` cuts the payload at both exits. The
  vendor cost of a check, the model, the build stamp and the seed counts no
  longer travel to a browser that never drew them.
* **Evidence is not instruction.** `api/_untrusted.js`. Every retrieved span is
  fenced with a marker minted per run, labelled with its host, and scrubbed of
  anything that could imitate the fence. Standing order R8 tells the model to
  report an injection attempt as a finding rather than skip it.
* **The scheduled door.** `api/_scheduled.js`. A signature over method, path,
  timestamp, nonce and body hash, compared in constant time on digests, valid
  five minutes either way, usable once.
* **The database.** Every value bound. One identifier is concatenated, and it is
  looked up in an allowlist with an own-property check and a shape test. No
  star selects. No exception reaches a caller.
* **The log.** One writer, `api/_log.js`, which scrubs an email, an address, a
  key, a token, a connection string and a URL out of a line before it is
  written.
* **The scan.** `tools/scanner.mjs` reads what is served, not the repository.

### The pages

* **Terms of use.** A page of their own, linked from every footer. "I understand"
  on the card before each check is the agreement: the notice sits above the
  button and names the version, the terms open inside the card, and the version
  and time agreed are printed on the result and on every pack. Liability is
  limited as far as the law allows and no further, because Quebec prohibits the
  rest and a struck clause protects nothing.
* **A fast check opened its result before the reader agreed.** It now waits for
  the click.
* **The answer pills** rose from fully transparent while holding focus, so a
  keyboard reader sat on an invisible control for four tenths of a second. That
  was the intermittent failure on the waiting screen.

* **The search bar** carried three blue marks at once while somebody was
  typing: a halo outside the pill, a focus ring outside that, and an underline
  beneath the text. It now has one line, and it is the oval: the focus ring laid
  along the pill's own edge. Nothing moves when it appears.

* A modal marked the page behind it inert, except for whatever held focus. The
  conversation focuses its own answer pills, so a reader who reached the wait
  could tab back into a question already answered.
* **What we found** was green. A colour on that door is a verdict about what is
  behind it before anybody has opened it. It is neutral now, and the count does
  the work.
* **Do this right now** said the same thing to two different readers. It now
  reads "Do this right now if you've sent money" wherever we have not been told
  the money has gone. The flashing is unchanged, and is still earned only by an
  authority having published something about this party by name.
