-- 003: the reader's own assertion.
--
-- The console refuses an identifier that reads as a person's name. Plenty of
-- real companies read that way, so the reader can tell it otherwise and run the
-- check anyway. That assertion is theirs, it changed what the system was
-- willing to do, and a run that only happened because somebody overrode the
-- gate has to be distinguishable later from a run the gate never questioned.
--
-- Null on every ordinary run. One value today: NOT_A_PERSON.
--
-- Rows written before this column existed keep hash_schema v2 and verify under
-- v2 forever. New rows are written under v3, which appends this field to the
-- canonical string. Nothing already in the chain is re-hashed.
DO $$
BEGIN
  alter table ops_runs add column if not exists user_assert text;
  create index if not exists ops_runs_assert on ops_runs (user_assert) where user_assert is not null;
END $$;
