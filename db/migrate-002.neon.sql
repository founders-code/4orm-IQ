DO $$
BEGIN
  alter table ops_runs add column if not exists hash_schema text not null default 'v1';
  alter table ops_runs add column if not exists sector      text;

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
    change_kind        text not null,
    summary            text,
    reason             text,
    evidence_url       text,
    author             text
  );
  create index if not exists ops_policy_version_idx on ops_policy (version);
  create index if not exists ops_policy_seq_idx     on ops_policy (seq);

  insert into ops_chain (name) values ('ops_policy') on conflict do nothing;
END $$;
