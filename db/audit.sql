-- 4orm IQ  ------------------------------------------------ THE CHANGE REGISTER
--
-- Every main change to this product, and to the documents that govern it, with
-- who made it, when, what moved and why.
--
-- READ THIS BEFORE ADDING A COLUMN.
--
-- This table records changes to the SYSTEM. It carries no identifier anybody
-- searched, no party any check was about, and no result any check returned, for
-- the same reason db/telemetry.sql carries none: a table that holds who was
-- looked up rebuilds the person level file that PIA-001 s.20 and s.21 exist to
-- prevent, and it would do it inside the system built to refuse it.
--
-- The register on disk at docs/change-register.json is the source of truth and
-- is what the control panel embeds. This table is the runtime half: entries the
-- system writes about itself, which are merged with the file on read. A change
-- recorded in one and not the other is a gap, and /api/audit reports it as one.
--
--   psql "$POSTGRES_URL" -f db/audit.sql

create table if not exists audit_changes (
  id          text primary key,           -- CR-0001, ascending, never reused
  at          timestamptz not null default now(),
  kind        text not null,              -- code | document | policy | data | source
  area        text not null,              -- the file, document id or subsystem
  title       text not null,
  why         text not null default '',   -- the reason, in the reason's own words
  detail      text not null default '',   -- what actually moved
  actor       text not null default '',
  build       text not null default '',
  severity    text not null default 'p2', -- p0 | p1 | p2
  report      jsonb                       -- the clickable report, block form
);

create index if not exists audit_changes_at   on audit_changes (at desc);
create index if not exists audit_changes_kind on audit_changes (kind, at desc);
