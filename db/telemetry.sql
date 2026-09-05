-- 4orm IQ  ---------------------------------------------------- OPERATIONS
--
-- The metrics in OPS-001 s.51 and the evidence pack in s.52, and nothing else.
--
-- READ THIS BEFORE ADDING A COLUMN.
--
-- There is deliberately no column anywhere in this file for the identifier a
-- user searched, the party a check was about, or the result it returned. That
-- is not an oversight and it is not a gap to be filled later. A table that
-- holds who was looked up rebuilds the person-level file that PIA-001 s.20 and
-- s.21 exist to prevent, and it would do it inside the very system built to
-- refuse it. An administrator here can see how the machine is running. They
-- cannot see who anybody asked about.
--
-- What that costs: no "show me the searches for Acme Ltd" view, ever. What it
-- buys: there is nothing to disclose under an access request, nothing to
-- breach, and nothing to subpoena.
--
--   psql "$POSTGRES_URL" -f db/telemetry.sql

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ runs
-- One row per attempted check. Shape of the request, never its content.
-- ------------------------------------------------------- the evidence layer
--
-- 4orm sells the ability to prove a record went unaltered. It would be strange
-- to run its own operations log on trust, so this one is chained: every row
-- carries the hash of the row before it, and its own hash over that plus its
-- own content. Change any row after the fact and every hash after it stops
-- matching, which /api/evidence walks and reports.
--
-- What that buys, specifically: the counter on the landing page stops being a
-- number we assert and becomes a number somebody can check. Competition Act
-- s.74.01(1)(b) puts the onus of substantiating a performance claim on us, and
-- a chain head plus a verification run is what discharging it looks like.
create table if not exists ops_chain (
  name       text primary key,        -- 'ops_runs' or 'ops_policy'
  height     bigint not null default 0,
  head_hash  text not null default repeat('0',64),
  updated_at timestamptz not null default now()
);
insert into ops_chain (name) values ('ops_runs')   on conflict do nothing;
insert into ops_chain (name) values ('ops_policy') on conflict do nothing;

create table if not exists ops_verify (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  height     bigint not null,
  head_hash  text not null,
  intact     boolean not null,
  broken_at  bigint,
  ms         int
);

create table if not exists ops_runs (
  id                   uuid primary key default gen_random_uuid(),
  seq                  bigserial not null,
  at                   timestamptz not null default now(),
  -- The chain. prev_hash is the head at the moment this row was written and
  -- row_hash is sha256 over prev_hash plus this row's own fields.
  prev_hash            text not null,
  row_hash             text not null,
  -- Which canonical field list produced row_hash. The verifier picks the
  -- function by what the row says, not by what today's code does, so the
  -- recorded fields can grow without invalidating a single earlier hash.
  -- An existing version is frozen. A new field is a new version.
  hash_schema          text not null default 'v1',
  -- A visitor-day, not a visitor. Twelve characters of a salted hash over the
  -- day and the requester, so two checks from one person on one day count once
  -- and nothing here survives to the next morning or points at anybody. There
  -- is no way back from this value to a person and that is the whole point.
  visitor_day          text,
  input_type           text not null,        -- COMPANY | WEBSITE | EMAIL | WALLET
  province             text,                 -- province only, never a finer location
  purpose              text not null,        -- the declared purpose category
  outcome              text not null,        -- COMPLETED | BLOCKED_PURPOSE | BLOCKED_JURISDICTION
                                             -- | BLOCKED_INPUT | BLOCKED_ABUSE | ERROR
  sources_planned      int  not null default 0,
  sources_ok           int  not null default 0,
  sources_failed       int  not null default 0,
  sources_out_of_scope int  not null default 0,
  critical_failed      int  not null default 0,
  incomplete           boolean not null default false,
  suppressed_items     int,                       -- tier C/D or Quebec-subject suppressions.
                                            -- NULL means not measured. Never 0 by default:
                                            -- a zero here reads as a count that was taken.
  barred_items         int,                       -- content-age and dead-item refusals.
                                            -- NULL means not measured, same reason.
  duration_ms          int,
  policy_version       text,                 -- WHICH rules governed, never what they said
  manifest_generated   date,
  enforcement_on       boolean,
  sector               text,                 -- AUTO | MORTGAGE | INSURANCE | INVESTMENT | OTHER
  user_assert          text                  -- NOT_A_PERSON, where the reader overrode the gate
);
create index if not exists ops_runs_at    on ops_runs (at desc);
create index if not exists ops_runs_seq   on ops_runs (seq);
create index if not exists ops_runs_vday  on ops_runs (visitor_day);
create index if not exists ops_runs_out   on ops_runs (outcome, at desc);

