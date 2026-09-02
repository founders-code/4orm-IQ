-- 4orm IQ - THE PUBLIC REGISTER
--
-- One row per party that carries a finding, and nothing else.
--
-- WHAT THIS TABLE IS FOR
-- A person about to send money wants to know two things this product could not
-- tell them before: has anybody else looked this party up, and is anything
-- already on the record about it. This table answers both, in aggregate, for
-- the parties where the answer is yes.
--
-- WHAT IS NOT IN IT, AND WILL NOT BE
-- No visitor-day. No IP. No identifier anybody typed. No link of any kind
-- between a person and a party. The operations chain deliberately holds no
-- column naming the party a check was about, and this table does not undo that:
-- it holds a party and a count, and the count cannot be resolved back to who
-- did the counting. Adding a visitor column here would rebuild the person-level
-- file the product was built to refuse, so do not add one.
--
-- WHO GETS A ROW
-- Only a party where a check produced one of two things:
--   official  a regulator, court or registry has itself published something
--             adverse. The row carries that body's name, its own words, the
--             date and a link. We are pointing at a public record.
--   pattern   the same complaint appears on three or more independent
--             platforms and NO authority has acted. The row carries the counts
--             and says plainly that no authority has acted.
-- A party with nothing against it never gets a row at all, so this table cannot
-- become a list of everybody who has ever been looked up.
--
-- NAMING, AND WHEN
-- An official row is named the moment it is created, because the naming was
-- already done by the authority and we are pointing at their record.
--
-- A pattern row is NOT named on creation. Repeating somebody else's accusation
-- is itself publication in Canada, so on a pattern row we are the publisher,
-- and the defence that carries it is responsible communication on a matter of
-- public interest. One of the things a court weighs there is whether we sought
-- and fairly reported the other side. So a pattern row is counted immediately
-- and named only after the party has been contacted and a response window has
-- passed, and any reply we receive is stored beside it and printed beside it.
--
-- COMING OFF IT
-- cleared_at is set the moment a later check finds neither of those two things,
-- and a cleared row is never shown. A regulator that withdraws an alert takes
-- the party off this list on the next check, without anybody having to ask.

create table if not exists ops_register (
  party_key     text primary key,          -- normalised domain, or a slug of the name
  display_name  text not null,
  domain        text,
  tier          text not null check (tier in ('official','pattern')),

  -- official only: whose finding this is. Never ours.
  authority     text,
  authority_url text,
  finding       text,
  found_at      date,

  -- pattern only: how wide, and how many. Never a verdict.
  platforms     integer not null default 0,
  reports       integer not null default 0,

  -- how often this party has been checked since it was first flagged
  searches      integer not null default 1,
  recent        integer not null default 1,
  recent_from   date    not null default current_date,

  -- the seek-comment gate. named_at is null until the window has passed, and
  -- the read path refuses to publish a name while it is null.
  contacted_at  timestamptz,
  reply_at      timestamptz,
  reply         text,
  named_at      timestamptz,

  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  cleared_at    timestamptz
);

create index if not exists ops_register_live
  on ops_register (cleared_at, tier, searches desc);
create index if not exists ops_register_recent
  on ops_register (cleared_at, first_seen desc);
