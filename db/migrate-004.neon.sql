-- 4orm IQ - MIGRATION 004
-- Bringing the corpus into line with the published privacy notice.
--
-- Run once:
--   psql "$POSTGRES_URL" -f db/migrate-004.neon.sql
--
-- WHAT THIS CHANGES, AND WHY
--
-- The privacy notice says the reader's search string, the party's result and
-- any person's name are not kept. Three things in this schema said otherwise:
--
--   runs.identifier   the search string, verbatim, on an index that made it
--                     searchable by who was checked. Where a reader typed an
--                     email address, that was personal information in an index.
--   runs.payload      the entire rendered result as a blob, which is the one
--                     thing the product promises not to file away.
--   runs.headline     a sentence of conclusion about a named party, kept after
--                     the run that produced it had gone.
--   operator_nodes    PERSON, DIRECTOR, OFFICER, PROMOTER and ADVISER rows: a
--                     persistent person-level graph accumulating across runs,
--                     which is exactly what the page suppresses at render.
--
-- The corpus itself stays. Recognising a wallet or a beneficiary that has
-- appeared before is the product, and it is a record about a business built
-- from public records. What goes is the reader's string, the stored result and
-- every natural person.
--
-- This migration is destructive on purpose. It drops columns and deletes rows.
-- Take a backup first if the environment holds anything you need.

begin;

-- ------------------------------------------------- 1. the search string
-- Replaced by a salted hash so a repeat is still recognisable and the string
-- is not recoverable. Requires CORPUS_SALT in the environment; with it unset
-- the column is simply left null, never filled with the plain string.
alter table runs add column if not exists identifier_hash text;
drop index if exists runs_identifier_idx;
alter table runs drop column if exists identifier;
create index if not exists runs_idhash_idx on runs (identifier_hash, created_at desc);

-- ------------------------------------------------ 2. the stored result
alter table runs drop column if exists payload;
alter table runs drop column if exists headline;

-- ------------------------------------------------- 3. the person graph
-- Edges first: they reference the nodes. Both ends are checked, because an
-- edge from a company to a director carries the director's name in its own
-- other_party and evidence_excerpt columns.
delete from operator_edges e
 using operator_nodes n
 where (e.from_node_id = n.node_id or e.to_node_id = n.node_id)
   and n.node_type in ('PERSON','DIRECTOR','OFFICER','PROMOTER','ADVISER');

delete from prior_warning_links l
 using operator_nodes n
 where l.node_id = n.node_id
   and n.node_type in ('PERSON','DIRECTOR','OFFICER','PROMOTER','ADVISER');

delete from operator_nodes
 where node_type in ('PERSON','DIRECTOR','OFFICER','PROMOTER','ADVISER');

-- And the constraint that keeps them out from here on, so a future write path
-- cannot reintroduce them by accident. A check constraint is the one control
-- that survives somebody editing the application code.
alter table operator_nodes drop constraint if exists operator_nodes_no_person;
alter table operator_nodes add constraint operator_nodes_no_person
  check (node_type not in ('PERSON','DIRECTOR','OFFICER','PROMOTER','ADVISER'));

commit;
