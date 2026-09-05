-- 005: two counters that were never measured stop pretending to be zero.
--
-- suppressed_items and barred_items were declared `int not null default 0`.
-- Nothing in the pipeline ever measured either of them, so every row in the
-- chain carried a zero that meant "not measured" while reading as "measured,
-- and the answer was none". On a product whose whole claim is that its numbers
-- are counted rather than asserted, that is the wrong default.
--
-- The write path now sends null where nothing was measured. A column declared
-- not null rejects an explicit null even when it has a default, because a
-- default only applies to an omitted column, so the chain write began failing
-- outright and no run was logged at all.
--
-- Null is the honest value: we did not measure this. The moment either is
-- genuinely counted, it writes an integer and means it.
--
-- Existing rows are untouched. A row holding 0 keeps its 0 and its hash, and
-- verifies exactly as it always did.
DO $$
BEGIN
  alter table ops_runs alter column suppressed_items drop not null;
  alter table ops_runs alter column barred_items     drop not null;
  alter table ops_runs alter column suppressed_items drop default;
  alter table ops_runs alter column barred_items     drop default;
END $$;
