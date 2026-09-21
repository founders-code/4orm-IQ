-- 4orm IQ - THE SPEND LEDGER
--
-- What is recorded: a salted client key, a timestamp, an estimated cost and,
-- once the run finishes, the measured one. Nothing about the party checked,
-- nothing about the identifier, no IP address. The key is a SHA-256 of the
-- address under OPS_SALT and is not reversible without the salt.
--
-- Run this once against the database before the spend ceiling can use it.
-- Without these tables the ceiling still enforces, on the in-memory ledger.

create table if not exists spend_client (
  client_key   text primary key,
  block_until  timestamptz,
  block_len_s  int not null default 0,
  updated_at   timestamptz not null default now()
);

create table if not exists spend_run (
  id           bigserial primary key,
  client_key   text not null,
  at           timestamptz not null default now(),
  est_usd      numeric(10,5) not null default 0,
  actual_usd   numeric(10,5)
);
create index if not exists spend_run_client_at on spend_run (client_key, at desc);
create index if not exists spend_run_at        on spend_run (at desc);

create table if not exists spend_strike (
  id           bigserial primary key,
  client_key   text not null,
  at           timestamptz not null default now(),
  reason       text
);
alter table spend_strike add column if not exists reason text;
create index if not exists spend_strike_client_at on spend_strike (client_key, at desc);

-- The ledger is an operational counter, not a record anyone has to keep.
-- Anything older than eight days is noise and is dropped.
create or replace function purge_spend() returns table(dropped bigint) as $$
declare n bigint := 0; m bigint := 0;
begin
  delete from spend_run    where at < now() - interval '8 days';
  get diagnostics n = row_count;
  delete from spend_strike where at < now() - interval '8 days';
  get diagnostics m = row_count;
  return query select n + m;
end $$ language plpgsql;

-- The replay ledger for signed scheduled calls. A nonce lives for twice the
-- signature window and no longer: past that the timestamp check has already
-- refused the call, so keeping it would be storage with no job.
create table if not exists schedule_nonce (
  nonce text primary key,
  at    timestamptz not null default now()
);
create index if not exists schedule_nonce_at on schedule_nonce (at);
