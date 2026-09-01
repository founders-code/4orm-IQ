DO $$
BEGIN
  create extension if not exists pgcrypto;
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
    prev_hash            text not null,
    row_hash             text not null,
    hash_schema          text not null default 'v1',
    visitor_day          text,
    input_type           text not null,        -- COMPANY | WEBSITE | EMAIL | WALLET
    province             text,                 -- province only, never a finer location
    purpose              text not null,        -- the declared purpose category
    outcome              text not null,        -- COMPLETED | BLOCKED_PURPOSE | BLOCKED_JURISDICTION
    sources_planned      int  not null default 0,
    sources_ok           int  not null default 0,
    sources_failed       int  not null default 0,
    sources_out_of_scope int  not null default 0,
    critical_failed      int  not null default 0,
    incomplete           boolean not null default false,
    suppressed_items     int  not null default 0,   -- tier C/D or Quebec-subject suppressions
    barred_items         int  not null default 0,   -- content-age and dead-item refusals
    duration_ms          int,
    policy_version       text,                 -- WHICH rules governed, never what they said
    manifest_generated   date,
    enforcement_on       boolean,
    sector               text                  -- AUTO | MORTGAGE | INSURANCE | INVESTMENT | OTHER
  );
  create index if not exists ops_runs_at    on ops_runs (at desc);
  create index if not exists ops_runs_seq   on ops_runs (seq);
  create index if not exists ops_runs_vday  on ops_runs (visitor_day);
  create index if not exists ops_runs_out   on ops_runs (outcome, at desc);
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
  create table if not exists ops_rights (
    id          uuid primary key default gen_random_uuid(),
    opened_at   timestamptz not null default now(),
    closed_at   timestamptz,
    kind        text not null,     -- ACCESS | CORRECTION | CHALLENGE
    outcome     text,              -- CORRECTED | DECLINED | WITHDRAWN | NO_RECORD
    case_ref    text not null
  );
  create table if not exists ops_deletion (
    day             date primary key,
    ran_at          timestamptz not null default now(),
    records_deleted int not null default 0,
    ok              boolean not null default true,
    detail          text
  );
  create table if not exists ops_incident (
    id         uuid primary key default gen_random_uuid(),
    at         timestamptz not null default now(),
    kind       text not null,      -- SECURITY | PRIVACY
    pi_involved boolean not null default false,
    rrosh      boolean not null default false,   -- real risk of significant harm
    reported   boolean not null default false,
    ref        text not null
  );
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
    summary            text,
    reason             text,
    evidence_url       text,
    author             text
  );
  create index if not exists ops_policy_version_idx on ops_policy (version);
  create index if not exists ops_policy_seq_idx     on ops_policy (seq);
END $$;
