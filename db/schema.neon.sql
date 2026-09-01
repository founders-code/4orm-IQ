DO $$
BEGIN
  create extension if not exists pgcrypto;
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
  create table if not exists operator_nodes (
    node_id           text primary key,          -- TYPE:normalized_value
    node_type         text not null,
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
END $$;
