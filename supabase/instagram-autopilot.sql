-- Replyo AI Instagram Autopilot MVP
-- Run in Supabase SQL Editor. API access uses the service-role key server-side only.

create table if not exists public.instagram_autopilot_settings (
  id uuid primary key default gen_random_uuid(),
  business_id text not null unique,
  brand_name text not null default 'Replyo AI',
  instructions text not null,
  timezone text not null default 'Europe/Skopje',
  schedule_time text not null default '19:00',
  posts_per_day integer not null default 1 check (posts_per_day = 1),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_autopilot_posts (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  status text not null default 'draft' check (status in ('draft','published','failed')),
  topic text,
  headline text,
  caption text,
  image_prompt text,
  image_url text,
  instagram_media_id text unique,
  published_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists instagram_autopilot_posts_business_created_idx
  on public.instagram_autopilot_posts (business_id, created_at desc);
create index if not exists instagram_autopilot_posts_published_at_idx
  on public.instagram_autopilot_posts (published_at desc)
  where status = 'published';

alter table public.instagram_autopilot_settings enable row level security;
alter table public.instagram_autopilot_posts enable row level security;
-- Do not add anon/authenticated policies. Server-side service-role requests bypass RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('instagram-autopilot', 'instagram-autopilot', true, 12582912, array['image/png'])
on conflict (id) do update set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types;
