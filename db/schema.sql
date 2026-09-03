-- 4orm - Know Before You Send
-- The write side.
--
-- Every check writes here. Nothing reads back to a user yet, on purpose:
-- the read side needs per-field expiry rules that do not exist yet, and a
-- stale answer served silently would be the one dishonest thing in this
-- product. What this schema is for right now is capture. The evidence a
-- check produces is unrecoverable if it is not written down at the time.
--
-- Run this once against the database, then never again:
--   psql "$POSTGRES_URL" -f db/schema.sql

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- runs
-- WHAT IS NOT HERE, AND WHY.
--
-- Three columns were removed by migration 004 because the published privacy
-- notice says they do not exist, and the notice is the promise:
--
--   identifier  the reader's search string, verbatim, on a lower() index that
--               made this table searchable by who was checked. Where somebody
--               typed an email address that was personal information sitting
--               in an index. It is now a salted hash: a repeat is still
--               recognisable, the string is not recoverable.
--   payload     the entire rendered result as a blob. The findings, the
--               retrieved sources and the graph are all broken out into their
--               own tables below, each row carrying its source and its
--               excerpt, so the blob was a second copy of the one thing the
--               product promises not to file away.
--   headline    a sentence of conclusion about a named party, outliving the
--               run that produced it.
--
-- tools/smoke20.mjs fails the build if any of the three reappears here.
create table if not exists runs (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  identifier_hash     text,         -- sha256(CORPUS_SALT | lowercased input), 24 hex
  domain              text,
  verdict             text,
  identity_confidence int,
  evidence_coverage   int,
  sources_checked     int,
  sources_not_reached int,
  model               text,
  exa_calls           int,
  exa_cost_usd        numeric(10,5),
  parallel_calls      int,
  input_tokens        int,
  output_tokens       int,
  ms_total            int,
  brief_chars         int           -- size of the evidence brief, not the text
);
create index if not exists runs_idhash_idx on runs (identifier_hash, created_at desc);
create index if not exists runs_domain_idx     on runs (domain, created_at desc);
create index if not exists runs_verdict_idx    on runs (verdict, created_at desc);

-- ------------------------------------------------------------ sources
-- One row per URL actually retrieved. This is the raw retrieval record.
create table if not exists run_sources (
  id           bigserial primary key,
  run_id       uuid not null references runs(id) on delete cascade,
  tier         text,          -- Exa | Parallel
  label        text,          -- which planned search returned it
  register     text,          -- board register name, null if unmapped
  host         text,
  url          text not null,
  title        text,
  published_at text,
  snippet      text,
  retrieved_at timestamptz not null default now()
);
create index if not exists run_sources_run_idx      on run_sources (run_id);
create index if not exists run_sources_host_idx     on run_sources (host);
create index if not exists run_sources_register_idx on run_sources (register);

-- ------------------------------------------------------- domain facts
-- Facts that do not decay. RDAP creation dates never change, so once this
-- row exists the next check does not need to ask again.
create table if not exists domain_facts (
  domain        text primary key,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  created_date  text,
  age_days      int,          -- as at first_seen; derive current age from created_date
  registrar     text,
  nameservers   text[],
  mx            text[],
  spf           text,
  raw           jsonb
);

-- ----------------------------------------------------- infrastructure
-- The graph. Two domains sharing nameservers or a registrar. This is the
-- part of category 09 that only works with history, and it is the reason
-- to write before there is anything to read.
create table if not exists infra_edges (
  domain_a           text not null,
  domain_b           text not null,
  shared_nameservers text[],
  same_registrar     boolean,
  first_seen         timestamptz not null default now(),
  last_seen          timestamptz not null default now(),
  primary key (domain_a, domain_b)
);
create index if not exists infra_edges_b_idx on infra_edges (domain_b);

-- ------------------------------------------------------- review sweep
-- Which platforms were swept on a run and how many pages came back.
-- Counting platforms is the measure, not counting reviews.
create table if not exists review_sweep (
  id         bigserial primary key,
  run_id     uuid not null references runs(id) on delete cascade,
  platform   text not null,
  host       text,
  searched   boolean,
  pages      int,
  created_at timestamptz not null default now()
);
create index if not exists review_sweep_run_idx      on review_sweep (run_id);
create index if not exists review_sweep_platform_idx on review_sweep (platform);

-- ----------------------------------------------------------- findings
-- One row per material issue and per cross-examined claim, so an adverse
-- finding survives independently of the payload blob it came in.
create table if not exists findings (
  id         bigserial primary key,
  run_id     uuid not null references runs(id) on delete cascade,
  kind       text,     -- issue | claim
  category   text,
  title      text,
  detail     text,
  severity   text,
  tier       text,
  result     text,
  source     text,
  url        text,
  created_at timestamptz not null default now()
);
create index if not exists findings_run_idx  on findings (run_id);
create index if not exists findings_kind_idx on findings (kind, severity);

