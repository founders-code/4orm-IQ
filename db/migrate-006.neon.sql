-- 006: the search pulse.
--
-- One row per identifier per day, in the CORPUS store, which carries no visitor
-- field of any kind. The hash is the same deterministic identifierHash the rest
-- of that store uses, so the same name checked twice lands on the same row and
-- the count moves.
--
-- `label` is NULL for the overwhelming majority of rows and stays NULL forever.
-- It is written only once a tally crosses the threshold, and only by the next
-- check on that identifier, because nothing was kept before the bar was crossed.
-- That is the whole point: we can name what is surging now, and we can never
-- name who was searched last month.
--
-- What may never appear in this table: a visitor, a time of day finer than the
-- day itself, a count of distinct people, a location, or a verdict of ours. The
-- outcome columns count what the REGISTERS returned, which is a fact about the
-- record and not a conclusion about the party.
DO $$
BEGIN
  create table if not exists search_pulse (
    day             date          not null,
    identifier_hash varchar(24)   not null,
    n               int           not null default 0,
    input_type      varchar(16),
    -- written only after the threshold trips, never before
    label           text,
    labelled_at     timestamptz,
    label_reason    text,
    -- what the registers said on those runs. Counted, never judged.
    adverse         int           not null default 0,
    clean           int           not null default 0,
    incomplete      int           not null default 0,
    first_seen      timestamptz   not null default now(),
    last_seen       timestamptz   not null default now(),
    primary key (day, identifier_hash)
  );
  create index if not exists search_pulse_day  on search_pulse (day desc, n desc);
  create index if not exists search_pulse_lbl  on search_pulse (labelled_at)
    where label is not null;
  create index if not exists search_pulse_hash on search_pulse (identifier_hash, day desc);
END $$;
