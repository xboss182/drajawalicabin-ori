-- Minimal slab of the production schema, enough for the WA booking bridge
-- migration and its behavioral checks to run against a scratch Postgres.
-- This is a TEST SLAB, trimmed from the real migrations
-- (20260617140936, 20260710152228, 20260625133951); the real 20260822
-- bridging migration is applied on top of it verbatim.
--
-- auth.users / user_roles / has_role: stubbed (RLS policy + FK targets only).
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create table if not exists public.app_settings (key text primary key, value text);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','owner','user'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending_payment','awaiting_review','confirmed','cancelled','expired','fully_paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table if not exists public.cabins (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  cabin_type text not null,
  capacity integer not null,
  weekday_rate numeric(10,2) not null,
  weekend_rate numeric(10,2) not null,
  school_holiday_rate numeric(10,2) not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.school_holidays (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check_in date not null,
  check_out date not null,
  cabin_id uuid references public.cabins(id) on delete set null,
  status public.booking_status not null default 'pending_payment',
  hold_expires_at timestamptz,
  guest_name text not null,
  email text not null,
  phone text not null,
  guests integer not null default 1,
  nights integer,
  room_type text,
  subtotal numeric(10,2),
  comforter boolean not null default false,
  comforter_total numeric(10,2) not null default 0,
  total_amount numeric(10,2),
  deposit_amount numeric(10,2),
  balance_amount numeric(10,2),
  payment_reference text unique,
  payment_type text,
  booking_group_id uuid,
  guest_token uuid,
  discount_id uuid,
  discount_code text,
  discount_amount numeric not null default 0
);

-- Availability helper (20260617140936 verbatim logic).
create or replace function public.cabin_taken_dates(_cabin_id uuid, _from date, _to date)
returns table(d date)
language sql stable security definer set search_path = public as $$
  select gs::date
  from public.booking_requests b
  cross join lateral generate_series(b.check_in, b.check_out - 1, interval '1 day') gs
  where b.cabin_id = _cabin_id
    and b.status in ('confirmed','awaiting_review')
    and gs::date between _from and _to
  union
  select gs::date
  from public.booking_requests b
  cross join lateral generate_series(b.check_in, b.check_out - 1, interval '1 day') gs
  where b.cabin_id = _cabin_id
    and b.status = 'pending_payment'
    and coalesce(b.hold_expires_at, b.created_at + interval '30 minutes') > now()
    and gs::date between _from and _to;
$$;

-- Price helper (20260617140936 verbatim logic).
create or replace function public.compute_booking_price(_cabin_id uuid, _check_in date, _check_out date, _comforter boolean)
returns table(nights integer, subtotal numeric, comforter_total numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.cabins%rowtype;
  d date;
  rate numeric := 0;
  sub numeric := 0;
  n integer := 0;
  is_school boolean;
  dow integer;
begin
  select * into c from public.cabins where id = _cabin_id;
  if not found then raise exception 'Cabin not found'; end if;
  if _check_out <= _check_in then raise exception 'Invalid dates'; end if;
  d := _check_in;
  while d < _check_out loop
    select exists (select 1 from public.school_holidays where d between starts_on and ends_on) into is_school;
    dow := extract(isodow from d);
    if is_school then rate := c.school_holiday_rate;
    elsif dow >= 5 then rate := c.weekend_rate;
    else rate := c.weekday_rate;
    end if;
    sub := sub + rate;
    n := n + 1;
    d := d + 1;
  end loop;
  nights := n; subtotal := sub; comforter_total := case when _comforter then 20 * n else 0 end; total := sub + comforter_total;
  return next;
end $$;

insert into public.cabins (slug, name, cabin_type, capacity, weekday_rate, weekend_rate, school_holiday_rate, display_order)
values ('queen-1','Riverside Queen 1','Queen',2,80,90,100,1)
on conflict (slug) do nothing;