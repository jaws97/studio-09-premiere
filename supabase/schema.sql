-- Studio 09 · The Premiere — Supabase schema.
-- Run once in the Supabase SQL editor (safe to re-run). Then create a PRIVATE storage
-- bucket named  s09-photos  (Storage → New bucket → leave "Public" off).
--
-- Only the Next.js server talks to these tables, using the service-role key.
-- Row level security is ON with no policies, so the public anon key can do nothing.

create table if not exists s09_show (
  id    text primary key,
  state jsonb   not null default '{}'::jsonb,
  rev   integer not null default 0
);
insert into s09_show (id) values ('main') on conflict (id) do nothing;

create table if not exists s09_tickets (
  id          text primary key,
  name        text    not null,
  seat        integer not null unique,          -- uniqueness is what stops two guests sharing a seat
  star        boolean not null default false,
  admitted_at timestamptz
);

create table if not exists s09_wishes (
  id     text primary key,
  name   text not null,
  text   text not null,
  at     timestamptz not null default now(),
  status text not null default 'pending'
);

create table if not exists s09_photos (
  id     text primary key,
  name   text not null,
  type   text not null,
  at     timestamptz not null default now(),
  status text not null default 'pending'
);

alter table s09_show    enable row level security;
alter table s09_tickets enable row level security;
alter table s09_wishes  enable row level security;
alter table s09_photos  enable row level security;

-- Host actions: compare-and-swap on rev, so two racing requests can't clobber each other.
create or replace function s09_cas(expected integer, next_state jsonb)
returns integer language sql as $$
  update s09_show set state = next_state, rev = rev + 1
  where id = 'main' and rev = expected
  returning rev;
$$;

-- Bravos arrive from a hundred phones at once: one atomic statement, no read-modify-write.
create or replace function s09_clap(n integer)
returns void language sql as $$
  update s09_show
  set state = jsonb_set(state, '{applause}', to_jsonb(coalesce((state->>'applause')::integer, 0) + n)),
      rev = rev + 1
  where id = 'main';
$$;

-- Append one item to an array in the state (seated / wishes / photos), atomically.
create or replace function s09_push(key text, item jsonb)
returns void language sql as $$
  update s09_show
  set state = jsonb_set(state, array[key], coalesce(state->key, '[]'::jsonb) || jsonb_build_array(item)),
      rev = rev + 1
  where id = 'main';
$$;

revoke execute on function s09_cas(integer, jsonb) from anon, authenticated;
revoke execute on function s09_clap(integer)       from anon, authenticated;
revoke execute on function s09_push(text, jsonb)   from anon, authenticated;
