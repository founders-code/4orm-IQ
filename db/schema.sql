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
create table if not exists runs (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  identifier          text        not null,
  domain              text,
  verdict             text,
  headline            text,
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
  payload             jsonb,        -- the whole render payload, as served
  brief_chars         int           -- size of the evidence brief, not the text
);
create index if not exists runs_identifier_idx on runs (lower(identifier), created_at desc);
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
