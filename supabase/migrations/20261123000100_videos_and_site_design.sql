-- =====================================================================
-- Video portfolio (YouTube) and the website's two designs (client request, 2026-11-23).
--
-- videos: the studio pastes a YouTube link in Dashboard → Videos; the site shows the films on the Video Portfolio page
--   (/videos/) and up to five marked "on the home page" in the home page's video section. Played from YouTube
--   (privacy-enhanced embed), nothing is uploaded here.
-- business_settings.site_design / allow_design_switch: which design (classic or modern) visitors see, and whether they
--   may switch between the two with the corner switch (Dashboard → Website → Website design).
-- =====================================================================

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  url text not null default '',
  title text not null default '',
  description text not null default '',
  category text not null default 'Wedding',
  on_home boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true
);
create index if not exists videos_order_idx on public.videos (active, sort_order, created_at desc);

drop trigger if exists videos_touch on public.videos;
create trigger videos_touch before update on public.videos for each row execute function public.touch_updated_at();

alter table public.videos enable row level security;
drop policy if exists "videos public read" on public.videos;
create policy "videos public read" on public.videos for select to anon, authenticated using (active);
drop policy if exists "videos admin all" on public.videos;
create policy "videos admin all" on public.videos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- At most five films on the home page (the dashboard says so before saving; this keeps it true).
create or replace function public.videos_home_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.on_home and new.active and (select count(*) from public.videos v where v.on_home and v.active and v.id <> new.id) >= 5 then
    raise exception 'Five films are already on the home page. Take one off first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists videos_home_limit on public.videos;
create trigger videos_home_limit before insert or update on public.videos for each row execute function public.videos_home_limit();
revoke execute on function public.videos_home_limit() from public, anon, authenticated;

alter table public.business_settings add column if not exists site_design text not null default 'classic' check (site_design in ('classic', 'modern'));
alter table public.business_settings add column if not exists allow_design_switch boolean not null default true;
