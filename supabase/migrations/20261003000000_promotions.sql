create table if not exists public.promotion_subscribers (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^[+]5939[0-9]{8}$'),
  consented_at timestamptz not null,
  is_active boolean not null default true,
  unsubscribed_at timestamptz,
  source text not null default 'web-menu',
  created_at timestamptz not null default now()
);

alter table public.promotion_subscribers enable row level security;
revoke all on public.promotion_subscribers from anon, authenticated;
grant all on public.promotion_subscribers to service_role;

create table if not exists public.promotion_schedules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  message text not null,
  weekday smallint not null check (weekday between 0 and 6),
  send_time time not null default '10:00',
  timezone text not null default 'America/Guayaquil',
  template_name text not null default 'jhunay_weekly_promo_es',
  template_language text not null default 'es_EC',
  is_active boolean not null default true,
  last_sent_on date,
  created_at timestamptz not null default now()
);

alter table public.promotion_schedules enable row level security;
revoke all on public.promotion_schedules from anon, authenticated;
grant all on public.promotion_schedules to service_role;

create table if not exists public.promotion_deliveries (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotion_schedules(id),
  subscriber_id uuid not null references public.promotion_subscribers(id),
  send_date date not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempt_count smallint not null default 0,
  provider_message_id text,
  error_message text,
  attempted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (promotion_id, subscriber_id, send_date)
);

alter table public.promotion_deliveries enable row level security;
revoke all on public.promotion_deliveries from anon, authenticated;
grant all on public.promotion_deliveries to service_role;

create or replace function public.claim_due_promotions(
  p_weekday smallint,
  p_local_time time,
  p_today date
)
returns setof public.promotion_schedules
language sql
security definer
set search_path = public
as $$
  update public.promotion_schedules
  set last_sent_on = p_today
  where is_active
    and weekday = p_weekday
    and send_time <= p_local_time
    and (last_sent_on is null or last_sent_on < p_today)
  returning *;
$$;

revoke all on function public.claim_due_promotions(smallint, time, date) from public, anon, authenticated;
grant execute on function public.claim_due_promotions(smallint, time, date) to service_role;

insert into public.promotion_schedules (code, title, message, weekday, send_time)
values
  ('tuesday-wings-2-for-1', 'Martes de Alitas 2x1', 'Este martes disfruta nuestra promoción 2x1 en alitas. Te esperamos en Jhunay Resto Bar.', 2, '10:00'),
  ('saturday-menestras-20-off', 'Sábado de Menestras', 'Este sábado disfruta 20% de descuento en menestras. Te esperamos en Jhunay Resto Bar.', 6, '10:00')
on conflict (code) do nothing;