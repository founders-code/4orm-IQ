-- 4orm IQ - RETENTION
--
-- Run once to install, then call purge_expired() on a schedule:
--   psql "$POSTGRES_URL" -f db/retention.neon.sql
--
-- Until this file existed there was no expiry anywhere. Every table grew
-- without bound, which is not a retention policy however short the periods in
-- a document say it is. A period that nothing enforces is a sentence, not a
-- control.
--
-- THE PERIODS, AND THE REASON FOR EACH
--
--   runs and everything under them        12 months
--     A run is the record that a check happened and how it ended. Twelve
--     months is what an examination window or a dispute would reach back
--     over. Its children cascade, so this one line expires the retrieval
--     record, the findings, the sweep ledger, the classifications and the
--     chronology with it.
--
--   the corpus: operator_nodes/_edges     24 months from LAST SEEN, not first
--     This is the only data the product needs to keep to work. An identifier
--     nobody has seen for two years is not evidence of a live operation, and
--     an edge that old would be reported STALE anyway. Measured from last
--     seen, so an identifier still appearing stays.
--
--   prior_warning_links                   24 months, with the corpus
--   domain_facts                          24 months from last_seen
--   infra_edges                           24 months from last_seen
--
--   ops_runs                              NOT EXPIRED, and deliberately
--     The operations chain carries no identifier, no party and no result: the
--     shape of a run and nothing else. It is hash chained, so deleting a row
--     breaks every row after it and the count stops being provable, which is
--     the only thing that table exists to do. Nothing personal is in it to
--     expire. If it ever must be trimmed, it is trimmed from the oldest end
--     and the break is recorded, never from the middle.
--
--   ops_register                          governed by its own rules
--     A party comes off the public register when the authority that acted
--     withdraws, which is a clearing event and not a clock. Handled in
--     api/_register.js, not here.

create or replace function purge_expired()
returns table (table_name text, rows_deleted bigint)
language plpgsql
as $$
declare
  n bigint;
begin
  delete from runs where created_at < now() - interval '12 months';
  get diagnostics n = row_count;
  table_name := 'runs'; rows_deleted := n; return next;

  delete from operator_edges where last_seen < now() - interval '24 months';
  get diagnostics n = row_count;
  table_name := 'operator_edges'; rows_deleted := n; return next;

  /* Nodes last, and only those no surviving edge still references. A node
     with a live edge is still part of a cluster somebody can be shown. */
  delete from operator_nodes nd
   where nd.last_seen < now() - interval '24 months'
     and not exists (select 1 from operator_edges e
                      where e.from_node_id = nd.node_id or e.to_node_id = nd.node_id);
  get diagnostics n = row_count;
  table_name := 'operator_nodes'; rows_deleted := n; return next;

  delete from prior_warning_links where created_at < now() - interval '24 months';
  get diagnostics n = row_count;
  table_name := 'prior_warning_links'; rows_deleted := n; return next;

  delete from domain_facts where last_seen < now() - interval '24 months';
  get diagnostics n = row_count;
  table_name := 'domain_facts'; rows_deleted := n; return next;

  delete from infra_edges where last_seen < now() - interval '24 months';
  get diagnostics n = row_count;
  table_name := 'infra_edges'; rows_deleted := n; return next;
end;
$$;

-- A record of every purge, so the fact that retention ran is itself evidence
-- rather than an assurance. Written by api/retain.js.
create table if not exists ops_retention (
  id          bigserial primary key,
  ran_at      timestamptz not null default now(),
  ran_by      text,
  result      jsonb not null,
  total_rows  bigint not null default 0
);
create index if not exists ops_retention_at on ops_retention (ran_at desc);