-- ---------------------------------------------------------- source health
-- Rolled up per source per day. Never per run, so nothing here can be joined
-- back to a single check.
create table if not exists ops_source_day (
  day        date not null,
  source_id  text not null,
  attempts   int  not null default 0,
  ok         int  not null default 0,
  no_match   int  not null default 0,
  failed     int  not null default 0,
  timed_out  int  not null default 0,
  out_of_scope int not null default 0,
  p50_ms     int,
  primary key (day, source_id)
);

-- ------------------------------------------------------------------ rights
-- Access, correction and challenge volume. Case ids only, no requester data:
-- the case file itself lives in the privacy system, not here.
create table if not exists ops_rights (
  id          uuid primary key default gen_random_uuid(),
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  kind        text not null,     -- ACCESS | CORRECTION | CHALLENGE
  outcome     text,              -- CORRECTED | DECLINED | WITHDRAWN | NO_RECORD
  case_ref    text not null
);

-- --------------------------------------------------------------- deletion
-- Evidence that the retention job ran, which is the thing a regulator asks to
-- see and the thing nobody can produce after the fact.
create table if not exists ops_deletion (
  day             date primary key,
  ran_at          timestamptz not null default now(),
  records_deleted int not null default 0,
  ok              boolean not null default true,
  detail          text
);

-- -------------------------------------------------------------- incidents
create table if not exists ops_incident (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  kind       text not null,      -- SECURITY | PRIVACY
  pi_involved boolean not null default false,
  rrosh      boolean not null default false,   -- real risk of significant harm
  reported   boolean not null default false,
  ref        text not null
);

-- ----------------------------------------------------------- the rules
-- One chained row per rule change.
--
-- A run row commits to a policy VERSION and never to what that policy said.
-- That is deliberate: it is what lets a rule change without disturbing a hash
-- already written. The cost of that separation is that the version string
-- points at nothing unless the policy itself is recorded, which is this table.
--
-- source_digest is an order independent hash of the enabled source list, so a
-- reordered register is not reported as a rule change and a genuinely changed
-- one always is. evidence_url is what the change was based on: a regulator's
-- notice that a register moved, a licence class that was retired, a legal
-- opinion. Without it a rule change is an assertion, which is the thing this
-- whole layer exists to stop being.
create table if not exists ops_policy (
  id                 uuid primary key default gen_random_uuid(),
  seq                bigserial not null,
  at                 timestamptz not null default now(),
  prev_hash          text not null,
  row_hash           text not null,
  version            text not null,
  effective_from     date,
  manifest_generated date,
  sources_total      int not null default 0,
  sources_enabled    int not null default 0,
  source_digest      text not null,
  enforcement_on     boolean not null default true,
  change_kind        text not null,      -- INITIAL | SOURCE_ADDED | SOURCE_REMOVED
                                         -- | SCOPE_CHANGED | RULE_CHANGED | CORRECTION
  summary            text,
  reason             text,
  evidence_url       text,
  author             text
);
create index if not exists ops_policy_version_idx on ops_policy (version);
create index if not exists ops_policy_seq_idx     on ops_policy (seq);