-- =====================================================================
-- THE OPERATOR GRAPH
--
-- The three tables below are what makes the second check on an operator
-- worth more than the first. A node is an identifier. An edge is a
-- connection between two of them, carrying the record it was read from.
--
-- The discipline this schema exists to enforce: a shared identifier is a
-- FACT and a shared operator is a CONCLUSION. Nothing here stores the
-- conclusion. specificity says how much the identifier narrows the world,
-- status says how well observed the connection is, and evidence_excerpt
-- plus source_url mean a reader can go and look.
-- =====================================================================

-- ------------------------------------------------------------ nodes
-- One row per identifier, ever. normalized_value is what matching runs on:
-- lower cased, punctuation stripped, company suffixes removed for names,
-- EVM addresses lower cased. display_value keeps what the source said.
-- No natural person ever enters this table. The page suppresses person nodes
-- at render; the check constraint below is the same refusal in the one place
-- that survives somebody editing the application code.
create table if not exists operator_nodes (
  node_id           text primary key,          -- TYPE:normalized_value
  node_type         text not null
    check (node_type not in ('PERSON','DIRECTOR','OFFICER','PROMOTER','ADVISER')),
  normalized_value  text not null,
  display_value     text not null,
  specificity       numeric(3,2),              -- 0.00 to 1.00
  specificity_band  text,                      -- very low | low | medium | high | very high
  first_seen        timestamptz,
  last_seen         timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists operator_nodes_type_idx  on operator_nodes (node_type);
create index if not exists operator_nodes_value_idx on operator_nodes (normalized_value);

-- ------------------------------------------------------------ edges
-- One row per observation of a connection. The same connection seen on two
-- runs is two rows, which is what lets first_seen and last_seen mean
-- anything and what lets a stale edge be recognised as stale.
create table if not exists operator_edges (
  edge_id       bigserial primary key,
  from_node_id  text not null references operator_nodes(node_id) on delete cascade,
  to_node_id    text not null references operator_nodes(node_id) on delete cascade,
  edge_type     text not null,
  other_party   text,                          -- the named party on the far side, where there is one
  source_id     text,                          -- which register or service
  run_id        uuid references runs(id) on delete set null,
  first_seen    timestamptz,
  last_seen     timestamptz,
  source_tier   text,                          -- A | B | C | D | 4orm
  confidence    numeric(3,2),
  historically_available boolean not null default false,
  evidence_excerpt text,
  source_url    text,
  retrieved_at  timestamptz,
  status        text not null default 'OBSERVED',  -- OBSERVED | CORROBORATED | DISPUTED | STALE
  created_at    timestamptz not null default now()
);
create index if not exists operator_edges_from_idx  on operator_edges (from_node_id);
create index if not exists operator_edges_to_idx    on operator_edges (to_node_id);
create index if not exists operator_edges_type_idx  on operator_edges (edge_type);
create index if not exists operator_edges_run_idx   on operator_edges (run_id);
create index if not exists operator_edges_party_idx on operator_edges (other_party);

-- ------------------------------------------------- entity classifications
-- What the party appeared to be on this run, why, and how sure. This is the
-- record of WHY a given register was or was not in the plan, which is what
-- makes a coverage figure auditable rather than asserted.
create table if not exists entity_classifications (
  id             bigserial primary key,
  entity_id      text,
  run_id         uuid references runs(id) on delete cascade,
  classification text not null,     -- PUBLIC_STOCK | CRYPTO | ... | OTHER
  confidence     numeric(3,2),
  reason         text,
  source_ids     text[],
  created_at     timestamptz not null default now()
);
create index if not exists entity_class_run_idx  on entity_classifications (run_id);
create index if not exists entity_class_type_idx on entity_classifications (classification);

-- ------------------------------------------------------- prior warnings
-- The part worth the most. An identifier on today's party that also sits on
-- an entity a regulator warned about. Stored as its own record so it can be
-- surfaced on the next run without recomputing the whole graph.
create table if not exists prior_warning_links (
  id           bigserial primary key,
  node_id      text references operator_nodes(node_id) on delete cascade,
  run_id       uuid references runs(id) on delete set null,
  prior_entity text not null,
  regulator    text not null,
  warned_on    date,
  source_url   text,
  created_at   timestamptz not null default now()
);
create index if not exists prior_warning_node_idx on prior_warning_links (node_id);

-- ------------------------------------------------------- claim chronology
-- What the party said about its own history, and what the records carried.
create table if not exists claim_chronology (
  id            bigserial primary key,
  run_id        uuid references runs(id) on delete cascade,
  kind          text not null,        -- claim | record
  text_value    text,                 -- the claim verbatim, or what the record is
  year_or_date  text,
  source        text,
  url           text,
  created_at    timestamptz not null default now()
);
create index if not exists claim_chron_run_idx on claim_chronology (run_id);
