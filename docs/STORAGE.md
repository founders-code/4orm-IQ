# The write side

Every check writes what it found. Nothing is served back from storage yet.

That order is deliberate. Serving a stored answer needs per-field expiry rules
that do not exist yet, and a stale answer served silently would be the one
dishonest thing in this product. Capture has to come first anyway, because the
evidence a check produces is unrecoverable if it is not written down at the
time it is produced.

## What gets written

| Table | One row per | Why it exists |
|---|---|---|
| `runs` | check | The whole payload as served, plus the numbers to model cost |
| `run_sources` | URL retrieved | The raw retrieval record, attributed to a board register |
| `domain_facts` | domain | Facts that do not decay. A creation date never changes |
| `infra_edges` | domain pair | The infrastructure graph behind category 09 |
| `review_sweep` | platform per run | Which platforms were swept and what came back |
| `findings` | issue or claim | So an adverse finding survives on its own, not only inside a blob |

`infra_edges` is the reason to build this now rather than later. Category 09
works only with history. Two domains sharing three nameservers and a registrar
is a finding no single check can produce, and every check run before storage
exists is a pair of nodes lost.

## Setting it up on Vercel

1. Project, then **Storage**, then **Create Database**.
2. Pick **Neon** from the Marketplace. The free tier is enough to start.
3. Connect it to the `4orm-iq` project. Vercel writes `POSTGRES_URL` into the
   project's environment variables for you.
4. Redeploy so the new variable reaches the functions.
5. Run the schema once. From the Neon console SQL editor, paste the contents
   of `db/schema.sql` and run it. Or locally:

   ```
   psql "$POSTGRES_URL" -f db/schema.sql
   ```

## Confirming it works

Run a live check and open the audit report. The last section says one of:

- *This run was written to the evidence record.*
- *This run was not written to the evidence record (reason).*

`no_database` there means `POSTGRES_URL` is not set on the deployment. Any
other reason is a real error worth reading.

## Guarantees

Storage can never break a check. Every path is wrapped, bounded by a timeout,
and returns a status rather than throwing. If the database is missing, slow or
misconfigured the check still returns a result and the report says storage was
skipped.

## What comes next, and what has to be settled first

The read side needs three decisions that are not code decisions:

1. **Expiry per field.** Creation dates never expire. Licensing status expires
   in weeks. Enforcement listings expire in days. Adverse findings never expire;
   clean findings expire fast, because absence of a finding is weak evidence
   and presence of one is strong.
2. **Snapshot age, always visible.** Never a silent cache hit. A stored answer
   is served with its age and a button to force a full sweep.
3. **Retention and correction.** Storing adverse assessments about named
   businesses and real people is a different posture from answering and
   forgetting. A wrong result that is served repeatedly is a harder problem
   than a wrong result shown once.
